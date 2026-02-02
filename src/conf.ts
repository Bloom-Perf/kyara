import chalk from 'chalk';
import { Logger } from 'winston';

export type Conf = {
  appName: string;
  yamlFilePath: string;
  httpPort: number;
  httpMetricsRoute: string;
  livenessProbeRoute: string;
  headless: boolean;
};

export type ConfOverrides = Partial<{
  now: Date;
  httpPort: number;
  httpMetricsRoute: string;
  livenessProbeRoute: string;
  headless: boolean;
}>;

export const logConf = (conf: Conf, logger: Logger) => {
  logger.debug('Starting Kyara server with the following configuration:');

  logger.debug(
    Object.entries(conf)
      .filter((v) => typeof v[1] !== 'function')
      .map(
        ([key, value]) =>
          '\t- ' + chalk.blueBright(key) + '\t-> ' + chalk.yellowBright(value.toString())
      )
      .join('\n')
  );
};

export const createConf = (overrides: ConfOverrides): Conf => {
  return {
    appName: process.env.KYARA_APP_NAME || 'kyara-puppet',
    yamlFilePath: process.env.KYARA_YAML_FILE_PATH || '/var/config/kyara.yaml',
    headless:
      (overrides.headless !== undefined && overrides.headless) || !!process.env.KYARA_HEADLESS,
    httpPort: overrides.httpPort || parseInt(process.env.KYARA_HTTP_PORT || '0'),
    livenessProbeRoute:
      overrides.livenessProbeRoute || process.env.KYARA_HTTP_LIVENESS_PROBE_ROUTE || '/live',
    httpMetricsRoute:
      overrides.httpMetricsRoute || process.env.KYARA_HTTP_METRICS_ROUTE || '/metrics',
  };
};
