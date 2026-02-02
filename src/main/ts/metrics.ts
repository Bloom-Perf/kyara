import prom from 'prom-client';

export const enum Status {
  Success = 'success',
  Error = 'error',
}

export type MetricsEmitter = {
  browserStarted(name: string, status: Status): void;
  browserTabStarted(status: Status): void;
  tabDelayBeforeLaunch(nbSeconds: number): void;
  browserLogLine(): void;
  browserRequest(hostname: string): void;
  browserRequestFinished(hostname: string): void;
  browserRequestFailed(hostname: string): void;
  browserResponse(hostname: string): void;
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
    labelNames: ['status'],
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
    labelNames: ['hostname'],
    registers: [registry],
  });
  const browserRequestFinishedCounter = new prom.Counter({
    name: 'browser_request_finished',
    help: 'When the browser finishes successfully a http request',
    labelNames: ['hostname'],
    registers: [registry],
  });
  const browserRequestFailedCounter = new prom.Counter({
    name: 'browser_request_failed',
    help: 'When the browser fails a http request',
    labelNames: ['hostname'],
    registers: [registry],
  });

  const browserResponseCounter = new prom.Counter({
    name: 'browser_response',
    help: 'When the browser receives a response to its http request',
    labelNames: ['hostname'],
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
    browserTabStarted(status) {
      startedBrowserTabCounter.inc({ status });
    },
    tabDelayBeforeLaunch(nbSeconds) {
      tabDelayBeforeLaunchCounter.inc(nbSeconds);
    },
    browserLogLine() {
      browserLogLineCounter.inc();
    },
    browserRequest(hostname: string) {
      browserRequestCounter.inc({ hostname });
    },
    browserRequestFinished(hostname: string) {
      browserRequestFinishedCounter.inc({ hostname });
    },
    browserRequestFailed(hostname: string) {
      browserRequestFailedCounter.inc({ hostname });
    },
    browserResponse(hostname: string) {
      browserResponseCounter.inc({ hostname });
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
