import type { Browser, HTTPRequest, HTTPResponse, ConsoleMessage, Page } from 'puppeteer';
import { MetricsEmitter, Status } from './metrics.js';
import { Conf } from './conf.js';
import { Logger } from 'winston';
import * as fs from 'fs';
import * as yp from '@bloom-perf/yaml-pptr';
import type { ScenarioContext, SupportedBrowser } from '@bloom-perf/yaml-pptr';
import { createResourceMonitor } from './resources.js';

/** Browsers the scenarios run in, still open */
const openBrowsers = new Set<Browser>();

/** Closes the browsers still open, waiting at most `timeoutMs` */
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
  const resources = createResourceMonitor(me, logger);

  /** yaml-pptr launched a browser for the scenarios: monitor it until it closes */
  const onBrowser = (browser: Browser, name: SupportedBrowser) => {
    me.browserStarted(name, Status.Success);
    openBrowsers.add(browser);
    browser.once('disconnected', () => openBrowsers.delete(browser));
    const pid = browser.process()?.pid;
    if (pid !== undefined) {
      resources.watch(name, pid);
    }
  };

  try {
    // yaml-pptr launches the browsers the scenarios use (and closes them once their
    // scenarios are over), starts all the scenarios and waits for them to finish
    await yp.readYamlAndInterpret(fs.readFileSync(conf.yamlFilePath, { encoding: 'utf8' }), {
      headless: conf.headless,
      logger,
      onBrowser,
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
  } catch (err) {
    if (err instanceof AggregateError) {
      for (const error of err.errors) {
        if (error instanceof yp.BrowserLaunchError) {
          me.browserStarted(error.browser, Status.Error);
        }
      }
    }
    throw err;
  } finally {
    resources.stop();
  }
};
