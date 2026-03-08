import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('main module', () => {
  // Mock objects
  const mockConf = {
    appName: 'test-app',
    yamlFilePath: '/test/scenario.yaml',
    httpPort: 0,
    httpMetricsRoute: '/metrics',
    livenessProbeRoute: '/live',
    headless: true,
    hikakuBaselinePath: undefined as string | undefined,
    hikakuUpdateBaseline: false,
    hikakuMaxIncreasePercent: 20,
    hikakuReportMode: 'on_fail' as 'off' | 'on_fail' | 'always',
    hikakuReportOutput: 'log' as 'log' | 'file',
    hikakuReportFilePath: './hikaku-report.md',
    hikakuReportLocale: 'en' as 'en' | 'fr',
    hikakuLlmApiKey: undefined as string | undefined,
  };

  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockRegistry = {
    setDefaultLabels: jest.fn(),
    contentType: 'text/plain',
    metrics: jest.fn<any>().mockResolvedValue('test_metrics'),
  };

  const mockMetricsEmitter = {
    browserStarted: jest.fn(),
    browserTabStarted: jest.fn(),
  };

  let mockAppGet: jest.Mock<any>;
  let mockAppListen: jest.Mock<any>;
  let mockApp: { get: jest.Mock<any>; listen: jest.Mock<any> };

  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  // Store captured route handlers
  let capturedMetricsHandler: ((req: any, res: any, next?: any) => Promise<void>) | null = null;
  let capturedLivenessHandler: ((req: any, res: any) => void) | null = null;

  // Mock module references
  let confMock: any;
  let loggerMock: any;
  let metricsMock: any;
  let browserMock: any;
  let expressMock: any;
  let promClientMock: any;
  let hikakuMock: any;
  let fsMock: any;

  beforeEach(async () => {
    // Reset modules before each test
    jest.resetModules();
    jest.clearAllMocks();

    // Reset captured handlers
    capturedMetricsHandler = null;
    capturedLivenessHandler = null;

    // Create fresh mock app for each test
    mockAppGet = jest.fn<any>().mockImplementation((route: string, handler: Function) => {
      if (route === '/metrics') {
        capturedMetricsHandler = handler as any;
      } else if (route === '/live') {
        capturedLivenessHandler = handler as any;
      }
      return mockApp;
    });
    mockAppListen = jest.fn<any>().mockResolvedValue(undefined);
    mockApp = {
      get: mockAppGet,
      listen: mockAppListen,
    };

    // Setup mocks
    jest.unstable_mockModule('../conf.js', () => ({
      createConf: jest.fn(() => mockConf),
      logConf: jest.fn(),
    }));

    jest.unstable_mockModule('../logger.js', () => ({
      createLogger: jest.fn(() => mockLogger),
    }));

    jest.unstable_mockModule('../metrics.js', () => ({
      createPromRegister: jest.fn(() => mockRegistry),
      createMetricsEmitter: jest.fn(() => mockMetricsEmitter),
    }));

    jest.unstable_mockModule('../browser.js', () => ({
      launchBrowsers: jest.fn<any>().mockResolvedValue(undefined),
    }));

    jest.unstable_mockModule('express', () => ({
      default: jest.fn(() => mockApp),
    }));

    jest.unstable_mockModule('prom-client', () => ({
      collectDefaultMetrics: jest.fn(),
    }));

    jest.unstable_mockModule('@bloom-perf/hikaku', () => ({
      createSnapshot: jest
        .fn<any>()
        .mockResolvedValue({ timestamp: 'test', scenarios: [], resources: [] }),
      saveBaseline: jest.fn(),
      loadBaseline: jest.fn(() => ({
        version: 1,
        createdAt: 'test',
        snapshot: { timestamp: 'test', scenarios: [], resources: [] },
      })),
      baselineExists: jest.fn(() => false),
      compare: jest.fn(() => ({
        timestamp: 'test',
        overallVerdict: 'pass',
        scenarios: [],
        summary: { totalScenarios: 0, passed: 0, failed: 0, regressions: [] },
      })),
      generateReport: jest.fn<any>().mockResolvedValue('## LLM Report\n\nAll good!'),
      createAnthropicProvider: jest.fn(() => ({ complete: jest.fn() })),
    }));

    jest.unstable_mockModule('fs', () => ({
      writeFileSync: jest.fn(),
    }));

    // Import mocked modules
    confMock = await import('../conf.js');
    loggerMock = await import('../logger.js');
    metricsMock = await import('../metrics.js');
    browserMock = await import('../browser.js');
    expressMock = await import('express');
    promClientMock = await import('prom-client');
    hikakuMock = await import('@bloom-perf/hikaku');
    fsMock = await import('fs');

    // Reset hikaku-related mockConf fields
    mockConf.hikakuBaselinePath = undefined;
    mockConf.hikakuUpdateBaseline = false;
    mockConf.hikakuMaxIncreasePercent = 20;
    mockConf.hikakuReportMode = 'on_fail';
    mockConf.hikakuReportOutput = 'log';
    mockConf.hikakuReportFilePath = './hikaku-report.md';
    mockConf.hikakuReportLocale = 'en';
    mockConf.hikakuLlmApiKey = undefined;

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should initialize configuration', async () => {
    await import('../main.js');

    expect(confMock.createConf).toHaveBeenCalledWith({});
  });

  it('should create logger', async () => {
    await import('../main.js');

    expect(loggerMock.createLogger).toHaveBeenCalled();
  });

  it('should log configuration', async () => {
    await import('../main.js');

    expect(confMock.logConf).toHaveBeenCalledWith(mockConf, mockLogger);
  });

  it('should create Prometheus registry with default labels', async () => {
    await import('../main.js');

    expect(metricsMock.createPromRegister).toHaveBeenCalled();
    expect(mockRegistry.setDefaultLabels).toHaveBeenCalledWith({ app: 'test-app' });
  });

  it('should create metrics emitter', async () => {
    await import('../main.js');

    expect(metricsMock.createMetricsEmitter).toHaveBeenCalledWith(mockRegistry);
  });

  it('should collect default Prometheus metrics', async () => {
    await import('../main.js');

    expect(promClientMock.collectDefaultMetrics).toHaveBeenCalledWith({ register: mockRegistry });
  });

  it('should launch browsers', async () => {
    await import('../main.js');

    expect(browserMock.launchBrowsers).toHaveBeenCalledWith(
      mockConf,
      mockLogger,
      mockMetricsEmitter
    );
  });

  it('should setup Express server with metrics endpoint', async () => {
    await import('../main.js');

    expect(expressMock.default).toHaveBeenCalled();
    expect(mockAppGet).toHaveBeenCalledWith('/metrics', expect.any(Function));
  });

  it('should setup Express server with liveness probe endpoint', async () => {
    await import('../main.js');

    expect(mockAppGet).toHaveBeenCalledWith('/live', expect.any(Function));
  });

  it('should start Express server on configured port', async () => {
    await import('../main.js');

    expect(mockAppListen).toHaveBeenCalledWith(0);
  });

  it('should return metrics with correct content type when metrics endpoint is called', async () => {
    await import('../main.js');

    expect(capturedMetricsHandler).not.toBeNull();

    const mockRes = {
      set: jest.fn(),
      end: jest.fn(),
    };

    await capturedMetricsHandler!({}, mockRes, undefined);

    expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(mockRegistry.metrics).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalledWith('test_metrics');
  });

  it('should return health check response when liveness endpoint is called', async () => {
    await import('../main.js');

    expect(capturedLivenessHandler).not.toBeNull();

    const mockRes = {
      send: jest.fn(),
    };

    capturedLivenessHandler!({}, mockRes);

    expect(mockRes.send).toHaveBeenCalledWith('Health check passed');
  });

  it('should handle browser launch errors', async () => {
    // Reset modules and setup error mock
    jest.resetModules();

    const testError = new Error('Browser launch failed');

    jest.unstable_mockModule('../conf.js', () => ({
      createConf: jest.fn(() => mockConf),
      logConf: jest.fn(),
    }));

    jest.unstable_mockModule('../logger.js', () => ({
      createLogger: jest.fn(() => mockLogger),
    }));

    jest.unstable_mockModule('../metrics.js', () => ({
      createPromRegister: jest.fn(() => mockRegistry),
      createMetricsEmitter: jest.fn(() => mockMetricsEmitter),
    }));

    jest.unstable_mockModule('../browser.js', () => ({
      launchBrowsers: jest.fn<any>().mockRejectedValue(testError),
    }));

    jest.unstable_mockModule('express', () => ({
      default: jest.fn(() => mockApp),
    }));

    jest.unstable_mockModule('prom-client', () => ({
      collectDefaultMetrics: jest.fn(),
    }));

    jest.unstable_mockModule('@bloom-perf/hikaku', () => ({
      createSnapshot: jest
        .fn<any>()
        .mockResolvedValue({ timestamp: 'test', scenarios: [], resources: [] }),
      saveBaseline: jest.fn(),
      loadBaseline: jest.fn(),
      baselineExists: jest.fn(() => false),
      compare: jest.fn(),
      generateReport: jest.fn<any>().mockResolvedValue(''),
      createAnthropicProvider: jest.fn(() => ({ complete: jest.fn() })),
    }));

    jest.unstable_mockModule('fs', () => ({
      writeFileSync: jest.fn(),
    }));

    await import('../main.js');

    // Wait for the promise rejection to be caught
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fatal error when launching browsers')
    );
  });

  it('should not call hikaku when hikakuBaselinePath is not set', async () => {
    mockConf.hikakuBaselinePath = undefined;

    await import('../main.js');

    expect(hikakuMock.createSnapshot).not.toHaveBeenCalled();
  });

  it('should save baseline when hikakuUpdateBaseline is true', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = true;

    await import('../main.js');

    expect(hikakuMock.createSnapshot).toHaveBeenCalledWith(mockRegistry);
    expect(hikakuMock.saveBaseline).toHaveBeenCalledWith(
      { timestamp: 'test', scenarios: [], resources: [] },
      '/tmp/baseline.json'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Hikaku: baseline saved'));
  });

  it('should compare against baseline when baseline exists and report pass', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = false;
    (hikakuMock.baselineExists as jest.Mock<any>).mockReturnValue(true);
    (hikakuMock.compare as jest.Mock<any>).mockReturnValue({
      timestamp: 'test',
      overallVerdict: 'pass',
      scenarios: [],
      summary: { totalScenarios: 1, passed: 1, failed: 0, regressions: [] },
    });

    await import('../main.js');

    expect(hikakuMock.createSnapshot).toHaveBeenCalledWith(mockRegistry);
    expect(hikakuMock.loadBaseline).toHaveBeenCalledWith('/tmp/baseline.json');
    expect(hikakuMock.compare).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('pass'));
  });

  it('should exit with code 1 when hikaku comparison fails', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = false;
    (hikakuMock.baselineExists as jest.Mock<any>).mockReturnValue(true);
    (hikakuMock.compare as jest.Mock<any>).mockReturnValue({
      timestamp: 'test',
      overallVerdict: 'fail',
      scenarios: [],
      summary: {
        totalScenarios: 1,
        passed: 0,
        failed: 1,
        regressions: [
          {
            metricName: 'p95_latency',
            baselineValue: 0.5,
            currentValue: 0.8,
            deltaPercent: 60,
            status: 'regression',
          },
        ],
      },
    });

    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await import('../main.js');

    expect(hikakuMock.compare).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Hikaku regression'));
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should generate LLM report on fail when report mode is on_fail and API key is set', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = false;
    mockConf.hikakuReportMode = 'on_fail';
    mockConf.hikakuLlmApiKey = 'sk-test';
    (hikakuMock.baselineExists as jest.Mock<any>).mockReturnValue(true);
    (hikakuMock.compare as jest.Mock<any>).mockReturnValue({
      timestamp: 'test',
      overallVerdict: 'fail',
      scenarios: [],
      summary: {
        totalScenarios: 1,
        passed: 0,
        failed: 1,
        regressions: [
          {
            metricName: 'p95_latency',
            baselineValue: 0.5,
            currentValue: 0.8,
            deltaPercent: 60,
            status: 'regression',
          },
        ],
      },
    });

    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await import('../main.js');

    expect(hikakuMock.createAnthropicProvider).toHaveBeenCalledWith('sk-test');
    expect(hikakuMock.generateReport).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('LLM Report'));

    processExitSpy.mockRestore();
  });

  it('should not generate LLM report when report mode is off', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = false;
    mockConf.hikakuReportMode = 'off';
    mockConf.hikakuLlmApiKey = 'sk-test';
    (hikakuMock.baselineExists as jest.Mock<any>).mockReturnValue(true);
    (hikakuMock.compare as jest.Mock<any>).mockReturnValue({
      timestamp: 'test',
      overallVerdict: 'fail',
      scenarios: [],
      summary: {
        totalScenarios: 1,
        passed: 0,
        failed: 1,
        regressions: [
          {
            metricName: 'p95_latency',
            baselineValue: 0.5,
            currentValue: 0.8,
            deltaPercent: 60,
            status: 'regression',
          },
        ],
      },
    });

    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await import('../main.js');

    expect(hikakuMock.generateReport).not.toHaveBeenCalled();

    processExitSpy.mockRestore();
  });

  it('should not generate LLM report when API key is missing', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = false;
    mockConf.hikakuReportMode = 'on_fail';
    mockConf.hikakuLlmApiKey = undefined;
    (hikakuMock.baselineExists as jest.Mock<any>).mockReturnValue(true);
    (hikakuMock.compare as jest.Mock<any>).mockReturnValue({
      timestamp: 'test',
      overallVerdict: 'fail',
      scenarios: [],
      summary: {
        totalScenarios: 1,
        passed: 0,
        failed: 1,
        regressions: [
          {
            metricName: 'p95_latency',
            baselineValue: 0.5,
            currentValue: 0.8,
            deltaPercent: 60,
            status: 'regression',
          },
        ],
      },
    });

    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await import('../main.js');

    expect(hikakuMock.generateReport).not.toHaveBeenCalled();

    processExitSpy.mockRestore();
  });

  it('should save LLM report to file when report output is file', async () => {
    mockConf.hikakuBaselinePath = '/tmp/baseline.json';
    mockConf.hikakuUpdateBaseline = false;
    mockConf.hikakuReportMode = 'always';
    mockConf.hikakuReportOutput = 'file';
    mockConf.hikakuReportFilePath = '/tmp/report.md';
    mockConf.hikakuLlmApiKey = 'sk-test';
    (hikakuMock.baselineExists as jest.Mock<any>).mockReturnValue(true);
    (hikakuMock.compare as jest.Mock<any>).mockReturnValue({
      timestamp: 'test',
      overallVerdict: 'pass',
      scenarios: [],
      summary: { totalScenarios: 1, passed: 1, failed: 0, regressions: [] },
    });

    await import('../main.js');

    expect(hikakuMock.generateReport).toHaveBeenCalled();
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      '/tmp/report.md',
      '## LLM Report\n\nAll good!',
      'utf-8'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('LLM report saved to'));
  });
});
