# Lab 2: Implementing Logging, Monitoring & Health Checks

## 🎯 Objective

Build a production-ready Node.js application with comprehensive logging, monitoring, and health check systems. Learn to implement observability best practices that are essential for maintaining applications in production environments.

## 📚 Learning Outcomes

By completing this lab, you will:

- Implement structured logging with Winston
- Set up application metrics collection with Prometheus
- Create comprehensive health check endpoints
- Build monitoring dashboards with Grafana
- Understand observability patterns for Node.js applications
- Deploy monitoring infrastructure using Docker Compose

## 🛠️ Prerequisites

- Node.js 18+ installed
- Docker Desktop running
- Basic understanding of Express.js
- Familiarity with JSON and HTTP concepts

## 📋 Lab Exercises

### Exercise 1: Project Setup and Basic Application

**Objective**: Create a base Express application with proper project structure.

**Tasks**:

1. Initialize a new Node.js project with `npm init`
2. Install required dependencies:
   ```bash
   npm install express cors helmet compression
   npm install --save-dev nodemon jest supertest
   ```
3. Create a basic Express server with:
   - CORS middleware
   - Security headers with Helmet
   - JSON parsing
   - Error handling middleware
4. Set up development scripts in `package.json`

**Expected Outcome**: A working Express server on port 3000 with basic middleware.

---

### Exercise 2: Structured Logging Implementation

**Objective**: Implement comprehensive logging using Winston with multiple transports and log levels.

**Tasks**:

1. Install Winston logging library:

   ```bash
   npm install winston winston-daily-rotate-file
   ```

2. Create a logging configuration module that includes:

   - Console transport for development
   - File transport for persistent logging
   - Daily rotating file transport for log management
   - Different log levels (error, warn, info, debug)
   - Structured JSON format for production

3. Implement request logging middleware that captures:

   - HTTP method and URL
   - Response status code
   - Response time
   - User agent and IP address
   - Request ID for tracing

4. Add error logging that captures:

   - Error stack traces
   - Request context
   - User information (if available)
   - Timestamp and correlation IDs

5. Create application event logging for:
   - Server startup/shutdown
   - Database connections
   - Authentication events
   - Business logic events

**Expected Outcome**: Comprehensive logging system with structured output, multiple transports, and proper log levels.

---

### Exercise 3: Metrics Collection with Prometheus

**Objective**: Implement application metrics collection using Prometheus client library.

**Tasks**:

1. Install Prometheus client:

   ```bash
   npm install prom-client
   ```

2. Create metrics collection module with:

   - HTTP request counter (by method, route, status code)
   - HTTP request duration histogram
   - Active connections gauge
   - Custom business metrics (e.g., user registrations, orders)
   - Node.js process metrics (memory, CPU, event loop lag)

3. Implement metrics middleware that:

   - Tracks all HTTP requests
   - Measures response times
   - Counts errors by type
   - Monitors route-specific metrics

4. Create `/metrics` endpoint for Prometheus scraping

5. Add custom metrics for your application domain:
   - Database query performance
   - Cache hit/miss ratios
   - Queue lengths
   - Business KPIs

**Expected Outcome**: Prometheus metrics endpoint exposing comprehensive application and system metrics.

---

### Exercise 4: Advanced Health Check System

**Objective**: Build a multi-layered health check system with dependency monitoring.

**Tasks**:

1. Create health check utilities that test:

   - Application responsiveness
   - Database connectivity
   - Redis/cache availability
   - External API dependencies
   - File system access
   - Memory and CPU thresholds

2. Implement health check endpoints:

   - `/health` - Basic liveness check
   - `/health/ready` - Readiness check with dependencies
   - `/health/detailed` - Comprehensive system status

3. Add health check response formats:

   - Simple status (UP/DOWN)
   - Detailed component status
   - Performance metrics
   - Dependency response times

4. Implement graceful degradation:

   - Circuit breaker patterns
   - Timeout handling
   - Retry logic for dependencies
   - Fallback responses

5. Create health check scheduling:
   - Background health monitoring
   - Automated alerts on failures
   - Health status caching

**Expected Outcome**: Comprehensive health check system with multiple endpoints and dependency monitoring.

---

### Exercise 5: Error Handling and Alerting

**Objective**: Implement robust error handling with proper logging and alerting mechanisms.

**Tasks**:

1. Create centralized error handling:

   - Global error handler middleware
   - Async error catching
   - Error classification (4xx vs 5xx)
   - Error response formatting

2. Implement error logging:

   - Stack trace capture
   - Request context preservation
   - Error correlation IDs
   - Structured error data

