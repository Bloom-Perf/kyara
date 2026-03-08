import prom from 'prom-client';

export const enum Status {
  Success = 'success',
  Error = 'error',
}

export type MetricsEmitter = {
  browserStarted(name: string, status: Status): void;
  browserTabStarted(status: Status, scenario: string, iteration: number): void;
  tabDelayBeforeLaunch(nbSeconds: number): void;
  browserLogLine(): void;
  browserRequest(hostname: string, scenario: string, iteration: number): void;
  browserRequestFinished(hostname: string, scenario: string, iteration: number): void;
  browserRequestFailed(hostname: string, scenario: string, iteration: number): void;
  browserResponse(hostname: string, scenario: string, iteration: number): void;
  browserRequestDuration(hostname: string, scenario: string, iteration: number, durationSec: number): void;
  browserError(): void;
  resourcesConsumptionPerTab(browser: string, ram: number, cpu: number): void;
  resourcesConsumptionPerPod(browser: string, ram: number, cpu: number): void;
};

export const createPromRegister = () => new prom.Registry();

export const createMetricsEmitter = (registry: prom.Registry): MetricsEmitter => {
  const startedBrowserCounter = new prom.Counter({
    name: 'browser_started',
    help: 'Browser started successfully',
    labelNames: ['browser', 'status'],
    registers: [registry],
  });

  const startedBrowserTabCounter = new prom.Counter({
    name: 'browser_tab_started',
    help: 'Browser Tab started successfully',
    labelNames: ['status', 'scenario', 'iteration'],
    registers: [registry],
  });

  const tabDelayBeforeLaunchCounter = new prom.Counter({
    name: 'browser_tab_delay_before_launch_counter',
    help: 'Cumulated waiting time before tabs launches',
    registers: [registry],
  });

  const browserLogLineCounter = new prom.Counter({
    name: 'browser_log_line',
    help: 'Browser console logs',
    registers: [registry],
  });

  const browserRequestCounter = new prom.Counter({
    name: 'browser_request',
    help: 'When the browser initiates a http request',
    labelNames: ['hostname', 'scenario', 'iteration'],
    registers: [registry],
  });
  const browserRequestFinishedCounter = new prom.Counter({
    name: 'browser_request_finished',
    help: 'When the browser finishes successfully a http request',
    labelNames: ['hostname', 'scenario', 'iteration'],
    registers: [registry],
  });
  const browserRequestFailedCounter = new prom.Counter({
    name: 'browser_request_failed',
    help: 'When the browser fails a http request',
    labelNames: ['hostname', 'scenario', 'iteration'],
    registers: [registry],
  });

  const browserResponseCounter = new prom.Counter({
    name: 'browser_response',
    help: 'When the browser receives a response to its http request',
    labelNames: ['hostname', 'scenario', 'iteration'],
    registers: [registry],
  });

  const browserRequestDurationHisto = new prom.Histogram({
    name: 'browser_request_duration_seconds',
    help: 'Duration of browser HTTP requests in seconds',
    labelNames: ['hostname', 'scenario', 'iteration'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const browserErrorCounter = new prom.Counter({
    name: 'browser_error',
    help: 'When the browser encounters an error',
    registers: [registry],
  });

  const cpuPerTabHisto = new prom.Histogram({
    name: 'dsd_tab_cpu_percent',
    help: 'Cpu consumption per browser tab',
    labelNames: ['browser'],
    registers: [registry],
  });

  const ramPerTabHisto = new prom.Histogram({
    name: 'dsd_tab_ram_kb',
    help: 'Ram consumption per browser tab',
    labelNames: ['browser'],
    registers: [registry],
  });

  const cpuPerPodHisto = new prom.Histogram({
    name: 'dsd_pod_cpu_percent',
    help: 'Cpu consumption per pod of browser tabs',
    labelNames: ['browser'],
    registers: [registry],
  });

  const ramPerPodHisto = new prom.Histogram({
    name: 'dsd_pod_ram_kb',
    help: 'Ram consumption per pod of browser tabs',
    labelNames: ['browser'],
    registers: [registry],
  });

  return {
    browserStarted(name, status) {
      startedBrowserCounter.inc({ browser: name, status });
    },
    browserTabStarted(status, scenario, iteration) {
      startedBrowserTabCounter.inc({ status, scenario, iteration });
    },
    tabDelayBeforeLaunch(nbSeconds) {
      tabDelayBeforeLaunchCounter.inc(nbSeconds);
    },
    browserLogLine() {
      browserLogLineCounter.inc();
    },
    browserRequest(hostname: string, scenario: string, iteration: number) {
      browserRequestCounter.inc({ hostname, scenario, iteration });
    },
    browserRequestFinished(hostname: string, scenario: string, iteration: number) {
      browserRequestFinishedCounter.inc({ hostname, scenario, iteration });
    },
    browserRequestFailed(hostname: string, scenario: string, iteration: number) {
      browserRequestFailedCounter.inc({ hostname, scenario, iteration });
    },
    browserResponse(hostname: string, scenario: string, iteration: number) {
      browserResponseCounter.inc({ hostname, scenario, iteration });
    },
    browserRequestDuration(hostname: string, scenario: string, iteration: number, durationSec: number) {
      browserRequestDurationHisto.observe({ hostname, scenario, iteration }, durationSec);
    },
    browserError() {
      browserErrorCounter.inc();
    },
    resourcesConsumptionPerTab(browser: string, ram: number, cpu: number) {
      ramPerTabHisto.labels(browser).observe(ram);
      cpuPerTabHisto.labels(browser).observe(cpu);
    },
    resourcesConsumptionPerPod(browser: string, ram: number, cpu: number) {
      ramPerPodHisto.labels(browser).observe(ram);
      cpuPerPodHisto.labels(browser).observe(cpu);
    },
  };
};
