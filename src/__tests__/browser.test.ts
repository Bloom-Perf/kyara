import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Asynchronous mocks: jest-mock 30.5 no longer infers resolved values from jest.fn<any>()
type AsyncFn = (...args: any[]) => Promise<any>;
import type { Browser, Page, HTTPRequest, HTTPResponse, ConsoleMessage } from 'puppeteer';
import type { Logger } from 'winston';
import type { MetricsEmitter } from '../metrics.js';
import type { Conf } from '../conf.js';
import { Status } from '../metrics.js';

const defaultCtx = { scenarioName: 'Test Scenario', workerIndex: 0, iteration: 0 };

// Mock modules before importing the module under test
jest.unstable_mockModule('puppeteer', () => ({
  default: {
    launch: jest.fn<() => Promise<any>>(),
  },
}));

jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn<() => string>(),
}));

const mockResourceMonitor = {
  watch: jest.fn(),
  sample: jest.fn(),
  stop: jest.fn(),
};
jest.unstable_mockModule('../resources.js', () => ({
  createResourceMonitor: jest.fn(() => mockResourceMonitor),
}));

jest.unstable_mockModule('@bloom-perf/yaml-pptr', () => ({
  readYamlAndInterpret: jest.fn<() => any>(),
}));

// Import mocked modules
const puppeteerMock = await import('puppeteer');
const fsMock = await import('fs');
const resourcesMock = await import('../resources.js');
const ypMock = await import('@bloom-perf/yaml-pptr');

// Import module under test after mocks are set up
const { launchBrowsers, closeBrowsers } = await import('../browser.js');

// Helper: setup readYamlAndInterpret mock that calls onPage with given context
const setupYpMock = (page: any, ctx = defaultCtx) => {
  (ypMock.readYamlAndInterpret as jest.Mock<any>).mockImplementation(
    async (_yaml: any, options: any) => {
      if (options?.onPage) {
        await options.onPage(page, ctx);
      }
    }
  );
};

// Helper: setup readYamlAndInterpret mock that does NOT call onPage
const setupYpMockNoCallback = () => {
  (ypMock.readYamlAndInterpret as jest.Mock<AsyncFn>).mockResolvedValue(undefined);
};

