const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'logging-monitoring-lab',
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
});

// Enable the collection of default metrics
client.collectDefaultMetrics({
  register,
  timeout: 10000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics

// HTTP request metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// Active connections
const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

// Business metrics
const userRegistrations = new client.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source'],
  registers: [register],
});

const userLogins = new client.Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['status'],
  registers: [register],
});

const businessOperations = new client.Counter({
  name: 'business_operations_total',
  help: 'Total number of business operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

const businessOperationDuration = new client.Histogram({
  name: 'business_operation_duration_seconds',
  help: 'Duration of business operations in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Database metrics
const databaseConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['database'],
  registers: [register],
});

const databaseQueries = new client.Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['database', 'operation', 'status'],
  registers: [register],
});

const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['database', 'operation'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Cache metrics
const cacheOperations = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

const cacheHitRate = new client.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  registers: [register],
});

// External API metrics
const externalApiCalls = new client.Counter({
  name: 'external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['service', 'endpoint', 'status'],
  registers: [register],
});

const externalApiDuration = new client.Histogram({
  name: 'external_api_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['service', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Error metrics
const errorRate = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
  registers: [register],
});

const unhandledErrors = new client.Counter({
  name: 'unhandled_errors_total',
  help: 'Total number of unhandled errors',
  labelNames: ['type'],
  registers: [register],
});

// Application health metrics
const healthCheckStatus = new client.Gauge({
  name: 'health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['check_type'],
  registers: [register],
});

const healthCheckDuration = new client.Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks in seconds',
  labelNames: ['check_type'],
  buckets: [0.01, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Memory and resource metrics
const memoryUsage = new client.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

const cpuUsage = new client.Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage',
  registers: [register],
});

// Rate limiting metrics
const rateLimitHits = new client.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['ip', 'endpoint'],
  registers: [register],
});

// Helper functions for common metric updates

const recordHttpRequest = (
  method,
  route,
  statusCode,
  duration,
  requestSize = 0,
  responseSize = 0
) => {
  const labels = { method, route, status_code: statusCode };

  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, duration / 1000); // Convert to seconds

  if (requestSize > 0) {
    httpRequestSize.observe({ method, route }, requestSize);
  }

  if (responseSize > 0) {
    httpResponseSize.observe(labels, responseSize);
  }
};

const recordBusinessOperation = (operation, duration, status = 'success') => {
  businessOperations.inc({ operation, status });
  businessOperationDuration.observe({ operation }, duration / 1000);
};

const recordDatabaseQuery = (
  database,
  operation,
  duration,
  status = 'success'
) => {
  databaseQueries.inc({ database, operation, status });
  databaseQueryDuration.observe({ database, operation }, duration / 1000);
};

const recordCacheOperation = (operation, status) => {
  cacheOperations.inc({ operation, status });
};

const recordExternalApiCall = (service, endpoint, duration, status) => {
  externalApiCalls.inc({ service, endpoint, status });
  externalApiDuration.observe({ service, endpoint }, duration / 1000);
};

const recordError = (type, severity = 'error') => {
  errorRate.inc({ type, severity });
};

const recordHealthCheck = (checkType, status, duration) => {
  healthCheckStatus.set({ check_type: checkType }, status ? 1 : 0);
  healthCheckDuration.observe({ check_type: checkType }, duration / 1000);
};

const updateMemoryMetrics = () => {
  const memUsage = process.memoryUsage();
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
  memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'external' }, memUsage.external);
};

const updateCpuMetrics = () => {
  const cpuUsageData = process.cpuUsage();
  const cpuPercent = (cpuUsageData.user + cpuUsageData.system) / 1000000; // Convert to seconds
  cpuUsage.set(cpuPercent);
};

// Update system metrics periodically
const updateSystemMetrics = () => {
  updateMemoryMetrics();
  updateCpuMetrics();
};

// Update metrics every 30 seconds
setInterval(updateSystemMetrics, 30000);

// Initialize metrics
updateSystemMetrics();

module.exports = {
  register,
  // Metrics instances for direct access
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
  userRegistrations,
  userLogins,
  businessOperations,
  businessOperationDuration,
  databaseConnections,
  databaseQueries,
  databaseQueryDuration,
  cacheOperations,
  cacheHitRate,
  externalApiCalls,
  externalApiDuration,
  errorRate,
  unhandledErrors,
  healthCheckStatus,
  healthCheckDuration,
  memoryUsage,
  cpuUsage,
  rateLimitHits,
  // Helper functions
  recordHttpRequest,
  recordBusinessOperation,
  recordDatabaseQuery,
  recordCacheOperation,
  recordExternalApiCall,
  recordError,
  recordHealthCheck,
  updateMemoryMetrics,
  updateCpuMetrics,
  updateSystemMetrics,
};
