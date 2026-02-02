import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { createConf, logConf, Conf } from '../conf.js';

describe('createConf', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default values when no env vars or overrides', () => {
    delete process.env.KYARA_APP_NAME;
    delete process.env.KYARA_YAML_FILE_PATH;
    delete process.env.KYARA_HEADLESS;
    delete process.env.KYARA_HTTP_PORT;
    delete process.env.KYARA_HTTP_LIVENESS_PROBE_ROUTE;
    delete process.env.KYARA_HTTP_METRICS_ROUTE;

    const conf = createConf({});

    expect(conf.appName).toBe('kyara-puppet');
    expect(conf.yamlFilePath).toBe('/var/config/kyara.yaml');
    expect(conf.headless).toBe(false);
    expect(conf.httpPort).toBe(0);
    expect(conf.livenessProbeRoute).toBe('/live');
    expect(conf.httpMetricsRoute).toBe('/metrics');
  });

  it('should use environment variables when set', () => {
    process.env.KYARA_APP_NAME = 'test-app';
    process.env.KYARA_YAML_FILE_PATH = '/custom/path.yaml';
    process.env.KYARA_HEADLESS = 'true';
    process.env.KYARA_HTTP_PORT = '8080';
    process.env.KYARA_HTTP_LIVENESS_PROBE_ROUTE = '/health';
    process.env.KYARA_HTTP_METRICS_ROUTE = '/prometheus';

    const conf = createConf({});

    expect(conf.appName).toBe('test-app');
    expect(conf.yamlFilePath).toBe('/custom/path.yaml');
    expect(conf.headless).toBe(true);
    expect(conf.httpPort).toBe(8080);
    expect(conf.livenessProbeRoute).toBe('/health');
    expect(conf.httpMetricsRoute).toBe('/prometheus');
  });

  it('should prefer overrides over environment variables', () => {
    process.env.KYARA_HTTP_PORT = '8080';
    process.env.KYARA_HTTP_METRICS_ROUTE = '/prometheus';

    const conf = createConf({
      httpPort: 3000,
      httpMetricsRoute: '/custom-metrics',
      headless: true,
    });

    expect(conf.httpPort).toBe(3000);
    expect(conf.httpMetricsRoute).toBe('/custom-metrics');
    expect(conf.headless).toBe(true);
  });
});

describe('logConf', () => {
  it('should call logger.debug with configuration details', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const conf: Conf = {
      appName: 'test-app',
      yamlFilePath: '/test/path.yaml',
      httpPort: 3000,
      httpMetricsRoute: '/metrics',
      livenessProbeRoute: '/live',
      headless: true,
    };

    logConf(conf, mockLogger as any);

    expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    expect(mockLogger.debug).toHaveBeenNthCalledWith(
      1,
      'Starting Kyara server with the following configuration:'
    );
  });

  it('should format configuration entries', () => {
    const debugCalls: string[] = [];
    const mockLogger = {
      debug: jest.fn((msg: string) => debugCalls.push(msg)),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const conf: Conf = {
      appName: 'my-app',
      yamlFilePath: '/config/test.yaml',
      httpPort: 8080,
      httpMetricsRoute: '/prom',
      livenessProbeRoute: '/health',
      headless: false,
    };

    logConf(conf, mockLogger as any);

    expect(debugCalls.length).toBe(2);
    expect(debugCalls[1]).toContain('appName');
    expect(debugCalls[1]).toContain('yamlFilePath');
    expect(debugCalls[1]).toContain('httpPort');
  });
});
