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

## AI-Powered Features

### Scenario Generation

- [ ] **Natural Language to YAML** - Describe user journeys in plain English, AI generates YAML scenarios
- [ ] **Intelligent Crawling** - Analyze a website and auto-generate realistic user paths
- [ ] **Analytics-based Scenarios** - Create scenarios from real user behavior data (Google Analytics, Matomo)

### Results Analysis

- [ ] **Anomaly Detection** - Automatically identify unusual metrics and patterns
- [ ] **Root Cause Analysis** - Suggest probable causes for performance issues
- [ ] **Regression Detection** - Compare test runs and alert on performance degradation
- [ ] **Natural Language Reports** - Auto-generate human-readable test summaries

### Adaptive Testing

- [ ] **Intelligent Load** - Dynamically adjust load based on system response
- [ ] **Auto-exploration** - Automatically find breaking points without manual configuration
- [ ] **Capacity Prediction** - Estimate when the system will reach its limits

### Self-healing Scenarios

- [ ] **Adaptive Selectors** - Auto-fix CSS/XPath selectors when UI changes
- [ ] **Dynamic Content Handling** - Intelligently adapt assertions to content variations

### Conversational Interface

- [ ] **Chat Control** - Natural language commands: "Run a load test on login page with 100 users"
- [ ] **Results Q&A** - Ask questions: "Which page has the highest latency?"
- [ ] **Debug Assistant** - Analyze logs and suggest fixes

### Visual Analysis

- [ ] **Visual Regression Under Load** - Detect rendering issues during performance tests
- [ ] **Screenshot Analysis** - Identify visual errors (blank pages, broken layouts, error messages)
