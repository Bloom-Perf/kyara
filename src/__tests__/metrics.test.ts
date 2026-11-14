import { describe, it, expect, beforeEach } from '@jest/globals';
import { createSnapshot } from '@bloom-perf/hikaku';
import { createPromRegister, createMetricsEmitter, Status } from '../metrics.js';
import type { Registry } from 'prom-client';

describe('createPromRegister', () => {
  it('should create a Prometheus registry', () => {
    const registry = createPromRegister();

    expect(registry).toBeDefined();
    expect(typeof registry.metrics).toBe('function');
    expect(typeof registry.setDefaultLabels).toBe('function');
  });
});

describe('createMetricsEmitter', () => {
  let registry: Registry;
  let metricsEmitter: ReturnType<typeof createMetricsEmitter>;

  beforeEach(() => {
    registry = createPromRegister();
    metricsEmitter = createMetricsEmitter(registry);
  });

  it('should create a metrics emitter with all required methods', () => {
    expect(metricsEmitter).toBeDefined();
    expect(typeof metricsEmitter.browserStarted).toBe('function');
    expect(typeof metricsEmitter.browserTabStarted).toBe('function');
    expect(typeof metricsEmitter.browserLogLine).toBe('function');
    expect(typeof metricsEmitter.browserRequest).toBe('function');
    expect(typeof metricsEmitter.browserRequestFinished).toBe('function');
    expect(typeof metricsEmitter.browserRequestFailed).toBe('function');
    expect(typeof metricsEmitter.browserResponse).toBe('function');
    expect(typeof metricsEmitter.browserRequestDuration).toBe('function');
    expect(typeof metricsEmitter.browserError).toBe('function');
    expect(typeof metricsEmitter.resourcesConsumptionPerTab).toBe('function');
    expect(typeof metricsEmitter.resourcesConsumptionPerPod).toBe('function');
  });

  it('should increment browser_started counter', async () => {
    metricsEmitter.browserStarted('firefox', Status.Success);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_started');
    expect(metrics).toContain('browser="firefox"');
    expect(metrics).toContain('status="success"');
  });

  it('should increment browser_tab_started counter with scenario and iteration labels', async () => {
    metricsEmitter.browserTabStarted(Status.Success, 'Login Flow', 0);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_tab_started');
    expect(metrics).toContain('status="success"');
    expect(metrics).toContain('scenario="Login Flow"');
    expect(metrics).toContain('iteration="0"');
  });

  it('should increment browser_log_line counter', async () => {
    metricsEmitter.browserLogLine();

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_log_line');
  });

  it('should increment browser_request counter with scenario and iteration labels', async () => {
    metricsEmitter.browserRequest('example.com', 'Search Test', 2);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request');
    expect(metrics).toContain('hostname="example.com"');
    expect(metrics).toContain('scenario="Search Test"');
    expect(metrics).toContain('iteration="2"');
  });

  it('should increment browser_request_finished counter', async () => {
    metricsEmitter.browserRequestFinished('example.com', 'test-scenario', 0);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request_finished');
  });

  it('should increment browser_request_failed counter', async () => {
    metricsEmitter.browserRequestFailed('example.com', 'test-scenario', 0);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request_failed');
  });

  it('should increment browser_response counter', async () => {
    metricsEmitter.browserResponse('example.com', 'test-scenario', 0);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_response');
  });

  it('should record browser_request_duration_seconds histogram', async () => {
    metricsEmitter.browserRequestDuration('example.com', 'Login Flow', 1, 0.35);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request_duration_seconds');
    expect(metrics).toContain('hostname="example.com"');
    expect(metrics).toContain('scenario="Login Flow"');
    expect(metrics).toContain('iteration="1"');
  });

  it('should increment browser_error counter', async () => {
    metricsEmitter.browserError();

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_error');
  });

  it('should record resource consumption per tab', async () => {
    metricsEmitter.resourcesConsumptionPerTab('firefox', 1024, 50);

    const metrics = await registry.metrics();
    expect(metrics).toContain('dsd_tab_cpu_percent');
    expect(metrics).toContain('dsd_tab_ram_kb');
  });

  it('should record resource consumption per pod', async () => {
    metricsEmitter.resourcesConsumptionPerPod('firefox', 4096, 150);

    const metrics = await registry.metrics();
    expect(metrics).toContain('dsd_pod_cpu_percent');
    expect(metrics).toContain('dsd_pod_ram_kb');
  });

  it('should spread the CPU and memory samples over buckets fitting their units', async () => {
    metricsEmitter.resourcesConsumptionPerPod('chrome', 300_000, 37);

    const metrics = await registry.metrics();
    expect(metrics).toContain('dsd_pod_cpu_percent_bucket{le="25",browser="chrome"} 0');
    expect(metrics).toContain('dsd_pod_cpu_percent_bucket{le="50",browser="chrome"} 1');
    expect(metrics).toContain('dsd_pod_cpu_percent_bucket{le="800",browser="chrome"} 1');
    expect(metrics).toContain('dsd_pod_ram_kb_bucket{le="262144",browser="chrome"} 0');
    expect(metrics).toContain('dsd_pod_ram_kb_bucket{le="524288",browser="chrome"} 1');
    expect(metrics).toContain('dsd_pod_ram_kb_bucket{le="8388608",browser="chrome"} 1');
  });

  it('should give hikaku meaningful CPU and memory percentiles', async () => {
    for (let i = 0; i < 10; i++) {
      metricsEmitter.resourcesConsumptionPerPod('firefox', 1_500_000, 120);
    }

    const [resources] = (await createSnapshot(registry)).resources;
    expect(resources.browser).toBe('firefox');
    expect(resources.podCpuPercentiles.p50).toBeGreaterThan(100);
    expect(resources.podCpuPercentiles.p50).toBeLessThanOrEqual(150);
    expect(resources.podRamKbPercentiles.p50).toBeGreaterThan(1_048_576);
    expect(resources.podRamKbPercentiles.p50).toBeLessThanOrEqual(2_097_152);
  });
});

describe('createMetricsEmitter without the iteration label', () => {
  it('should label the scenario metrics with the scenario only', async () => {
    const registry = createPromRegister();
    const metricsEmitter = createMetricsEmitter(registry, { iterationLabel: false });

    metricsEmitter.browserTabStarted(Status.Success, 'Login Flow', 3);
    metricsEmitter.browserRequest('example.com', 'Login Flow', 3);
    metricsEmitter.browserRequestFinished('example.com', 'Login Flow', 3);
    metricsEmitter.browserRequestFailed('example.com', 'Login Flow', 3);
    metricsEmitter.browserResponse('example.com', 'Login Flow', 4);
    metricsEmitter.browserRequestDuration('example.com', 'Login Flow', 4, 0.2);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_tab_started{status="success",scenario="Login Flow"} 1');
    expect(metrics).toContain('browser_response{hostname="example.com",scenario="Login Flow"} 1');
    expect(metrics).not.toContain('iteration=');
  });
});
