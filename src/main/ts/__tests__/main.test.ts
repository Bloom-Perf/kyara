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

    // Import mocked modules
    confMock = await import('../conf.js');
    loggerMock = await import('../logger.js');
    metricsMock = await import('../metrics.js');
    browserMock = await import('../browser.js');
    expressMock = await import('express');
    promClientMock = await import('prom-client');

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

    await import('../main.js');

    // Wait for the promise rejection to be caught
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fatal error when launching browsers')
    );
  });
});
