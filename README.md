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
| Container Ready | Deploy via Docker or Helm in your CI/CD pipeline |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/bloom-perf/kyara.git
cd kyara

# Install dependencies
npm install

# Run in development mode
npm run start:dev
```

## Installation

### Prerequisites

- **Node.js** v22 or higher
- **Docker** (for containerized deployments)
- **Kubernetes** (for Helm deployments)

### Local Development

```bash
# Install dependencies
npm install

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

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

Kyara is licensed under the [Apache 2.0 License](https://opensource.org/licenses/Apache-2.0).
