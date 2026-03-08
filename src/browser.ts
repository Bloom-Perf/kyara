import puppeteer, { HTTPRequest, HTTPResponse, ConsoleMessage, Page } from 'puppeteer';
import { MetricsEmitter, Status } from './metrics.js';
import chalk from 'chalk';
import { Conf } from './conf.js';
import { Logger } from 'winston';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as yp from '@bloom-perf/yaml-pptr';
import type { ScenarioContext } from '@bloom-perf/yaml-pptr';

export const launchBrowsers = async (
  conf: Conf,
  logger: Logger,
  me: MetricsEmitter
): Promise<void> => {
  // Run the node orchestrator
  logger.info(`Start browser`);

  // Spawn the browser instance
  const browser = await puppeteer.launch({
    headless: conf.headless,
    browser: 'firefox',
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--ignore-certificate-errors',
    ],
    acceptInsecureCerts: true,
  });

  me.browserStarted('firefox', Status.Success);

  // On application exit, close all browsers
  process.on('exit', async () => {
    logger.info(`Closing browser`);
    await browser.close();
  });

  const fetchTabsRamCpuConsumption = () => {
    try {
      // run the `ls` command using exec
      const output = execSync(
        'ps aux |grep firefox-bin | grep childID | awk \'{print $3 "-" $6;}\''
      );

      // log the output received from the command
      const list: [number, number][] = output
        .toString()
        .split('\n')
        .map((line) => line.split('-').map((str) => +str)) as [number, number][];

      let podCpu = 0;
      let podRam = 0;

      for (const [cpu, ram] of list) {
        podCpu += cpu;
        podRam += ram;
        if (cpu && ram) {
          me.resourcesConsumptionPerTab('firefox', ram, cpu);
        }
      }

      if (podRam && podCpu) {
        me.resourcesConsumptionPerPod('firefox', podRam, podCpu);
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setTimeout(fetchTabsRamCpuConsumption, 5000);
    }
  };

  fetchTabsRamCpuConsumption();

  // Start all tabs and wait for completion
  await yp.readYamlAndInterpret(fs.readFileSync(conf.yamlFilePath, { encoding: 'utf8' }), {
    browsers: { firefox: browser },
    logger,
    onPage: async (tab: Page, ctx: ScenarioContext) => {
      try {
        const { scenarioName, iteration } = ctx;
        logger.info(`Start browser page now! [scenario=${scenarioName}, iteration=${iteration}]`);
        me.browserTabStarted(Status.Success, scenarioName, iteration);

        // Track request start times for latency measurement
        const requestStartTimes = new Map<string, number>();

        tab.on('request', (request: HTTPRequest) => {
          const hostname = new URL(request.url()).hostname;
          me.browserRequest(hostname, scenarioName, iteration);
          requestStartTimes.set(request.url(), Date.now());
        });
        tab.on('requestfinished', (request: HTTPRequest) => {
          const hostname = new URL(request.url()).hostname;
          me.browserRequestFinished(hostname, scenarioName, iteration);
          const startTime = requestStartTimes.get(request.url());
          if (startTime) {
            me.browserRequestDuration(
              hostname,
              scenarioName,
              iteration,
              (Date.now() - startTime) / 1000
            );
            requestStartTimes.delete(request.url());
          }
        });
        tab.on('requestfailed', (request: HTTPRequest) => {
          const hostname = new URL(request.url()).hostname;
          me.browserRequestFailed(hostname, scenarioName, iteration);
          requestStartTimes.delete(request.url());
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
        logger.error(`Error on page: ${chalk.redBright(err)}`);
      }
    },
  });
};