3. Add error metrics:

   - Error rate monitoring
   - Error type classification
   - Performance impact tracking
   - Error trend analysis

4. Create alerting mechanisms:
   - Threshold-based alerts
   - Error spike detection
   - Dependency failure alerts
   - Performance degradation warnings

**Expected Outcome**: Robust error handling system with comprehensive logging and monitoring.

---

### Exercise 6: Performance Monitoring

**Objective**: Implement application performance monitoring with detailed metrics.

**Tasks**:

1. Add performance tracking:

   - Response time percentiles
   - Memory usage monitoring
   - CPU utilization tracking
   - Event loop lag measurement

2. Implement database performance monitoring:

   - Query execution times
   - Connection pool metrics
   - Slow query detection
   - Database health checks

3. Create performance dashboards:

   - Real-time performance metrics
   - Historical trend analysis
   - Performance baseline comparison
   - Anomaly detection

4. Add performance alerting:
   - Response time thresholds
   - Memory leak detection
   - CPU spike alerts
   - Database performance warnings

**Expected Outcome**: Comprehensive performance monitoring system with metrics and alerting.

---

### Exercise 7: Grafana Dashboard Setup

**Objective**: Create comprehensive monitoring dashboards using Grafana and Prometheus.

**Tasks**:

1. Set up Grafana with Docker:

   - Configure data sources
   - Set up Prometheus integration
   - Configure authentication
   - Set up persistent storage

2. Create application dashboard with:

   - Request rate and response time graphs
   - Error rate monitoring
   - Active users and sessions
   - Business metrics visualization

3. Build infrastructure dashboard showing:

   - CPU and memory usage
   - Network I/O metrics
   - Disk usage and I/O
   - Container resource utilization

4. Create alerting rules in Grafana:

   - Performance threshold alerts
   - Error rate spike detection
   - Dependency failure notifications
   - Capacity planning alerts

5. Set up alert channels:
   - Email notifications
   - Slack integration
   - Webhook notifications
   - SMS alerts for critical issues

**Expected Outcome**: Professional monitoring dashboards with comprehensive alerting.

---

### Exercise 8: Log Analysis and Monitoring

**Objective**: Implement log aggregation and analysis using ELK stack or similar tools.

**Tasks**:

1. Set up log aggregation:

   - Centralized log collection
   - Log parsing and indexing
   - Search and query capabilities
   - Log retention policies

2. Create log analysis dashboards:

   - Error frequency analysis
   - User behavior tracking
   - Performance bottleneck identification
   - Security event monitoring

3. Implement log-based alerting:

   - Error pattern detection
   - Unusual activity alerts
   - Performance anomaly detection
   - Security threat identification

4. Add log correlation:
   - Request tracing across services
   - Error correlation analysis
   - Performance correlation tracking
   - User journey analysis

**Expected Outcome**: Comprehensive log analysis system with search, alerting, and correlation capabilities.

---

### Exercise 9: Production Deployment and Monitoring

**Objective**: Deploy the monitoring stack to a production-like environment.

**Tasks**:

1. Create production-ready configuration:

   - Environment-specific settings
   - Security configurations
   - Performance optimizations
   - Resource allocation

2. Set up monitoring infrastructure:

   - Prometheus server deployment
   - Grafana dashboard deployment
   - Log aggregation setup
   - Alerting system configuration

3. Implement monitoring best practices:

   - Service discovery configuration
   - High availability setup
   - Backup and recovery procedures
   - Security hardening

4. Create runbooks and documentation:
   - Incident response procedures
   - Troubleshooting guides
   - Monitoring setup documentation
   - Alert escalation procedures

**Expected Outcome**: Production-ready monitoring stack with comprehensive documentation.

---

### Exercise 10: Testing and Validation

**Objective**: Thoroughly test all monitoring, logging, and health check systems.

**Tasks**:

1. Create comprehensive test suite:

   - Unit tests for logging functions
   - Integration tests for health checks
   - Performance tests for metrics collection
   - End-to-end monitoring tests

2. Implement chaos engineering tests:

   - Dependency failure simulation
   - Resource exhaustion testing
   - Network partition testing
   - High load scenario testing

3. Validate alerting systems:

   - Alert trigger testing
   - Escalation procedure validation
   - False positive detection
   - Alert fatigue prevention

4. Performance validation:
   - Monitoring overhead assessment
   - Scalability testing
   - Resource usage optimization
   - Performance baseline establishment

**Expected Outcome**: Fully tested and validated monitoring, logging, and health check systems.

## 🎯 Success Criteria

Your implementation should demonstrate:

