import prom from 'prom-client';

export const enum Status {
  Success = 'success',
  Error = 'error',
}

export type MetricsEmitter = {
  browserStarted(name: string, status: Status): void;
  browserTabStarted(status: Status, scenario: string, iteration: number): void;
  browserLogLine(): void;
  browserRequest(hostname: string, scenario: string, iteration: number): void;
  browserRequestFinished(hostname: string, scenario: string, iteration: number): void;
  browserRequestFailed(hostname: string, scenario: string, iteration: number): void;
  browserResponse(hostname: string, scenario: string, iteration: number): void;
  browserRequestDuration(
    hostname: string,
    scenario: string,
    iteration: number,
    durationSec: number
  ): void;
  browserError(): void;
  /** One process rendering pages (a tab): memory (PSS) in kB, CPU in % of one core */
  resourcesConsumptionPerTab(browser: string, ram: number, cpu: number): void;
  /** The whole browser (all its processes): memory (PSS) in kB, CPU in % of one core */
  resourcesConsumptionPerPod(browser: string, ram: number, cpu: number): void;
};

export type MetricsOptions = {
  /**
   * Label the scenario metrics with the iteration (required by hikaku). Each iteration
   * creates new series: disable it for long runs with many iterations.
   */
  iterationLabel?: boolean;
};

/** CPU usage in % of one core: a busy browser uses several cores */
const CPU_PERCENT_BUCKETS = [1, 2.5, 5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 800];
/** Memory in kB: 16 MB to 8 GB */
const RAM_KB_BUCKETS = prom.exponentialBuckets(16 * 1024, 2, 10);

export const createPromRegister = () => new prom.Registry();

export const createMetricsEmitter = (
  registry: prom.Registry,
  { iterationLabel = true }: MetricsOptions = {}
): MetricsEmitter => {
  const scenarioLabelNames = iterationLabel ? ['scenario', 'iteration'] : ['scenario'];
  const scenarioLabels = (scenario: string, iteration: number) =>
    iterationLabel ? { scenario, iteration } : { scenario };

  const startedBrowserCounter = new prom.Counter({
    name: 'browser_started',
    help: 'Browser started successfully',
    labelNames: ['browser', 'status'],
    registers: [registry],
  });

  const startedBrowserTabCounter = new prom.Counter({
    name: 'browser_tab_started',
    help: 'Browser Tab started successfully',
    labelNames: ['status', ...scenarioLabelNames],
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
    labelNames: ['hostname', ...scenarioLabelNames],
    registers: [registry],
  });
  const browserRequestFinishedCounter = new prom.Counter({
    name: 'browser_request_finished',
    help: 'When the browser finishes successfully a http request',
    labelNames: ['hostname', ...scenarioLabelNames],
    registers: [registry],
  });
  const browserRequestFailedCounter = new prom.Counter({
    name: 'browser_request_failed',
    help: 'When the browser fails a http request',
    labelNames: ['hostname', ...scenarioLabelNames],
    registers: [registry],
  });

  const browserResponseCounter = new prom.Counter({
    name: 'browser_response',
    help: 'When the browser receives a response to its http request',
    labelNames: ['hostname', ...scenarioLabelNames],
    registers: [registry],
  });

  const browserRequestDurationHisto = new prom.Histogram({
    name: 'browser_request_duration_seconds',
    help: 'Duration of browser HTTP requests in seconds',
    labelNames: ['hostname', ...scenarioLabelNames],
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
    help: 'CPU usage (% of one core) of each browser process rendering pages (tab), sampled every 5 s',
    labelNames: ['browser'],
    buckets: CPU_PERCENT_BUCKETS,
    registers: [registry],
  });

  const ramPerTabHisto = new prom.Histogram({
    name: 'dsd_tab_ram_kb',
    help: 'Memory (kB, proportional set size) of each browser process rendering pages (tab), sampled every 5 s',
    labelNames: ['browser'],
    buckets: RAM_KB_BUCKETS,
    registers: [registry],
  });

  const cpuPerPodHisto = new prom.Histogram({
    name: 'dsd_pod_cpu_percent',
    help: 'CPU usage (% of one core) of the whole browser (all its processes), sampled every 5 s',
    labelNames: ['browser'],
    buckets: CPU_PERCENT_BUCKETS,
    registers: [registry],
  });

  const ramPerPodHisto = new prom.Histogram({
    name: 'dsd_pod_ram_kb',
    help: 'Memory (kB, proportional set size) of the whole browser (all its processes), sampled every 5 s',
    labelNames: ['browser'],
    buckets: RAM_KB_BUCKETS,
    registers: [registry],
  });

  return {
    browserStarted(name, status) {
      startedBrowserCounter.inc({ browser: name, status });
    },
    browserTabStarted(status, scenario, iteration) {
      startedBrowserTabCounter.inc({ status, ...scenarioLabels(scenario, iteration) });
    },
    browserLogLine() {
      browserLogLineCounter.inc();
    },
    browserRequest(hostname, scenario, iteration) {
      browserRequestCounter.inc({ hostname, ...scenarioLabels(scenario, iteration) });
    },
    browserRequestFinished(hostname, scenario, iteration) {
      browserRequestFinishedCounter.inc({ hostname, ...scenarioLabels(scenario, iteration) });
    },
    browserRequestFailed(hostname, scenario, iteration) {
      browserRequestFailedCounter.inc({ hostname, ...scenarioLabels(scenario, iteration) });
    },
    browserResponse(hostname, scenario, iteration) {
      browserResponseCounter.inc({ hostname, ...scenarioLabels(scenario, iteration) });
    },
    browserRequestDuration(hostname, scenario, iteration, durationSec) {
      browserRequestDurationHisto.observe(
        { hostname, ...scenarioLabels(scenario, iteration) },
        durationSec
      );
    },
    browserError() {
      browserErrorCounter.inc();
    },
    resourcesConsumptionPerTab(browser, ram, cpu) {
      ramPerTabHisto.labels(browser).observe(ram);
      cpuPerTabHisto.labels(browser).observe(cpu);
    },
    resourcesConsumptionPerPod(browser, ram, cpu) {
      ramPerPodHisto.labels(browser).observe(ram);
      cpuPerPodHisto.labels(browser).observe(cpu);
    },
  };
};