describe('launchBrowsers', () => {
  let mockConf: Conf;
  let mockLogger: Logger;
  let mockMetricsEmitter: MetricsEmitter;
  let mockBrowser: Partial<Browser>;
  let mockPage: Partial<Page>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock config
    mockConf = {
      appName: 'test-app',
      yamlFilePath: '/test/scenario.yaml',
      httpPort: 3000,
      httpMetricsRoute: '/metrics',
      livenessProbeRoute: '/live',
      headless: true,
      metricsIterationLabel: true,
      hikakuBaselinePath: undefined,
      hikakuUpdateBaseline: false,
      hikakuMaxIncreasePercent: 20,
      hikakuReportMode: 'on_fail' as const,
      hikakuReportOutput: 'log' as const,
      hikakuReportFilePath: './hikaku-report.md',
      hikakuReportLocale: 'en' as const,
      hikakuLlmApiKey: undefined,
    };

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    // Setup mock metrics emitter
    mockMetricsEmitter = {
      browserStarted: jest.fn(),
      browserTabStarted: jest.fn(),
      browserLogLine: jest.fn(),
      browserRequest: jest.fn(),
      browserRequestFinished: jest.fn(),
      browserRequestFailed: jest.fn(),
      browserResponse: jest.fn(),
      browserRequestDuration: jest.fn(),
      browserError: jest.fn(),
      resourcesConsumptionPerTab: jest.fn(),
      resourcesConsumptionPerPod: jest.fn(),
    };

    // Setup mock page with event handlers storage
    const pageEventHandlers: Record<string, Function> = {};
    mockPage = {
      on: jest.fn<any>((event: string, handler: Function) => {
        pageEventHandlers[event] = handler;
        return mockPage as Page;
      }),
    };
    (mockPage as any)._eventHandlers = pageEventHandlers;

    // Setup mock browser
    mockBrowser = {
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      once: jest.fn<any>(),
      process: jest.fn<any>(() => ({ pid: 1234 })),
    };

    // Setup puppeteer.launch mock
    (puppeteerMock.default.launch as jest.Mock<() => Promise<any>>).mockResolvedValue(mockBrowser);

    // Setup fs.readFileSync mock
    (fsMock.readFileSync as unknown as jest.Mock).mockReturnValue('scenarios: []');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should read YAML file from config path', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(fsMock.readFileSync).toHaveBeenCalledWith('/test/scenario.yaml', { encoding: 'utf8' });
  });

  it('should launch puppeteer with Firefox browser', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(puppeteerMock.default.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        browser: 'firefox',
        acceptInsecureCerts: true,
      })
    );
    // Chrome-only flags (--no-sandbox, --single-process...) are not passed to Firefox
    expect(puppeteerMock.default.launch).toHaveBeenCalledWith(
      expect.not.objectContaining({ args: expect.anything() })
    );
  });

  it('should emit browserStarted metric with an error status when Firefox cannot start', async () => {
    (puppeteerMock.default.launch as jest.Mock<AsyncFn>).mockRejectedValue(
      new Error('Could not find Firefox')
    );

    await expect(launchBrowsers(mockConf, mockLogger, mockMetricsEmitter)).rejects.toThrow(
      'Could not find Firefox'
    );
    expect(mockMetricsEmitter.browserStarted).toHaveBeenCalledWith('firefox', Status.Error);
    expect(ypMock.readYamlAndInterpret).not.toHaveBeenCalled();
  });

  it('should emit browserStarted metric on successful launch', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockMetricsEmitter.browserStarted).toHaveBeenCalledWith('firefox', Status.Success);
  });

  it('should log browser start message', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockLogger.info).toHaveBeenCalledWith('Launching firefox (headless: true)');
  });

  it('should measure the CPU/RAM of Firefox while the scenarios run', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(resourcesMock.createResourceMonitor).toHaveBeenCalledWith(
      mockMetricsEmitter,
      mockLogger
    );
    expect(mockResourceMonitor.watch).toHaveBeenCalledWith('firefox', 1234);
    expect(mockResourceMonitor.stop).toHaveBeenCalled();
  });

  it('should close Firefox once the scenarios are over, also when some failed', async () => {
    (ypMock.readYamlAndInterpret as jest.Mock<AsyncFn>).mockRejectedValue(
      new AggregateError([new Error('iteration failed')], '1 error(s)')
    );

    await expect(launchBrowsers(mockConf, mockLogger, mockMetricsEmitter)).rejects.toThrow(
      '1 error(s)'
    );
    expect(mockResourceMonitor.stop).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should close the browsers still running on demand (shutdown)', async () => {
    // Scenarios that never end (waitForever)
    (ypMock.readYamlAndInterpret as jest.Mock<any>).mockReturnValue(new Promise(() => {}));
    void launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await jest.advanceTimersByTimeAsync(0);
    expect(mockBrowser.close).not.toHaveBeenCalled();

    await closeBrowsers(mockLogger);

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should not wait more than the timeout for the browsers to close', async () => {
    (ypMock.readYamlAndInterpret as jest.Mock<any>).mockReturnValue(new Promise(() => {}));
    (mockBrowser.close as jest.Mock<any>).mockReturnValue(new Promise(() => {}));
    void launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await jest.advanceTimersByTimeAsync(0);

    const closing = closeBrowsers(mockLogger, 1000);
    await jest.advanceTimersByTimeAsync(1000);

    await expect(closing).resolves.toBeUndefined();
  });

  it('should call readYamlAndInterpret with options object containing browsers and onPage', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(ypMock.readYamlAndInterpret).toHaveBeenCalledWith(
      'scenarios: []',
      expect.objectContaining({
        browsers: expect.objectContaining({ firefox: mockBrowser }),
        onPage: expect.any(Function),
      })
    );
  });

  it('should emit browserTabStarted metric with scenario context when onPage is invoked', async () => {
    setupYpMock(mockPage, { scenarioName: 'Login Flow', workerIndex: 0, iteration: 2 });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockMetricsEmitter.browserTabStarted).toHaveBeenCalledWith(
      Status.Success,
      'Login Flow',
      2
    );
  });

  it('should register page event handlers', async () => {
    setupYpMock(mockPage);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('requestfinished', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
  });

  it('should emit browserRequest metric with scenario labels when request event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage, { scenarioName: 'My Scenario', workerIndex: 0, iteration: 1 });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Simulate request event
    const mockRequest = { url: () => 'https://example.com/api/test' } as HTTPRequest;
    pageEventHandlers['request'](mockRequest);

    expect(mockMetricsEmitter.browserRequest).toHaveBeenCalledWith('example.com', 'My Scenario', 1);
  });

  it('should emit browserResponse metric with scenario labels when response event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage, { scenarioName: 'My Scenario', workerIndex: 0, iteration: 1 });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Simulate response event
    const mockResponse = { url: () => 'https://example.com/api/test' } as HTTPResponse;
    pageEventHandlers['response'](mockResponse);

    expect(mockMetricsEmitter.browserResponse).toHaveBeenCalledWith(
      'example.com',
      'My Scenario',
      1
    );
  });

  it('should emit browserError and log when error event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Simulate error event
    const mockError = new Error('Test error');
    pageEventHandlers['error'](mockError);

    expect(mockMetricsEmitter.browserError).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Test error',
      expect.objectContaining({ tags: ['BROWSER_LOG', 'BROWSER_ERROR'] })
    );
  });

  it('should emit browserLogLine when console event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Simulate console event
    const mockConsoleMessage = { text: () => 'Console log message' } as ConsoleMessage;
    pageEventHandlers['console'](mockConsoleMessage);

    expect(mockMetricsEmitter.browserLogLine).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Console log message',
      expect.objectContaining({ tags: ['BROWSER_LOG'] })
    );
  });

  it('should handle onPage callback errors and emit error status', async () => {
    (ypMock.readYamlAndInterpret as jest.Mock<any>).mockImplementation(
      async (_yaml: any, options: any) => {
        const errorPage = {
          on: jest.fn<any>().mockImplementation(() => {
            throw new Error('Page setup failed');
          }),
        };
        if (options?.onPage) {
          await options.onPage(errorPage, defaultCtx);
        }
      }
    );

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockMetricsEmitter.browserTabStarted).toHaveBeenCalledWith(
      Status.Error,
      'Test Scenario',
      0
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should time each request separately, even with the same URL', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage, { scenarioName: 'Latency Test', workerIndex: 0, iteration: 0 });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Two concurrent requests for the same URL
    const first = { url: () => 'https://example.com/api/data' } as HTTPRequest;
    const second = { url: () => 'https://example.com/api/data' } as HTTPRequest;
    pageEventHandlers['request'](first);
    jest.advanceTimersByTime(100);
    pageEventHandlers['request'](second);
    jest.advanceTimersByTime(50);
    pageEventHandlers['requestfinished'](first);
    jest.advanceTimersByTime(250);
    pageEventHandlers['requestfinished'](second);

    const durations = (mockMetricsEmitter.browserRequestDuration as jest.Mock).mock.calls;
    expect(durations).toHaveLength(2);
    expect(durations[0]).toEqual(['example.com', 'Latency Test', 0, expect.any(Number)]);
    expect(durations[0][3]).toBeCloseTo(0.15, 2);
    expect(durations[1][3]).toBeCloseTo(0.3, 2);
  });

  it('should not time a failed request', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage, { scenarioName: 'Latency Test', workerIndex: 0, iteration: 0 });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    const request = { url: () => 'https://example.com/api/data' } as HTTPRequest;
    pageEventHandlers['request'](request);
    pageEventHandlers['requestfailed'](request);

    expect(mockMetricsEmitter.browserRequestFailed).toHaveBeenCalledWith(
      'example.com',
      'Latency Test',
      0
    );
    expect(mockMetricsEmitter.browserRequestDuration).not.toHaveBeenCalled();
  });
});
