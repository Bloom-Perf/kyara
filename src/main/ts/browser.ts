import puppeteer, { ConsoleMessage, Page, HTTPRequest, HTTPResponse } from "puppeteer";
import { MetricsEmitter, Status } from "./metrics.js";
import chalk from "chalk";
import { Conf } from "./conf.js";
import { Logger } from "winston";
import { execSync } from "child_process";
import * as fs from "fs";
import * as yp from "@bloom-perf/yaml-pptr";

export const launchBrowsers = async (conf: Conf, logger: Logger, me: MetricsEmitter): Promise<void> => {

    const runScenarios = yp.readYamlAndInterpret(fs.readFileSync(conf.yamlFilePath, { encoding: "utf8" }), logger);

    // Run the node orchestrator
    logger.info(`Start browser`);

    // Spawn the browser instance
    const browser = await puppeteer.launch({
        headless: conf.headless,
        browser: "firefox",
        ignoreDefaultArgs: ["--disable-extensions"],
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--ignore-certificate-errors'
        ],
        acceptInsecureCerts: true
    });

    me.browserStarted("firefox", Status.Success);

    // On application exit, close all browsers
    process.on('exit', async () => {
        logger.info(`Closing browser`);
        await browser.close();
    });


    const fetchTabsRamCpuConsumption = () => {

        try {
            // run the `ls` command using exec
            const output = execSync("ps aux |grep firefox-bin | grep childID | awk '{print $3 \"-\" $6;}'");

            // log the output received from the command
            const list: [number, number][] = output.toString().split("\n").map(line => line.split("-").map(str => +str)) as [number, number][];

            let podCpu = 0;
            let podRam = 0;

            for (let [cpu, ram] of list) {
                podCpu += cpu;
                podRam += ram;
                cpu && ram && me.resourcesConsumptionPerTab("firefox", ram, cpu)
            }

            podRam && podCpu && me.resourcesConsumptionPerPod("firefox", podRam, podCpu);
        } catch (e) {
            logger.error(e);
        } finally {
            setTimeout(fetchTabsRamCpuConsumption, 5000);
        }
    }

    fetchTabsRamCpuConsumption();

    // Start all tabs and wait for completion

    await runScenarios(browser, async (tab: Page) => {
        try {
            logger.info(`Start browser page now!`);
            me.browserTabStarted(Status.Success);

            tab.on("request", (request: HTTPRequest) => me.browserRequest(new URL(request.url()).hostname))
            tab.on("requestfinished", (request: HTTPRequest) => me.browserRequestFinished(new URL(request.url()).hostname))
            tab.on("requestfailed", (request: HTTPRequest) => me.browserRequestFailed(new URL(request.url()).hostname))
            tab.on("response", (response: HTTPResponse) => me.browserResponse(new URL(response.url()).hostname))
            tab.on("error", (err: Error) => {
                me.browserError();
                logger.info(err.message, { ...err, tags: ["BROWSER_LOG", "BROWSER_ERROR"]/*, url*/ });
            })
            tab.on("console", (msg: ConsoleMessage) => {
                me.browserLogLine();
                logger.info(msg.text(), { tags: ["BROWSER_LOG"] /*, url*/ });
            });
        } catch (err) {
            me.browserTabStarted(Status.Error);
            logger.error(`Error on page: ${chalk.redBright(err)}`);
        }
    });

}