# Kyara

[![GitHub last commit (by committer)](https://img.shields.io/github/last-commit/bloom-perf/kyara?logo=github)](https://github.com/bloom-perf/kyara)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/bloom-perf/kyara/ci.yml?style=flat&branch=main)](https://github.com/bloom-perf/kyara/actions)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/bloom-perf/kyara/release.yml?label=publish)](https://github.com/bloom-perf/kyara/actions)
[![GitHub release (with filter)](https://img.shields.io/github/v/release/bloom-perf/kyara?style=flat)](https://github.com/bloom-perf/kyara/releases)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat)](https://opensource.org/licenses/Apache-2.0)

*Kyara* is a web traffic simulation tool that enables you to write and deploy massive web interaction scenarios to simulate realistic user traffic for your applications. By leveraging headless browsers, YAML-based scenario definitions (cf. [yaml-pptr](https://github.com/Bloom-Perf/yaml-pptr)), and Prometheus-powered metrics, Kyara offers a robust solution for performance testing and monitoring in modern web environments.

---

## Problem Statement

Modern web applications require thorough performance testing to ensure reliability and scalability under high traffic loads. Conventional load testing tools often simulate traffic at the HTTP request level, which may not fully capture the intricacies of real browser behavior such as JavaScript execution, rendering, and dynamic interactions.

Kyara addresses these challenges by:

- **Simulating Realistic User Behavior:** Launches headless browsers to mimic genuine user interactions.
- **Flexible Scenario Definitions:** Uses a simple YAML format to describe complex web interaction flows.
- **Comprehensive Metrics Collection:** Provides detailed insights into browser events and resource consumption for proactive performance monitoring.
- **Scalable Deployments:** Supports containerization and Kubernetes orchestration via Docker and Helm charts.

---

## How Kyara Works

1. **Browser Orchestration:**  
   Kyara uses [Puppeteer](https://github.com/puppeteer/puppeteer) to launch headless Firefox instances. These browsers are controlled programmatically to simulate user interactions on web pages.

2. **Scenario Interpretation:**  
   Scenarios are defined in a YAML file (e.g., `kyara.yml`) using a simple, human-readable format. Kyara interprets these scenarios with the help of the [yaml-pptr](https://github.com/bloom-perf/yaml-pptr) library to execute a sequence of steps such as navigation, waiting, and interaction.

3. **Metrics and Logging:**  
   The tool collects various metrics (e.g., browser start-up, tab activity, HTTP request lifecycle, CPU and RAM usage) using [Prometheus client for Node.js](https://github.com/siimon/prom-client) and logs events with [Winston](https://github.com/winstonjs/winston). Metrics are exposed via an HTTP endpoint for real-time monitoring.

4. **Deployment Flexibility:**  
   Kyara provides a Dockerfile for containerization and a Helm chart for seamless deployment on Kubernetes clusters, allowing it to scale according to your testing needs.

---

## Features

- **Realistic Traffic Simulation:**  
  Execute user-like interactions using headless browsers.

- **YAML-Based Scenario Configuration:**  
  Define and manage complex scenarios easily with a straightforward YAML syntax.

- **Detailed Metrics Collection:**  
  Monitor browser events, resource consumption, and HTTP interactions with Prometheus metrics.

- **Container and Kubernetes Ready:**  
  Deploy Kyara via Docker or Helm to integrate into your CI/CD pipeline and orchestration environment.

---

## Installation

### Prerequisites

- **Node.js:** v22 (or higher recommended)
- **Docker:** For containerized deployments
- **Kubernetes:** If deploying using Helm

### Local Development

1. **Clone the Repository:**

    ```bash
    git clone https://github.com/bloom-perf/kyara.git
    cd kyara
    ```

2. **Install Dependencies:**

    ```bash
    npm install
    ```

3. **Build the Project:**

   ```bash
   npm run build
   ```

4. **Run Development Mode:**

   ```bash
   npm run start:dev
   ```

### Docker Deployment

1. **Build the Docker Image:**  
   Replace `your_npm_token` with your NPM token.

    ```bash
    docker build --build-arg NPM_TOKEN=your_npm_token -t ghcr.io/bloom-perf/kyara:latest .
    ```

2. **Run the Container:**

    ```bash
    docker run -p 3000:3000 \
    -e KYARA_HTTP_PORT=3000 \
    -e KYARA_YAML_FILE_PATH=/var/config/kyara.yaml \
    ghcr.io/bloom-perf/kyara:latest
    ```

### Kubernetes Deployment with Helm

Kyara comes with a Helm chart located in the helm directory.

1. **Package the Helm Chart:**  
   Replace `kyara-0.0.1.tgz` with the desired chart version.

    ```bash
    helm package helm/
    ```

2. **Deploy the Chart:**

    ```bash
    helm install kyara-release ./kyara-0.0.1.tgz --namespace bloom-perf --create-namespace
    ```

3. **Customize Deployment:**  
   Edit `helm/values.yaml` or provide override parameters during installation as needed.

---

## Usage Examples

### Defining a Scenario

Create a YAML file (e.g., kyara.yml) to define your interaction scenario:
    ```yaml
    scenarios:
      - location: http://google.com
        steps:
          - waitForever
    ```

This example instructs Kyara to launch a browser, navigate to <http://google.com>, and execute a "waitForever" step. You can define multiple scenarios with various actions (e.g., click, navigate, wait) to simulate complex user behaviors.

### Accessing Metrics and Health Checks

- Prometheus Metrics Endpoint:

Exposed at the route specified by KYARA_HTTP_METRICS_ROUTE (default: /metrics).
    ```bash
    curl http://localhost:3000/metrics
    ```

- Liveness Probe:

Available at the route specified by KYARA_HTTP_LIVENESS_PROBE_ROUTE (default: /live).
    ```bash
    curl http://localhost:3000/live
    ```

### Environment Configuration

Kyara can be customized through several environment variables:

- `KYARA_APP_NAME`: Application name (default: `kyara-puppet`).
- `KYARA_YAML_FILE_PATH`: Path to the YAML configuration file (default: /var/config/kyara.yaml).
- `KYARA_HTTP_PORT`: Port for the HTTP server exposing metrics and liveness endpoints.
- `KYARA_HTTP_METRICS_ROUTE`: URL path for Prometheus metrics (default: /metrics).
- `KYARA_HTTP_LIVENESS_PROBE_ROUTE`: URL path for the liveness probe (default: /live).
- `KYARA_HEADLESS`: Boolean flag to enable headless mode.

Set these variables in your deployment environment to tailor Kyara’s behavior to your needs.

---

## Contributing

Contributions are welcome! Please adhere to the repository’s contribution guidelines when submitting issues or pull requests.

---

## License

Kyara is licensed under the Licence [![Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?label=&style=flat)](https://opensource.org/licenses/Apache-2.0).
