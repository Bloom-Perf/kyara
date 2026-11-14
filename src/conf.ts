import { Logger } from 'winston';

const REPORT_MODES = ['off', 'on_fail', 'always'] as const;
const REPORT_OUTPUTS = ['log', 'file'] as const;
const REPORT_LOCALES = ['en', 'fr'] as const;

export type Conf = {
  appName: string;
  yamlFilePath: string;
  httpPort: number;
  httpMetricsRoute: string;
  livenessProbeRoute: string;
  headless: boolean;
  metricsIterationLabel: boolean;
  hikakuBaselinePath: string | undefined;
  hikakuUpdateBaseline: boolean;
  hikakuMaxIncreasePercent: number;
  hikakuReportMode: (typeof REPORT_MODES)[number];
  hikakuReportOutput: (typeof REPORT_OUTPUTS)[number];
  hikakuReportFilePath: string;
  hikakuReportLocale: (typeof REPORT_LOCALES)[number];
  hikakuLlmApiKey: string | undefined;
};

export type ConfOverrides = Partial<
  Pick<Conf, 'httpPort' | 'httpMetricsRoute' | 'livenessProbeRoute' | 'headless'>
>;

/** Raised by `createConf` when environment variables have invalid values (all are listed). */
export class ConfError extends Error {
  constructor(errors: string[]) {
    super(`Invalid configuration: ${errors.join('; ')}`);
    this.name = 'ConfError';
  }
}

const SENSITIVE_KEYS = new Set(['hikakuLlmApiKey']);

export const logConf = (conf: Conf, logger: Logger) => {
  logger.debug('Starting Kyara server with the following configuration:');

  logger.debug(
    Object.entries(conf)
      .filter((v) => typeof v[1] !== 'function' && v[1] !== undefined)
      .map(([key, value]) => {
        const displayValue = SENSITIVE_KEYS.has(key) ? '***' : String(value);
        return '\t- ' + key + '\t-> ' + displayValue;
      })
      .join('\n')
  );
};

const TRUE_VALUES = ['true', '1', 'yes', 'on'];
const FALSE_VALUES = ['false', '0', 'no', 'off'];

/** Reads typed values from environment variables, collecting the invalid ones. */
const createEnvReader = (env: NodeJS.ProcessEnv) => {
  const errors: string[] = [];
  /** The trimmed value, or undefined when the variable is unset or empty */
  const read = (name: string): string | undefined => env[name]?.trim() || undefined;

  return {
    errors,
    string: (name: string, fallback: string): string => read(name) ?? fallback,
    boolean(name: string, fallback: boolean): boolean {
      const value = read(name);
      if (value === undefined) return fallback;
      if (TRUE_VALUES.includes(value.toLowerCase())) return true;
      if (FALSE_VALUES.includes(value.toLowerCase())) return false;
      errors.push(`${name}="${value}" is not a boolean (true or false)`);
      return fallback;
    },
    number(
      name: string,
      fallback: number,
      { min, max, integer }: { min: number; max?: number; integer?: boolean }
    ): number {
      const value = read(name);
      if (value === undefined) return fallback;
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        (integer && !Number.isInteger(n)) ||
        n < min ||
        (max !== undefined && n > max)
      ) {
        const kind = integer ? 'an integer' : 'a number';
        const range = max === undefined ? `>= ${min}` : `between ${min} and ${max}`;
        errors.push(`${name}="${value}" is not ${kind} ${range}`);
        return fallback;
      }
      return n;
    },
    oneOf<T extends string>(name: string, values: readonly T[], fallback: T): T {
      const value = read(name);
      if (value === undefined) return fallback;
      if ((values as readonly string[]).includes(value)) return value as T;
      errors.push(`${name}="${value}" is not one of: ${values.join(', ')}`);
      return fallback;
    },
  };
};

/**
 * Reads the configuration from the KYARA_* environment variables.
 * Throws a `ConfError` listing every invalid value.
 */
export const createConf = (
  overrides: ConfOverrides,
  env: NodeJS.ProcessEnv = process.env
): Conf => {
  const e = createEnvReader(env);

  const conf: Conf = {
    appName: e.string('KYARA_APP_NAME', 'kyara-puppet'),
    yamlFilePath: e.string('KYARA_YAML_FILE_PATH', '/var/config/kyara.yaml'),
    headless: overrides.headless ?? e.boolean('KYARA_HEADLESS', false),
    httpPort:
      overrides.httpPort ?? e.number('KYARA_HTTP_PORT', 0, { min: 0, max: 65535, integer: true }),
    livenessProbeRoute:
      overrides.livenessProbeRoute ?? e.string('KYARA_HTTP_LIVENESS_PROBE_ROUTE', '/live'),
    httpMetricsRoute:
      overrides.httpMetricsRoute ?? e.string('KYARA_HTTP_METRICS_ROUTE', '/metrics'),
    metricsIterationLabel: e.boolean('KYARA_METRICS_ITERATION_LABEL', true),
    hikakuBaselinePath: env.KYARA_HIKAKU_BASELINE_PATH?.trim() || undefined,
    hikakuUpdateBaseline: e.boolean('KYARA_HIKAKU_UPDATE_BASELINE', false),
    hikakuMaxIncreasePercent: e.number('KYARA_HIKAKU_MAX_INCREASE_PERCENT', 20, { min: 0 }),
    hikakuReportMode: e.oneOf('KYARA_HIKAKU_REPORT_MODE', REPORT_MODES, 'on_fail'),
    hikakuReportOutput: e.oneOf('KYARA_HIKAKU_REPORT_OUTPUT', REPORT_OUTPUTS, 'log'),
    hikakuReportFilePath: e.string('KYARA_HIKAKU_REPORT_FILE_PATH', './hikaku-report.md'),
    hikakuReportLocale: e.oneOf('KYARA_HIKAKU_REPORT_LOCALE', REPORT_LOCALES, 'en'),
    hikakuLlmApiKey: env.KYARA_HIKAKU_LLM_API_KEY || env.ANTHROPIC_API_KEY || undefined,
  };

  if (conf.hikakuBaselinePath && !conf.metricsIterationLabel) {
    e.errors.push(
      'KYARA_METRICS_ITERATION_LABEL=false cannot be used with KYARA_HIKAKU_BASELINE_PATH: hikaku compares the metrics of each iteration'
    );
  }
  if (e.errors.length > 0) {
    throw new ConfError(e.errors);
  }
  return conf;
};
