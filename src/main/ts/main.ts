import { createConf, logConf } from "./conf";
import express from "express";
import { createMetricsEmitter, createPromRegister } from "./metrics";
import { launchBrowsers } from "./browser";
import { createLogger } from "./logger";
import { collectDefaultMetrics } from "prom-client";

(async () => {

    const conf = createConf({});
    const logger = createLogger();

    logConf(conf, logger);

    const promRegistry = createPromRegister();
    promRegistry.setDefaultLabels({ app: conf.appName });
    const metricsEmitter = createMetricsEmitter(promRegistry);
    collectDefaultMetrics({ register: promRegistry });

    // Launching browsers and tabs altogether
    launchBrowsers(conf, logger, metricsEmitter)
        .catch(err => console.error("Fatal error when launching browsers: " + err));

    // Start http server to expose prometheus metrics
    await express()
        .get(conf.httpMetricsRoute, async (_req, res, _oth) => {
            res.set('Content-Type', promRegistry.contentType);
            const flushedMetrics = await promRegistry.metrics();
            res.end(flushedMetrics);
        })
        .get(conf.livenessProbeRoute, (_req, res) => {
            res.send("Health check passed");
        })
        .listen(conf.httpPort);
})();