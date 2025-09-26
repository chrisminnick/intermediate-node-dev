# Logging & Monitoring Lab

A comprehensive Node.js application demonstrating production-ready logging, monitoring, and health check implementations using Winston, Prometheus, Grafana, and the ELK stack.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop
- 8GB+ RAM recommended

### One-Command Setup

```bash
# Clone and start the full monitoring stack
git clone <repository>
cd logging-monitoring-lab
npm install
docker-compose up -d
npm start
```

### Access the Application

- **Main App**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200

## 📁 Project Structure

```
logging-monitoring-lab/
├── app.js                      # Main Express application
├── package.json               # Dependencies and scripts
├── Dockerfile                 # Multi-stage container build
├── docker-compose.yml         # Full monitoring stack
├── src/
│   ├── utils/
│   │   ├── logger.js          # Winston logging configuration
│   │   └── metrics.js         # Prometheus metrics setup
│   ├── middleware/
│   │   ├── logging.js         # Request/response logging
│   │   ├── metrics.js         # Metrics collection middleware
│   │   └── errorHandlers.js   # Comprehensive error handling
│   └── routes/
│       ├── health.js          # Health check endpoints
│       ├── api.js             # General API endpoints
│       └── users.js           # User management endpoints
├── tests/
│   └── app.test.js           # Comprehensive test suite
├── monitoring/
│   ├── prometheus.yml        # Prometheus configuration
│   ├── grafana/             # Grafana dashboards & datasources
│   ├── logstash/            # Log processing configuration
│   └── nginx/               # Reverse proxy configuration
└── logs/                    # Application log files
```

## 🎯 Features Demonstrated

### Comprehensive Logging

- **Structured JSON Logging**: Winston with multiple transports
- **Log Levels**: Error, warn, info, http, debug with appropriate filtering
- **Log Rotation**: Daily rotating files with retention policies
- **Request Logging**: Complete HTTP request/response tracking
- **Correlation IDs**: Request tracing across the application
- **Business Event Logging**: Custom business logic tracking
- **Security Event Logging**: Suspicious activity detection

### Advanced Monitoring

- **Prometheus Metrics**: 20+ custom application and system metrics
- **Health Checks**: Multi-layered health endpoints (liveness, readiness, detailed)
- **Performance Tracking**: Response times, memory usage, CPU metrics
- **Business Metrics**: User registrations, logins, operations
- **Error Tracking**: Comprehensive error classification and metrics
- **External API Monitoring**: Third-party service integration tracking

### Production-Ready Features

- **Error Handling**: Centralized error management with proper logging
- **Security**: Helmet middleware, CORS, rate limiting, input validation
- **Performance**: Compression, response caching, optimized queries
- **Graceful Shutdown**: Proper cleanup on process termination
- **Docker Support**: Multi-stage builds with security best practices
- **Health Checks**: Docker and Kubernetes compatible health endpoints

## 📊 Monitoring Stack

### Core Services

- **Application**: Node.js Express app with comprehensive instrumentation
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization dashboards and alerting
- **Elasticsearch**: Log storage and indexing
- **Kibana**: Log analysis and visualization
- **Logstash**: Log processing and enrichment

### Supporting Services

- **PostgreSQL**: Application database with connection monitoring
- **Redis**: Caching layer with performance metrics
- **Nginx**: Reverse proxy with request routing
- **Node Exporter**: System-level metrics collection
- **cAdvisor**: Container resource monitoring
- **AlertManager**: Alert routing and management

## 🔧 API Endpoints

### Health Checks

- `GET /health` - Basic application health
- `GET /health/ready` - Readiness check with dependencies
- `GET /health/detailed` - Comprehensive system status
- `GET /health/live` - Simple liveness check
- `GET /health/startup` - Startup readiness check

### Monitoring

- `GET /metrics` - Prometheus metrics endpoint
- `GET /api/status` - Application status and system info
- `GET /api/performance` - Real-time performance metrics

### Business Operations

