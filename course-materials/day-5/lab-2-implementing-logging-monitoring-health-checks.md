# Lab 2: Implementing Logging, Monitoring & Health Checks

## Objective

Add logging, monitoring, and health check endpoints to a Node.js application for production readiness.

## Instructions

### Part 1: Logging

1. Integrate a logging library (e.g., `winston` or `pino`) into your Node.js app.
2. Log important events, errors, and requests.

### Part 2: Monitoring

1. Set up basic monitoring with a tool like Prometheus, Grafana, or a cloud service.
2. Track metrics such as request rate, error rate, and resource usage.

### Part 3: Health Checks

1. Implement a `/health` endpoint that returns application status.
2. Ensure the endpoint is used by your cloud provider or monitoring tool.

## Deliverables

- Logging and monitoring code/config
- Health check endpoint
- Instructions for testing and verifying

## Resources

- [Winston Logging](https://github.com/winstonjs/winston)
- [Pino Logging](https://getpino.io/#/)
- [Prometheus Node.js Client](https://github.com/siimon/prom-client)
- [Grafana](https://grafana.com/docs/grafana/latest/)
- [Node.js Health Checks](https://learn.microsoft.com/en-us/azure/architecture/best-practices/health-checks)
