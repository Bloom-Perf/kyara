import puppeteer, { Browser, HTTPRequest, HTTPResponse, ConsoleMessage, Page } from 'puppeteer';
import { MetricsEmitter, Status } from './metrics.js';
import { Conf } from './conf.js';
import { Logger } from 'winston';
import * as fs from 'fs';
import * as yp from '@bloom-perf/yaml-pptr';
import type { ScenarioContext } from '@bloom-perf/yaml-pptr';
import { createResourceMonitor } from './resources.js';

/** Browsers launched by Kyara and still open */
const openBrowsers = new Set<Browser>();

/** Closes the browsers launched by Kyara, waiting at most `timeoutMs` */
export const closeBrowsers = async (logger: Logger, timeoutMs = 5000): Promise<void> => {
  const closing = Promise.allSettled(
    [...openBrowsers].map((browser) =>
      browser.close().catch((err: unknown) => logger.warn(`Failed to close a browser: ${err}`))
    )
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs).unref());
  await Promise.race([closing, timeout]);
};

export const launchBrowsers = async (
  conf: Conf,
  logger: Logger,
  me: MetricsEmitter
): Promise<void> => {
  // Puppeteer runs Firefox in a fresh temporary profile; Chrome flags such as --no-sandbox
  // do not apply. Scenarios run in it when they declare `browser: firefox`: otherwise
  // yaml-pptr launches its own Chrome, not monitored here.
  logger.info(`Launching firefox (headless: ${conf.headless})`);
  let browser: Browser;
  try {
    browser = await puppeteer.launch({
      headless: conf.headless,
      browser: 'firefox',
      acceptInsecureCerts: true,
    });
  } catch (err) {
    me.browserStarted('firefox', Status.Error);
    throw err;
  }
  me.browserStarted('firefox', Status.Success);
  openBrowsers.add(browser);
  browser.once('disconnected', () => openBrowsers.delete(browser));

  const resources = createResourceMonitor(me, logger);
  const pid = browser.process()?.pid;
  if (pid !== undefined) {
    resources.watch('firefox', pid);
  }

  try {
    // Start all tabs and wait for completion
    await yp.readYamlAndInterpret(fs.readFileSync(conf.yamlFilePath, { encoding: 'utf8' }), {
      browsers: { firefox: browser },
      logger,
      onPage: async (tab: Page, ctx: ScenarioContext) => {
        try {
          const { scenarioName, iteration } = ctx;
          logger.info(`Start browser page now! [scenario=${scenarioName}, iteration=${iteration}]`);
          me.browserTabStarted(Status.Success, scenarioName, iteration);

          // Start time of each pending request (redirects are new requests), for its duration
          const requestStartTimes = new WeakMap<HTTPRequest, number>();

          tab.on('request', (request: HTTPRequest) => {
            const hostname = new URL(request.url()).hostname;
            me.browserRequest(hostname, scenarioName, iteration);
            requestStartTimes.set(request, performance.now());
          });
          tab.on('requestfinished', (request: HTTPRequest) => {
            const hostname = new URL(request.url()).hostname;
            me.browserRequestFinished(hostname, scenarioName, iteration);
            const startTime = requestStartTimes.get(request);
            if (startTime !== undefined) {
              me.browserRequestDuration(
                hostname,
                scenarioName,
                iteration,
                (performance.now() - startTime) / 1000
              );
              requestStartTimes.delete(request);
            }
          });
          tab.on('requestfailed', (request: HTTPRequest) => {
            const hostname = new URL(request.url()).hostname;
            me.browserRequestFailed(hostname, scenarioName, iteration);
            requestStartTimes.delete(request);
          });
          tab.on('response', (response: HTTPResponse) =>
            me.browserResponse(new URL(response.url()).hostname, scenarioName, iteration)
          );
          tab.on('error', (err: Error) => {
            me.browserError();
            logger.info(err.message, { ...err, tags: ['BROWSER_LOG', 'BROWSER_ERROR'] });
          });
          tab.on('console', (msg: ConsoleMessage) => {
            me.browserLogLine();
            logger.info(msg.text(), { tags: ['BROWSER_LOG'] });
          });
        } catch (err) {
          me.browserTabStarted(Status.Error, ctx.scenarioName, ctx.iteration);
          logger.error(`Error on page: ${err}`);
        }
      },
    });
  } finally {
    // The scenarios are over: an idle browser would only skew the CPU/RAM metrics
    resources.stop();
    await browser.close().catch((err: unknown) => logger.warn(`Failed to close firefox: ${err}`));
    openBrowsers.delete(browser);
  }
};