- `POST /api/events` - Log custom business events
- `GET /api/users` - User management with full CRUD
- `POST /api/simulate/load` - Load testing simulation
- `POST /api/simulate/error` - Error condition simulation
- `POST /api/simulate/database` - Database operation simulation

## 🧪 Testing

### Run Tests

```bash
# Unit and integration tests
npm test

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Load testing
npm run test:load
```

### Test Coverage

- **Health Checks**: All health endpoints and scenarios
- **Metrics**: Prometheus metrics generation and format
- **Error Handling**: All error types and status codes
- **User Operations**: CRUD operations with validation
- **Security**: Headers, CORS, rate limiting
- **Performance**: Response time benchmarks

## 🐳 Docker Deployment

### Development Environment

```bash
# Start full stack
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Production Build

```bash
# Build production image
docker build --target production -t logging-monitoring-lab:latest .

# Run production container
docker run -d -p 3000:3000 --name monitoring-app logging-monitoring-lab:latest
```

## 📈 Grafana Dashboards

### Application Dashboard

- Request rate and response time trends
- Error rate monitoring and alerting
- Business metrics visualization
- User activity tracking

### Infrastructure Dashboard

- System resource utilization
- Container performance metrics
- Network I/O and disk usage
- Database connection pooling

### Custom Alerts

- High error rate (>5% over 5 minutes)
- Slow response times (>2s 95th percentile)
- Memory usage (>80% for 10 minutes)
- Database connectivity issues

## 📝 Log Analysis

### Structured Logging Format

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "method": "GET",
  "url": "/api/users",
  "statusCode": 200,
  "responseTime": "45ms",
  "correlationId": "uuid-correlation-id",
  "userAgent": "Mozilla/5.0...",
  "ip": "127.0.0.1"
}
```

### Log Categories

- **HTTP Requests**: All incoming requests with full context
- **Business Events**: User registrations, logins, transactions
- **Performance**: Slow queries, high memory usage, bottlenecks
- **Security**: Failed auth attempts, suspicious patterns
- **Errors**: Application exceptions with full stack traces
- **System**: Startup, shutdown, configuration changes

## 🔍 Troubleshooting

### Common Issues

1. **High Memory Usage**

   - Check `/api/performance` endpoint
   - Review memory metrics in Grafana
   - Analyze heap dumps if needed

2. **Slow Response Times**

   - Check response time percentiles
   - Review database query performance
   - Analyze external API call latencies

3. **Error Rate Spikes**
   - Check error logs in Kibana
   - Review error classification metrics
   - Analyze correlation IDs for request tracing

### Debug Commands

```bash
# View application logs in real-time
docker-compose logs -f app

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test health endpoints
curl http://localhost:3000/health/detailed

# Generate load for testing
curl -X POST http://localhost:3000/api/simulate/load \
  -H "Content-Type: application/json" \
  -d '{"requests": 100, "delay": 50}'
```

## 🔐 Security Features

### Application Security

- **Helmet**: Security headers (CSP, HSTS, etc.)
- **CORS**: Cross-origin request filtering
- **Rate Limiting**: Per-IP request throttling
- **Input Validation**: Request data sanitization
- **Error Sanitization**: Sensitive data filtering

### Container Security

- **Non-root User**: Application runs as unprivileged user
- **Minimal Base Image**: Alpine Linux for reduced attack surface
- **Health Checks**: Container liveness monitoring
- **Resource Limits**: Memory and CPU constraints

## 📚 Educational Value

This lab demonstrates:

1. **Production Logging**: Industry-standard structured logging practices
2. **Comprehensive Monitoring**: Full-stack observability implementation
3. **Health Check Patterns**: Multiple health check strategies
4. **Error Handling**: Robust error management and classification
5. **Performance Monitoring**: Application and infrastructure metrics
6. **Security Best Practices**: Multi-layered security approach
7. **Docker Integration**: Containerized development and deployment
8. **Testing Strategies**: Comprehensive test coverage patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation
6. Submit a pull request

## 📄 License

This project is part of the Intermediate Node.js Development course materials and is intended for educational purposes.

---

**Happy Monitoring! 📊✨**
