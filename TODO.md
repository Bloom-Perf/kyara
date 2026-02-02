# Kyara Roadmap

Future improvements and feature ideas for Kyara.

## Metrics & Observability

- [ ] **Web Vitals Collection** - Automatically collect Core Web Vitals (LCP, FID, CLS, TTFB, FCP)
- [ ] **Latency Histograms** - Response time distribution per URL/endpoint
- [ ] **Distributed Tracing** - OpenTelemetry integration for end-to-end tracing
- [ ] **Grafana Dashboards** - Ready-to-use dashboard templates

## Scenario Management

- [ ] **Hot-reload** - Reload scenarios without restarting the application
- [ ] **Validation Mode** - Dry-run mode to validate YAML syntax before execution
- [ ] **Multi-file Support** - Load and execute multiple scenario files
- [ ] **Variables & Templating** - Dynamic parameterization (environment variables, test data)

## Scalability

- [ ] **Multi-browser Support** - Add Chrome/Chromium support alongside Firefox
- [ ] **Load Control** - Rate limiting, progressive ramp-up
- [ ] **Configurable Concurrency** - Adjustable number of tabs/browsers
- [ ] **Distributed Mode** - Coordination across multiple pods/instances

## Debugging & Capture

- [ ] **Screenshots** - Automatic capture on error or assertion failure
- [ ] **Video Recording** - Optional recording for scenario debugging
- [ ] **HAR Export** - Generate HAR files for network analysis
- [ ] **Structured Logging** - Log/metric correlation per scenario execution

## Interface & API

- [ ] **REST API** - Runtime scenario management (start/stop/status/reload)
- [ ] **Web Dashboard** - Real-time monitoring interface
- [ ] **Enhanced CLI** - Commands to validate, list, and inspect scenarios

## Integrations

- [ ] **Alerts** - Webhooks, Slack, Teams notifications on threshold breaches
- [ ] **CI/CD** - GitHub Action for performance testing in pipelines
- [ ] **Assertions** - Performance validation (fail if latency > threshold)
