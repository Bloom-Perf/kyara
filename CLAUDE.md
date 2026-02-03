# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kyara is a load/stress testing tool that uses Puppeteer with Firefox headless browser to simulate web interactions and collect performance metrics. It executes scenarios defined in YAML files via the `@bloom-perf/yaml-pptr` library and exposes Prometheus metrics.

## Build and Development Commands

Requires **Node.js v22+**.

```bash
npm run build          # TypeScript compilation (outputs to dist/)
npm run start:dev      # Run in development mode with ts-node
npm run start:prod     # Run compiled JavaScript from dist/
npm run installFirefox # Install Firefox for Puppeteer
npm test               # Run Jest tests
npm run test:coverage  # Run tests with coverage report
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
```

### Running Single Tests

```bash
# Run a single test file
NODE_OPTIONS='--experimental-vm-modules' npx jest src/__tests__/conf.test.ts

# Run tests matching a pattern
NODE_OPTIONS='--experimental-vm-modules' npx jest -t "pattern"
```

## Architecture

Source code is in `src/` with a simple module structure:

- **main.ts** - Entry point: initializes config, logger, metrics, launches browser, starts Express HTTP server
- **browser.ts** - Core simulation logic: launches Firefox, executes YAML scenarios, monitors CPU/RAM via shell commands, captures browser events (requests, responses, errors)
- **conf.ts** - Configuration via environment variables (KYARA_* prefix)
- **logger.ts** - Winston logger with ECS format for Elastic Stack compatibility
- **metrics.ts** - Prometheus metrics: counters for events, histograms for resource consumption
- **types/** - Type declarations for untyped dependencies
- **__tests__/** - Jest unit tests

Factory pattern is used throughout: `createConf()`, `createLogger()`, `createMetricsEmitter()`, `createPromRegister()`.

## Module System

The project uses **ES Modules** (`"type": "module"` in package.json):

- All relative imports must use `.js` extensions (e.g., `import { foo } from "./bar.js"`)
- TypeScript is configured with `"module": "Node16"` and `"moduleResolution": "nodenext"`
- Jest is configured for ESM with `NODE_OPTIONS='--experimental-vm-modules'`

## Configuration

Key environment variables:

- `KYARA_APP_NAME` - Application name (default: `kyara-puppet`)
- `KYARA_YAML_FILE_PATH` - Path to scenario YAML file (default: `/var/config/kyara.yaml`)
- `KYARA_HTTP_PORT` - HTTP server port (default: 0 = random)
- `KYARA_HEADLESS` - Run browser headless
- `KYARA_HTTP_METRICS_ROUTE` - Prometheus endpoint (default: `/metrics`)
- `KYARA_HTTP_LIVENESS_PROBE_ROUTE` - Health check (default: `/live`)

## Deployment

- Docker multi-stage build defined in `Dockerfile`
- Helm chart in `helm/` for Kubernetes deployment
- Scenarios are mounted via ConfigMap from `helm/config/kyara.yml`
- GitHub Actions CI runs build and tests on push; releases publish to ghcr.io

## Dependencies

- **Puppeteer v24** - Uses `browser: "firefox"` option (not `product`)
- **Chalk v5** - Pure ESM, requires ES modules
- **@bloom-perf/yaml-pptr** - Published on npmjs.com (no authentication required)
