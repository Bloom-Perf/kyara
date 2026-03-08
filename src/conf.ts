import chalk from 'chalk';
import { Logger } from 'winston';

export type Conf = {
  appName: string;
  yamlFilePath: string;
  httpPort: number;
  httpMetricsRoute: string;
  livenessProbeRoute: string;
  headless: boolean;
  hikakuBaselinePath: string | undefined;
  hikakuUpdateBaseline: boolean;
  hikakuMaxIncreasePercent: number;
  hikakuReportMode: 'off' | 'on_fail' | 'always';
  hikakuReportOutput: 'log' | 'file';
  hikakuReportFilePath: string;
  hikakuReportLocale: 'en' | 'fr';
  hikakuLlmApiKey: string | undefined;
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
      .filter((v) => typeof v[1] !== 'function' && v[1] !== undefined)
      .map(
        ([key, value]) =>
          '\t- ' + chalk.blueBright(key) + '\t-> ' + chalk.yellowBright(String(value))
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
    hikakuBaselinePath: process.env.KYARA_HIKAKU_BASELINE_PATH || undefined,
    hikakuUpdateBaseline: !!process.env.KYARA_HIKAKU_UPDATE_BASELINE,
    hikakuMaxIncreasePercent: parseInt(process.env.KYARA_HIKAKU_MAX_INCREASE_PERCENT || '20'),
    hikakuReportMode:
      (process.env.KYARA_HIKAKU_REPORT_MODE as 'off' | 'on_fail' | 'always') || 'on_fail',
    hikakuReportOutput: (process.env.KYARA_HIKAKU_REPORT_OUTPUT as 'log' | 'file') || 'log',
    hikakuReportFilePath: process.env.KYARA_HIKAKU_REPORT_FILE_PATH || './hikaku-report.md',
    hikakuReportLocale: (process.env.KYARA_HIKAKU_REPORT_LOCALE as 'en' | 'fr') || 'en',
    hikakuLlmApiKey:
      process.env.KYARA_HIKAKU_LLM_API_KEY || process.env.ANTHROPIC_API_KEY || undefined,
  };
};
