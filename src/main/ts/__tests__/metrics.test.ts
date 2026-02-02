import { describe, it, expect, beforeEach } from '@jest/globals';
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
    expect(typeof metricsEmitter.tabDelayBeforeLaunch).toBe('function');
    expect(typeof metricsEmitter.browserLogLine).toBe('function');
    expect(typeof metricsEmitter.browserRequest).toBe('function');
    expect(typeof metricsEmitter.browserRequestFinished).toBe('function');
    expect(typeof metricsEmitter.browserRequestFailed).toBe('function');
    expect(typeof metricsEmitter.browserResponse).toBe('function');
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

  it('should increment browser_tab_started counter', async () => {
    metricsEmitter.browserTabStarted(Status.Success);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_tab_started');
    expect(metrics).toContain('status="success"');
  });

  it('should increment tab delay counter', async () => {
    metricsEmitter.tabDelayBeforeLaunch(5);

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_tab_delay_before_launch_counter');
  });

  it('should increment browser_log_line counter', async () => {
    metricsEmitter.browserLogLine();

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_log_line');
  });

  it('should increment browser_request counter with hostname', async () => {
    metricsEmitter.browserRequest('example.com');

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request');
    expect(metrics).toContain('hostname="example.com"');
  });

  it('should increment browser_request_finished counter', async () => {
    metricsEmitter.browserRequestFinished('example.com');

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request_finished');
  });

  it('should increment browser_request_failed counter', async () => {
    metricsEmitter.browserRequestFailed('example.com');

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_request_failed');
  });

  it('should increment browser_response counter', async () => {
    metricsEmitter.browserResponse('example.com');

    const metrics = await registry.metrics();
    expect(metrics).toContain('browser_response');
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
});
