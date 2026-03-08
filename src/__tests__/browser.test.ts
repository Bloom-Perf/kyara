import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
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

jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn<() => Buffer>(),
}));

jest.unstable_mockModule('@bloom-perf/yaml-pptr', () => ({
  readYamlAndInterpret: jest.fn<() => any>(),
}));

// Import mocked modules
const puppeteerMock = await import('puppeteer');
const fsMock = await import('fs');
const childProcessMock = await import('child_process');
const ypMock = await import('@bloom-perf/yaml-pptr');

// Import module under test after mocks are set up
const { launchBrowsers } = await import('../browser.js');

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
  (ypMock.readYamlAndInterpret as jest.Mock<any>).mockResolvedValue(undefined);
};

describe('launchBrowsers', () => {
  let mockConf: Conf;
  let mockLogger: Logger;
  let mockMetricsEmitter: MetricsEmitter;
  let mockBrowser: Partial<Browser>;
  let mockPage: Partial<Page>;
  let processExitHandlers: Array<() => void>;
  let originalProcessOn: typeof process.on;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Capture process.on('exit') handlers
    processExitHandlers = [];
    originalProcessOn = process.on.bind(process);
    (process as any).on = jest.fn((event: string, handler: () => void) => {
      if (event === 'exit') {
        processExitHandlers.push(handler);
      }
      return process;
    });

    // Setup mock config
    mockConf = {
      appName: 'test-app',
      yamlFilePath: '/test/scenario.yaml',
      httpPort: 3000,
      httpMetricsRoute: '/metrics',
      livenessProbeRoute: '/live',
      headless: true,
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
      tabDelayBeforeLaunch: jest.fn(),
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
    };

    // Setup puppeteer.launch mock
    (puppeteerMock.default.launch as jest.Mock<() => Promise<any>>).mockResolvedValue(mockBrowser);

    // Setup fs.readFileSync mock
    (fsMock.readFileSync as unknown as jest.Mock).mockReturnValue('scenarios: []');

    // Setup execSync mock - return empty string by default
    (childProcessMock.execSync as unknown as jest.Mock).mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    process.on = originalProcessOn;
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
  });

  it('should emit browserStarted metric on successful launch', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockMetricsEmitter.browserStarted).toHaveBeenCalledWith('firefox', Status.Success);
  });

  it('should log browser start message', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockLogger.info).toHaveBeenCalledWith('Start browser');
  });

  it('should register process exit handler', async () => {
    setupYpMockNoCallback();

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function));
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

  it('should emit browserRequestDuration when requestfinished fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    setupYpMock(mockPage, { scenarioName: 'Latency Test', workerIndex: 0, iteration: 0 });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Simulate request then requestfinished
    const mockRequest = { url: () => 'https://example.com/api/data' } as HTTPRequest;
    pageEventHandlers['request'](mockRequest);

    // Advance time slightly to simulate latency
    jest.advanceTimersByTime(150);

    pageEventHandlers['requestfinished'](mockRequest);

    expect(mockMetricsEmitter.browserRequestDuration).toHaveBeenCalledWith(
      'example.com',
      'Latency Test',
      0,
      expect.any(Number)
    );
  });

  it('should collect CPU/RAM metrics from execSync output', async () => {
    setupYpMockNoCallback();

    // Mock execSync to return CPU-RAM pairs (no trailing newline to avoid NaN)
    (childProcessMock.execSync as unknown as jest.Mock).mockReturnValue(
      Buffer.from('10-2048\n20-4096')
    );

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Advance timer to trigger fetchTabsRamCpuConsumption
    jest.advanceTimersByTime(0);

    expect(mockMetricsEmitter.resourcesConsumptionPerTab).toHaveBeenCalledWith('firefox', 2048, 10);
    expect(mockMetricsEmitter.resourcesConsumptionPerTab).toHaveBeenCalledWith('firefox', 4096, 20);
    expect(mockMetricsEmitter.resourcesConsumptionPerPod).toHaveBeenCalledWith('firefox', 6144, 30);
  });

  it('should handle execSync errors gracefully', async () => {
    setupYpMockNoCallback();

    // Mock execSync to throw an error
    (childProcessMock.execSync as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('Command failed');
    });

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // Advance timer to trigger fetchTabsRamCpuConsumption
    jest.advanceTimersByTime(0);

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should schedule resource monitoring every 5 seconds', async () => {
    setupYpMockNoCallback();
    (childProcessMock.execSync as unknown as jest.Mock).mockReturnValue(Buffer.from(''));

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    // First call happens immediately
    expect(childProcessMock.execSync).toHaveBeenCalledTimes(1);

    // Advance timer by 5 seconds
    jest.advanceTimersByTime(5000);
    expect(childProcessMock.execSync).toHaveBeenCalledTimes(2);

    // Advance timer by another 5 seconds
    jest.advanceTimersByTime(5000);
    expect(childProcessMock.execSync).toHaveBeenCalledTimes(3);
  });
});
