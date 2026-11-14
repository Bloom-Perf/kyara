import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { createConf, logConf, Conf, ConfError } from '../conf.js';

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
    delete process.env.KYARA_HIKAKU_BASELINE_PATH;
    delete process.env.KYARA_HIKAKU_UPDATE_BASELINE;
    delete process.env.KYARA_HIKAKU_MAX_INCREASE_PERCENT;
    delete process.env.KYARA_HIKAKU_REPORT_MODE;
    delete process.env.KYARA_HIKAKU_REPORT_OUTPUT;
    delete process.env.KYARA_HIKAKU_REPORT_FILE_PATH;
    delete process.env.KYARA_HIKAKU_REPORT_LOCALE;
    delete process.env.KYARA_HIKAKU_LLM_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const conf = createConf({});

    expect(conf.appName).toBe('kyara-puppet');
    expect(conf.yamlFilePath).toBe('/var/config/kyara.yaml');
    expect(conf.headless).toBe(false);
    expect(conf.httpPort).toBe(0);
    expect(conf.livenessProbeRoute).toBe('/live');
    expect(conf.httpMetricsRoute).toBe('/metrics');
    expect(conf.hikakuBaselinePath).toBeUndefined();
    expect(conf.hikakuUpdateBaseline).toBe(false);
    expect(conf.hikakuMaxIncreasePercent).toBe(20);
    expect(conf.hikakuReportMode).toBe('on_fail');
    expect(conf.hikakuReportOutput).toBe('log');
    expect(conf.hikakuReportFilePath).toBe('./hikaku-report.md');
    expect(conf.hikakuReportLocale).toBe('en');
    expect(conf.hikakuLlmApiKey).toBeUndefined();
    expect(conf.metricsIterationLabel).toBe(true);
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

  it('should read hikaku environment variables', () => {
    process.env.KYARA_HIKAKU_BASELINE_PATH = '/tmp/baseline.json';
    process.env.KYARA_HIKAKU_UPDATE_BASELINE = 'true';
    process.env.KYARA_HIKAKU_MAX_INCREASE_PERCENT = '15';

    const conf = createConf({});

    expect(conf.hikakuBaselinePath).toBe('/tmp/baseline.json');
    expect(conf.hikakuUpdateBaseline).toBe(true);
    expect(conf.hikakuMaxIncreasePercent).toBe(15);
  });

  it('should read hikaku report environment variables', () => {
    process.env.KYARA_HIKAKU_REPORT_MODE = 'always';
    process.env.KYARA_HIKAKU_REPORT_OUTPUT = 'file';
    process.env.KYARA_HIKAKU_REPORT_FILE_PATH = '/tmp/report.md';
    process.env.KYARA_HIKAKU_REPORT_LOCALE = 'fr';
    process.env.KYARA_HIKAKU_LLM_API_KEY = 'sk-test-key';

    const conf = createConf({});

    expect(conf.hikakuReportMode).toBe('always');
    expect(conf.hikakuReportOutput).toBe('file');
    expect(conf.hikakuReportFilePath).toBe('/tmp/report.md');
    expect(conf.hikakuReportLocale).toBe('fr');
    expect(conf.hikakuLlmApiKey).toBe('sk-test-key');
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

  it('should let a false override win over the environment', () => {
    expect(createConf({ headless: false }, { KYARA_HEADLESS: 'true' }).headless).toBe(false);
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['False', false],
    ['0', false],
    ['no', false],
    ['off', false],
    ['', false],
    [' true ', true],
  ])('should read KYARA_HEADLESS=%j as %s', (value, expected) => {
    expect(createConf({}, { KYARA_HEADLESS: value }).headless).toBe(expected);
  });

  it('should read KYARA_HIKAKU_UPDATE_BASELINE=false as false', () => {
    expect(createConf({}, { KYARA_HIKAKU_UPDATE_BASELINE: 'false' }).hikakuUpdateBaseline).toBe(
      false
    );
  });

  it('should accept a decimal maximum increase', () => {
    expect(
      createConf({}, { KYARA_HIKAKU_MAX_INCREASE_PERCENT: '12.5' }).hikakuMaxIncreasePercent
    ).toBe(12.5);
  });

  it.each([
    ['KYARA_HEADLESS', 'maybe', 'KYARA_HEADLESS="maybe" is not a boolean (true or false)'],
    ['KYARA_HTTP_PORT', 'abc', 'KYARA_HTTP_PORT="abc" is not an integer between 0 and 65535'],
    ['KYARA_HTTP_PORT', '70000', 'KYARA_HTTP_PORT="70000" is not an integer between 0 and 65535'],
    ['KYARA_HTTP_PORT', '30.5', 'KYARA_HTTP_PORT="30.5" is not an integer between 0 and 65535'],
    [
      'KYARA_HIKAKU_MAX_INCREASE_PERCENT',
      '-1',
      'KYARA_HIKAKU_MAX_INCREASE_PERCENT="-1" is not a number >= 0',
    ],
    [
      'KYARA_HIKAKU_REPORT_MODE',
      'never',
      'KYARA_HIKAKU_REPORT_MODE="never" is not one of: off, on_fail, always',
    ],
    [
      'KYARA_HIKAKU_REPORT_OUTPUT',
      'mail',
      'KYARA_HIKAKU_REPORT_OUTPUT="mail" is not one of: log, file',
    ],
    ['KYARA_HIKAKU_REPORT_LOCALE', 'de', 'KYARA_HIKAKU_REPORT_LOCALE="de" is not one of: en, fr'],
  ])('should reject %s=%j', (name, value, message) => {
    expect(() => createConf({}, { [name]: value })).toThrow(new ConfError([message]));
  });

  it('should list every invalid value at once', () => {
    expect(() => createConf({}, { KYARA_HEADLESS: 'maybe', KYARA_HTTP_PORT: 'abc' })).toThrow(
      'Invalid configuration: KYARA_HEADLESS="maybe" is not a boolean (true or false); KYARA_HTTP_PORT="abc" is not an integer between 0 and 65535'
    );
  });

  it('should drop the iteration label when KYARA_METRICS_ITERATION_LABEL=false', () => {
    expect(createConf({}, { KYARA_METRICS_ITERATION_LABEL: 'false' }).metricsIterationLabel).toBe(
      false
    );
  });

  it('should require the iteration label in hikaku mode', () => {
    expect(() =>
      createConf(
        {},
        { KYARA_METRICS_ITERATION_LABEL: 'false', KYARA_HIKAKU_BASELINE_PATH: '/tmp/b.json' }
      )
    ).toThrow(/KYARA_METRICS_ITERATION_LABEL=false cannot be used with KYARA_HIKAKU_BASELINE_PATH/);
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

    logConf(conf, mockLogger as any);

    expect(debugCalls.length).toBe(2);
    expect(debugCalls[1]).toContain('appName');
    expect(debugCalls[1]).toContain('yamlFilePath');
    expect(debugCalls[1]).toContain('httpPort');
    // Plain text: colors would end up as escape codes in the JSON logs
    expect(debugCalls[1]).not.toContain('\u001b[');
  });

  it('should mask sensitive configuration values', () => {
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
      hikakuLlmApiKey: 'sk-ant-secret-key',
    };

    logConf(conf, mockLogger as any);

    expect(debugCalls[1]).toContain('hikakuLlmApiKey');
    expect(debugCalls[1]).toContain('***');
    expect(debugCalls[1]).not.toContain('sk-ant-secret-key');
  });
});
