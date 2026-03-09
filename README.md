# Kyara

[![GitHub last commit](https://img.shields.io/github/last-commit/bloom-perf/kyara?logo=github)](https://github.com/bloom-perf/kyara)
[![CI](https://img.shields.io/github/actions/workflow/status/bloom-perf/kyara/ci.yml?branch=main&label=CI)](https://github.com/bloom-perf/kyara/actions)
[![Release](https://img.shields.io/github/actions/workflow/status/bloom-perf/kyara/release.yml?label=release)](https://github.com/bloom-perf/kyara/actions)
[![GitHub release](https://img.shields.io/github/v/release/bloom-perf/kyara)](https://github.com/bloom-perf/kyara/releases)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Kyara** is a web traffic simulation tool that enables you to write and deploy massive web interaction scenarios to simulate realistic user traffic. By leveraging headless browsers, YAML-based scenario definitions (via [yaml-pptr](https://github.com/Bloom-Perf/yaml-pptr)), and Prometheus metrics, Kyara offers a robust solution for performance testing in modern web environments.

## Table of Contents

- [Why Kyara?](#why-kyara)
- [How It Works](#how-it-works)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Performance Regression Detection (Hikaku)](#performance-regression-detection-hikaku)
- [Contributing](#contributing)
- [License](#license)

## Why Kyara?

Modern web applications require thorough performance testing to ensure reliability under high traffic loads. Conventional load testing tools often simulate traffic at the HTTP request level, which may not fully capture real browser behavior such as JavaScript execution, rendering, and dynamic interactions.

Kyara addresses these challenges by:

- **Simulating Realistic User Behavior** — Launches headless browsers to mimic genuine user interactions
- **Flexible Scenario Definitions** — Uses a simple YAML format to describe complex web interaction flows
- **Comprehensive Metrics Collection** — Provides detailed insights into browser events and resource consumption
- **Scalable Deployments** — Supports containerization and Kubernetes orchestration via Docker and Helm

## How It Works

1. **Browser Orchestration** — Uses [Puppeteer](https://github.com/puppeteer/puppeteer) to launch headless Firefox instances controlled programmatically to simulate user interactions

2. **Scenario Interpretation** — Scenarios defined in YAML files are interpreted using [yaml-pptr](https://github.com/bloom-perf/yaml-pptr) to execute navigation, waiting, and interaction steps

3. **Metrics & Logging** — Collects metrics (browser startup, tab activity, HTTP lifecycle, CPU/RAM usage) via [prom-client](https://github.com/siimon/prom-client) and logs events with [Winston](https://github.com/winstonjs/winston)

4. **Deployment Flexibility** — Includes Dockerfile and Helm chart for seamless deployment on Kubernetes clusters

## Features

| Feature | Description |
|---------|-------------|
| Realistic Traffic | Execute user-like interactions using headless browsers |
| YAML Scenarios | Define and manage complex scenarios with straightforward syntax |
| Prometheus Metrics | Monitor browser events, resource consumption, and HTTP interactions |
| Regression Detection | Detect performance regressions with [hikaku](https://github.com/Bloom-Perf/hikaku) baseline comparison |
| LLM Analysis | Generate natural language performance reports powered by an LLM |
| Container Ready | Deploy via Docker or Helm in your CI/CD pipeline |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/bloom-perf/kyara.git
cd kyara

# Install dependencies
npm install

# Install Firefox for Puppeteer
npm run installFirefox

# Run in development mode
npm run start:dev
```

## Installation

### Prerequisites

- **Node.js** v22 or higher
- **Firefox for Puppeteer** — Kyara uses headless Firefox to run scenarios. Install it with `npm run installFirefox`
- **Docker** (for containerized deployments)
- **Kubernetes** (for Helm deployments)

### Local Development

```bash
# Install dependencies
npm install

# Install Firefox for Puppeteer (required to run scenarios)
npm run installFirefox

# Build the project
npm run build

# Run tests
npm test

# Lint and format code
npm run lint           # Check for linting issues
npm run lint:fix       # Fix linting issues automatically
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting

# Start in development mode
npm run start:dev

# Start in production mode
npm run start:prod
```

### Docker Deployment

```bash
# Build the image
docker build -t ghcr.io/bloom-perf/kyara:latest .

# Run the container
docker run -p 3000:3000 \
  -e KYARA_HTTP_PORT=3000 \
  -e KYARA_YAML_FILE_PATH=/var/config/kyara.yaml \
  ghcr.io/bloom-perf/kyara:latest
```

### Kubernetes Deployment (Helm)

```bash
# Package the Helm chart
helm package helm/

# Deploy the chart
helm install kyara-release ./kyara-0.0.1.tgz \
  --namespace bloom-perf \
  --create-namespace

# Customize via values.yaml or override parameters
helm install kyara-release ./kyara-0.0.1.tgz \
  --set replicaCount=3 \
  --namespace bloom-perf
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KYARA_APP_NAME` | Application name | `kyara-puppet` |
| `KYARA_YAML_FILE_PATH` | Path to YAML scenario file | `/var/config/kyara.yaml` |
| `KYARA_HTTP_PORT` | HTTP server port | `0` (random) |
| `KYARA_HTTP_METRICS_ROUTE` | Prometheus metrics endpoint | `/metrics` |
| `KYARA_HTTP_LIVENESS_PROBE_ROUTE` | Health check endpoint | `/live` |
| `KYARA_HEADLESS` | Run browser in headless mode | `false` |

#### Hikaku (Performance Regression Detection)

| Variable | Description | Default |
|----------|-------------|---------|
| `KYARA_HIKAKU_BASELINE_PATH` | Path to the baseline JSON file. Enables hikaku when set | _(disabled)_ |
| `KYARA_HIKAKU_UPDATE_BASELINE` | Save current metrics as the new baseline (instead of comparing) | `false` |
| `KYARA_HIKAKU_MAX_INCREASE_PERCENT` | Maximum allowed metric increase before flagging a regression (%) | `20` |

#### LLM Report

| Variable | Description | Default |
|----------|-------------|---------|
| `KYARA_HIKAKU_REPORT_MODE` | When to generate a report: `off`, `on_fail`, `always` | `on_fail` |
| `KYARA_HIKAKU_REPORT_OUTPUT` | Where to write the report: `log` or `file` | `log` |
| `KYARA_HIKAKU_REPORT_FILE_PATH` | File path for the report (when output is `file`) | `./hikaku-report.md` |
| `KYARA_HIKAKU_REPORT_LOCALE` | Report language: `en` or `fr` | `en` |
| `KYARA_HIKAKU_LLM_API_KEY` | Anthropic API key for report generation. Falls back to `ANTHROPIC_API_KEY` | _(disabled)_ |

## Usage

### Defining a Scenario

Create a YAML file (e.g., `kyara.yml`) to define your interaction scenario:

```yaml
scenarios:
  - location: http://example.com
    steps:
      - waitForever
```

This example instructs Kyara to launch a browser, navigate to the URL, and wait indefinitely. You can define multiple scenarios with various actions (click, navigate, wait) to simulate complex user behaviors.

See [yaml-pptr documentation](https://github.com/Bloom-Perf/yaml-pptr) for the full scenario syntax.

### Accessing Endpoints

```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# Liveness probe
curl http://localhost:3000/live
```

## Performance Regression Detection (Hikaku)

Kyara integrates [hikaku](https://github.com/Bloom-Perf/hikaku) to automatically detect performance regressions between runs. The workflow is:

1. **Establish a baseline** — run a scenario and save a snapshot of the collected Prometheus metrics
2. **Compare** — run the same scenario again and compare the new metrics against the baseline
3. **Report** — optionally generate a natural language analysis report using an LLM

A ready-to-run example is provided in the [`examples/`](examples/) directory.

### Prerequisites

```bash
npm install
npm run build
npm run installFirefox
```

### Step 1 — Establish a Baseline

Run the scenario and save the resulting metrics snapshot as a baseline:

```bash
KYARA_YAML_FILE_PATH=examples/scenario.yaml \
KYARA_HEADLESS=true \
KYARA_HIKAKU_BASELINE_PATH=examples/baseline.json \
KYARA_HIKAKU_UPDATE_BASELINE=true \
  node dist/main.js
```

This creates `examples/baseline.json` containing a snapshot of all Prometheus counters and histograms collected during the run.

### Step 2 — Compare Against the Baseline

Run the same scenario again, this time _without_ `KYARA_HIKAKU_UPDATE_BASELINE`. Kyara will compare the new metrics to the saved baseline:

```bash
KYARA_YAML_FILE_PATH=examples/scenario.yaml \
KYARA_HEADLESS=true \
KYARA_HIKAKU_BASELINE_PATH=examples/baseline.json \
  node dist/main.js
```

If any metric has increased by more than 20% (default threshold), Kyara logs a warning for each regression and exits with code 1. You can adjust the threshold:

```bash
KYARA_HIKAKU_MAX_INCREASE_PERCENT=50   # allow up to 50% increase
```

### Step 3 — Generate an LLM Analysis Report

When an Anthropic API key is available, Kyara can produce a human-readable performance report:

```bash
KYARA_YAML_FILE_PATH=examples/scenario.yaml \
KYARA_HEADLESS=true \
KYARA_HIKAKU_BASELINE_PATH=examples/baseline.json \
KYARA_HIKAKU_REPORT_MODE=always \
KYARA_HIKAKU_REPORT_OUTPUT=file \
KYARA_HIKAKU_REPORT_FILE_PATH=examples/hikaku-report.md \
KYARA_HIKAKU_REPORT_LOCALE=en \
ANTHROPIC_API_KEY=sk-ant-... \
  node dist/main.js
```

The generated report contains a concise summary of the comparison: which metrics changed, whether regressions were detected, and actionable recommendations.

| Option | Values | Description |
|--------|--------|-------------|
| `REPORT_MODE` | `off` | Never generate a report |
| | `on_fail` _(default)_ | Only when regressions are detected |
| | `always` | After every comparison |
| `REPORT_OUTPUT` | `log` _(default)_ | Print the report in the application logs |
| | `file` | Write the report to `REPORT_FILE_PATH` |
| `REPORT_LOCALE` | `en` _(default)_, `fr` | Language of the generated report |

### Helper Script

The [`examples/run.sh`](examples/run.sh) script wraps all three phases:

```bash
# Run the full baseline + compare workflow
bash examples/run.sh all

# Or run individual phases
bash examples/run.sh baseline
bash examples/run.sh compare
bash examples/run.sh report     # requires ANTHROPIC_API_KEY
```

### CI Integration

A typical CI pipeline would:

1. Store the baseline JSON as a versioned artifact or in the repository
2. Run the scenario and compare against the baseline on every push
3. Fail the build if regressions are detected

```yaml
# Example GitHub Actions step
- name: Performance regression check
  run: |
    KYARA_YAML_FILE_PATH=examples/scenario.yaml \
    KYARA_HEADLESS=true \
    KYARA_HIKAKU_BASELINE_PATH=examples/baseline.json \
      node dist/main.js
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

Kyara is licensed under the [Apache 2.0 License](https://opensource.org/licenses/Apache-2.0).
