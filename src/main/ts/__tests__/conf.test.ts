import { createConf, Conf } from '../conf';

describe('createConf', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
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
      headless: true
    });

    expect(conf.httpPort).toBe(3000);
    expect(conf.httpMetricsRoute).toBe('/custom-metrics');
    expect(conf.headless).toBe(true);
  });
});
