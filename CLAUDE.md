# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kyara is a load/stress testing tool that uses Puppeteer with Firefox headless browser to simulate web interactions and collect performance metrics. It executes scenarios defined in YAML files via the `@bloom-perf/yaml-pptr` library and exposes Prometheus metrics.

## Build and Development Commands

```bash
npm run build          # TypeScript compilation (outputs to dist/)
npm run start:dev      # Run in development mode with ts-node
npm run start:prod     # Run compiled JavaScript from dist/
npm run installFirefox # Install Firefox for Puppeteer
```

There are no test or lint commands configured.

## Architecture

Source code is in `src/main/ts/` with a simple module structure:

- **main.ts** - Entry point: initializes config, logger, metrics, launches browser, starts Express HTTP server
- **browser.ts** - Core simulation logic: launches Firefox, executes YAML scenarios, monitors CPU/RAM via shell commands, captures browser events (requests, responses, errors)
- **conf.ts** - Configuration via environment variables (KYARA_* prefix)
- **logger.ts** - Winston logger with ECS format for Elastic Stack compatibility
- **metrics.ts** - Prometheus metrics: counters for events, histograms for resource consumption

Factory pattern is used throughout: `createConf()`, `createLogger()`, `createMetricsEmitter()`, `createPromRegister()`.

## Configuration

Key environment variables:
- `KYARA_YAML_FILE_PATH` - Path to scenario YAML file (default: `/var/config/kyara.yaml`)
- `KYARA_HTTP_PORT` - HTTP server port (default: 0 = random)
- `KYARA_HEADLESS` - Run browser headless
- `KYARA_HTTP_METRICS_ROUTE` - Prometheus endpoint (default: `/metrics`)
- `KYARA_HTTP_LIVENESS_PROBE_ROUTE` - Health check (default: `/live`)

## Deployment

- Docker multi-stage build defined in `Dockerfile`
- Helm chart in `helm/` for Kubernetes deployment
- Scenarios are mounted via ConfigMap from `helm/config/kyara.yml`
- GitHub Actions CI runs build on push; releases publish to ghcr.io

## Dependencies

Uses `@bloom-perf/yaml-pptr` from GitHub Packages (requires `.npmrc` with registry config). The registry authentication token must be set for `npm install` to work.
