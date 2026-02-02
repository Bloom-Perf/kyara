import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { Browser, Page, HTTPRequest, HTTPResponse, ConsoleMessage } from 'puppeteer';
import type { Logger } from 'winston';
import type { MetricsEmitter } from '../metrics.js';
import type { Conf } from '../conf.js';
import { Status } from '../metrics.js';

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
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(fsMock.readFileSync).toHaveBeenCalledWith('/test/scenario.yaml', { encoding: 'utf8' });
  });

  it('should launch puppeteer with Firefox browser', async () => {
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

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
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockMetricsEmitter.browserStarted).toHaveBeenCalledWith('firefox', Status.Success);
  });

  it('should log browser start message', async () => {
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockLogger.info).toHaveBeenCalledWith('Start browser');
  });

  it('should register process exit handler', async () => {
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function));
  });

  it('should run scenarios with tab callback', async () => {
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockRunScenarios).toHaveBeenCalledWith(mockBrowser, expect.any(Function));
  });

  it('should emit browserTabStarted metric when tab callback is invoked', async () => {
    let tabCallback: (page: Page) => Promise<void>;
    const mockRunScenarios = jest.fn<any>().mockImplementation((browser: any, callback: any) => {
      tabCallback = callback;
      return Promise.resolve();
    });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await tabCallback!(mockPage as any);

    expect(mockMetricsEmitter.browserTabStarted).toHaveBeenCalledWith(Status.Success);
  });

  it('should register page event handlers', async () => {
    let tabCallback: (page: Page) => Promise<void>;
    const mockRunScenarios = jest.fn<any>().mockImplementation((browser: any, callback: any) => {
      tabCallback = callback;
      return Promise.resolve();
    });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await tabCallback!(mockPage as any);

    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('requestfinished', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
  });

  it('should emit browserRequest metric when request event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    let tabCallback: (page: Page) => Promise<void>;
    const mockRunScenarios = jest.fn<any>().mockImplementation((browser: any, callback: any) => {
      tabCallback = callback;
      return Promise.resolve();
    });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await tabCallback!(mockPage as any);

    // Simulate request event
    const mockRequest = { url: () => 'https://example.com/api/test' } as HTTPRequest;
    pageEventHandlers['request'](mockRequest);

    expect(mockMetricsEmitter.browserRequest).toHaveBeenCalledWith('example.com');
  });

  it('should emit browserResponse metric when response event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    let tabCallback: (page: Page) => Promise<void>;
    const mockRunScenarios = jest.fn<any>().mockImplementation((browser: any, callback: any) => {
      tabCallback = callback;
      return Promise.resolve();
    });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await tabCallback!(mockPage as any);

    // Simulate response event
    const mockResponse = { url: () => 'https://example.com/api/test' } as HTTPResponse;
    pageEventHandlers['response'](mockResponse);

    expect(mockMetricsEmitter.browserResponse).toHaveBeenCalledWith('example.com');
  });

  it('should emit browserError and log when error event fires', async () => {
    const pageEventHandlers: Record<string, Function> = {};
    mockPage.on = jest.fn<any>((event: string, handler: Function) => {
      pageEventHandlers[event] = handler;
      return mockPage as Page;
    });

    let tabCallback: (page: Page) => Promise<void>;
    const mockRunScenarios = jest.fn<any>().mockImplementation((browser: any, callback: any) => {
      tabCallback = callback;
      return Promise.resolve();
    });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await tabCallback!(mockPage as any);

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

    let tabCallback: (page: Page) => Promise<void>;
    const mockRunScenarios = jest.fn<any>().mockImplementation((browser: any, callback: any) => {
      tabCallback = callback;
      return Promise.resolve();
    });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);
    await tabCallback!(mockPage as any);

    // Simulate console event
    const mockConsoleMessage = { text: () => 'Console log message' } as ConsoleMessage;
    pageEventHandlers['console'](mockConsoleMessage);

    expect(mockMetricsEmitter.browserLogLine).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Console log message',
      expect.objectContaining({ tags: ['BROWSER_LOG'] })
    );
  });

  it('should handle tab callback errors and emit error status', async () => {
    const mockRunScenarios = jest
      .fn<any>()
      .mockImplementation(async (browser: any, callback: any) => {
        const errorPage = {
          on: jest.fn<any>().mockImplementation(() => {
            throw new Error('Page setup failed');
          }),
        };
        await callback(errorPage);
      });
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

    await launchBrowsers(mockConf, mockLogger, mockMetricsEmitter);

    expect(mockMetricsEmitter.browserTabStarted).toHaveBeenCalledWith(Status.Error);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should collect CPU/RAM metrics from execSync output', async () => {
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

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
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);

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
    const mockRunScenarios = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (ypMock.readYamlAndInterpret as jest.Mock<() => any>).mockReturnValue(mockRunScenarios);
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
