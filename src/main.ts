import { Conf, createConf, logConf } from './conf.js';
import express from 'express';
import { createMetricsEmitter, createPromRegister } from './metrics.js';
import { closeBrowsers, launchBrowsers } from './browser.js';
import { createLogger } from './logger.js';
import { collectDefaultMetrics } from 'prom-client';
import * as hikaku from '@bloom-perf/hikaku';
import { writeFileSync } from 'fs';

(async () => {
  const logger = createLogger();
  let conf: Conf;
  try {
    conf = createConf({});
  } catch (err: unknown) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  logConf(conf, logger);

  /**
   * Stops on SIGTERM (docker stop, Kubernetes) and SIGINT (Ctrl+C): otherwise the HTTP
   * server keeps the process alive once Puppeteer has closed the browsers.
   */
  const stop = async (signal: NodeJS.Signals) => {
    logger.info(`${signal} received: closing the browsers and stopping`);
    await closeBrowsers(logger);
    // An interrupted batch run (hikaku) fails; a server is stopped normally
    if (conf.hikakuBaselinePath) {
      logger.error('Hikaku: interrupted, the baseline is neither saved nor compared');
    }
    process.exit(conf.hikakuBaselinePath ? 1 : 0);
  };
  process.once('SIGTERM', (signal) => void stop(signal));
  process.once('SIGINT', (signal) => void stop(signal));

  const promRegistry = createPromRegister();
  promRegistry.setDefaultLabels({ app: conf.appName });
  const metricsEmitter = createMetricsEmitter(promRegistry, {
    iterationLabel: conf.metricsIterationLabel,
  });
  collectDefaultMetrics({ register: promRegistry });

  /**
   * Runs the scenarios and resolves to whether they all succeeded.
   *
   * yaml-pptr rejects with an AggregateError once every scenario has run if some iterations
   * failed or a browser could not start (each failure has already been logged): the metrics
   * of the run are still there. Any other error (invalid scenarios, missing scenario file)
   * means nothing ran: exit.
   */
  const runScenarios = async (): Promise<boolean> => {
    try {
      await launchBrowsers(conf, logger, metricsEmitter);
      logger.info('All scenarios finished');
      return true;
    } catch (err: unknown) {
      if (err instanceof AggregateError) {
        logger.error(`Scenarios finished with failures: ${err.message}`);
        return false;
      }
      logger.error(`Scenarios could not run: ${String(err)}`);
      process.exit(1);
    }
  };

  // Hikaku (batch mode): run the scenarios to completion, then save or compare the baseline
  if (conf.hikakuBaselinePath) {
    if (!(await runScenarios())) {
      logger.error('Hikaku: scenarios failed, the baseline is neither saved nor compared');
      process.exit(1);
      return;
    }

    const snapshot = await hikaku.createSnapshot(promRegistry);

    if (conf.hikakuUpdateBaseline) {
      hikaku.saveBaseline(snapshot, conf.hikakuBaselinePath);
      logger.info('Hikaku: baseline saved to ' + conf.hikakuBaselinePath);
    } else if (hikaku.baselineExists(conf.hikakuBaselinePath)) {
      const baseline = hikaku.loadBaseline(conf.hikakuBaselinePath);
      const report = hikaku.compare(snapshot, baseline, {
        defaultMaxIncreasePercent: conf.hikakuMaxIncreasePercent,
      });
      logger.info(
        `Hikaku: ${report.overallVerdict} (${report.summary.passed} passed, ${report.summary.failed} failed)`
      );

      // LLM report generation
      const shouldReport =
        conf.hikakuReportMode === 'always' ||
        (conf.hikakuReportMode === 'on_fail' && report.overallVerdict === 'fail');

      if (shouldReport && conf.hikakuLlmApiKey) {
        try {
          const provider = hikaku.createAnthropicProvider(conf.hikakuLlmApiKey);
          const llmReport = await hikaku.generateReport(report, snapshot, baseline, {
            provider,
            locale: conf.hikakuReportLocale,
            format: 'markdown',
          });

          if (conf.hikakuReportOutput === 'file') {
            writeFileSync(conf.hikakuReportFilePath, llmReport, 'utf-8');
            logger.info('Hikaku: LLM report saved to ' + conf.hikakuReportFilePath);
          } else {
            logger.info('Hikaku LLM Report:\n' + llmReport);
          }
        } catch (err: unknown) {
          logger.warn('Hikaku: LLM report generation failed: ' + err);
        }
      }

      if (report.overallVerdict === 'fail') {
        for (const r of report.summary.regressions) {
          logger.warn(`Hikaku regression: ${r.metricName} +${r.deltaPercent.toFixed(1)}%`);
        }
        process.exit(1);
      }
    } else {
      logger.info(
        'Hikaku: no baseline found at ' + conf.hikakuBaselinePath + ', skipping comparison'
      );
    }

    process.exit(0);
    return;
  }

  // Server mode: expose the metrics while the scenarios run (they may never end, e.g. `waitForever`)
  void runScenarios();

  await express()
    .get(conf.httpMetricsRoute, async (_req, res, _oth) => {
      res.set('Content-Type', promRegistry.contentType);
      const flushedMetrics = await promRegistry.metrics();
      res.end(flushedMetrics);
    })
    .get(conf.livenessProbeRoute, (_req, res) => {
      res.send('Health check passed');
    })
    .listen(conf.httpPort);
})();