1. **Structured Logging**: Winston-based logging with multiple transports and proper log levels
2. **Comprehensive Metrics**: Prometheus metrics covering application and infrastructure
3. **Robust Health Checks**: Multi-layered health endpoints with dependency monitoring
4. **Professional Dashboards**: Grafana dashboards with meaningful visualizations
5. **Effective Alerting**: Threshold-based alerts with proper escalation
6. **Performance Monitoring**: Detailed performance metrics and trend analysis
7. **Error Handling**: Comprehensive error tracking and analysis
8. **Production Readiness**: Configuration suitable for production deployment
9. **Documentation**: Clear documentation and runbooks
10. **Testing**: Comprehensive test coverage for all monitoring components

## 💡 Best Practices

### Logging Best Practices:

- Use structured logging (JSON format)
- Include correlation IDs for request tracing
- Log at appropriate levels (don't over-log)
- Include context information in logs
- Implement log sampling for high-volume applications

### Monitoring Best Practices:

- Monitor what matters to users and business
- Use RED method (Rate, Errors, Duration)
- Implement the four golden signals
- Set up proactive vs reactive monitoring
- Create actionable alerts, not noise

### Health Check Best Practices:

- Separate liveness from readiness checks
- Test actual dependencies, not just connectivity
- Implement timeout and circuit breaker patterns
- Cache health check results when appropriate
- Return detailed status information

## 📦 Deliverables

Your completed lab should include:

1. **Application Code**:

   - Express.js application with middleware
   - Logging configuration and utilities
   - Metrics collection implementation
   - Health check endpoints
   - Error handling middleware

2. **Configuration Files**:

   - Docker Compose for monitoring stack
   - Prometheus configuration
   - Grafana dashboard definitions
   - Environment-specific configurations

3. **Dashboards**:

   - Application performance dashboard
   - Infrastructure monitoring dashboard
   - Business metrics dashboard
   - Alert management dashboard

4. **Documentation**:

   - Setup and deployment instructions
   - Monitoring runbooks
   - Troubleshooting guides
   - API documentation

5. **Tests**:
   - Unit tests for all components
   - Integration tests for health checks
   - Performance tests for monitoring overhead
   - Chaos engineering test scenarios

## 🔧 Technical Requirements

### Logging Requirements:

- Winston logger with multiple transports
- Structured JSON logging format
- Request/response logging middleware
- Error logging with stack traces
- Log rotation and retention policies

### Monitoring Requirements:

- Prometheus metrics collection
- Custom application metrics
- System resource monitoring
- Performance tracking
- Real-time alerting

### Health Check Requirements:

- Multiple health check endpoints
- Dependency health monitoring
- Circuit breaker implementation
- Health status caching
- Graceful degradation

## 🚀 Getting Started

1. **Clone the solution directory** (after completion):

   ```bash
   cd course-materials/day-5/logging-monitoring-lab
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the monitoring stack**:

   ```bash
   docker-compose up -d
   ```

4. **Run the application**:

   ```bash
   npm start
   ```

5. **Access monitoring dashboards**:
   - Application: http://localhost:3000
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (admin/admin)

## 📚 Resources

### Core Documentation:

- [Winston Logging Library](https://github.com/winstonjs/winston) - Comprehensive logging solution
- [Prometheus Node.js Client](https://github.com/siimon/prom-client) - Metrics collection
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/) - Dashboard creation
- [Express.js Documentation](https://expressjs.com/) - Web framework

### Monitoring and Observability:

- [The Three Pillars of Observability](https://peter.bourgon.org/blog/2017/02/21/metrics-tracing-and-logging.html)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Node.js Performance Monitoring](https://nodejs.org/en/docs/guides/simple-profiling/)

### Health Checks and Reliability:

- [Health Check Patterns](https://microservices.io/patterns/observability/health-check-api.html)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Graceful Shutdown in Node.js](https://medium.com/@gazzaazhari/graceful-shutdown-in-nodejs-f1b1d1d1a2d5)

### Logging and Structured Data:

- [Structured Logging Best Practices](https://charity.wtf/2019/02/05/logs-vs-structured-events/)
- [Log Correlation and Tracing](https://peter.bourgon.org/blog/2016/02/07/logging-v-instrumentation.html)
- [Node.js Logging Best Practices](https://blog.risingstack.com/node-js-logging-tutorial/)

### Performance and Optimization:

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Monitoring Node.js Performance](https://blog.risingstack.com/monitoring-nodejs-applications/)
- [Application Performance Monitoring](https://newrelic.com/resources/ebooks/application-performance-monitoring-explained)

---

**Time Estimate**: 6-8 hours  
**Difficulty Level**: Intermediate to Advanced  
**Prerequisites**: Node.js, Express.js, Docker basics
