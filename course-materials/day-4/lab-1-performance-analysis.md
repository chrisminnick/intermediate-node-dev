# Lab 1: Application Performance Analysis & Optimization

## Learning Objectives

By the end of this lab, you will be able to:

- **Identify Performance Bottlenecks**: Use profiling tools to analyze CPU usage, memory consumption, and I/O operations
- **Implement Performance Monitoring**: Set up comprehensive performance tracking and alerting systems
- **Apply Optimization Techniques**: Implement caching strategies, efficient algorithms, and async patterns
- **Conduct Load Testing**: Use tools like Artillery and autocannon to simulate real-world traffic
- **Analyze Memory Usage**: Detect and fix memory leaks using heap snapshots and profiling
- **Optimize Database Operations**: Implement connection pooling, query optimization, and indexing strategies
- **Measure Performance Impact**: Quantify improvements using before/after metrics and benchmarking

## Scenario

You've been tasked with optimizing a Node.js e-commerce API that's experiencing performance issues under load. The application handles product searches, user authentication, order processing, and generates reports. Current issues include:

- Slow response times during peak traffic
- Memory leaks causing server crashes
- Inefficient database queries
- CPU-intensive operations blocking the event loop
- Inadequate caching strategies

## Pre-Lab Setup

### Required Tools Installation

```bash
# Install global performance tools
npm install -g clinic autocannon artillery
npm install -g 0x # For flame graph generation
npm install -g memwatch-next # For memory leak detection

# Install Chrome DevTools (if not already installed)
# Download from: https://www.google.com/chrome/
```

### Environment Preparation

1. **System Requirements**:

   - Node.js 18+ (for built-in performance APIs)
   - At least 4GB RAM for profiling
   - Chrome browser for DevTools profiling

2. **Performance Baseline Tools**:
   - `htop` or Activity Monitor for system monitoring
   - Chrome DevTools for detailed V8 profiling
   - Terminal access for command-line profiling

## Instructions

### Exercise 1: Initial Performance Assessment

#### Step 1: Application Analysis

1. **Explore the sample application structure**:

   ```bash
   cd performance-analysis-lab
   npm install
   npm start
   ```

2. **Run initial load tests** to establish baseline metrics:

   ```bash
   # Test API endpoints under load
   autocannon -c 10 -d 30 http://localhost:3000/api/products
   autocannon -c 10 -d 30 http://localhost:3000/api/search?q=laptop
   autocannon -c 10 -d 30 http://localhost:3000/api/reports/sales
   ```

3. **Document baseline performance**:
   - Record response times (avg, p95, p99)
   - Note memory usage patterns
   - Monitor CPU utilization
   - Identify error rates under load

**Expected Learning**: Understanding how to establish performance baselines and identify problem areas.

### Exercise 2: CPU Profiling with Built-in Tools

#### Step 2: V8 Inspector Profiling

1. **Start the application with inspector**:

   ```bash
   node --inspect=0.0.0.0:9229 app.js
   ```

2. **Connect Chrome DevTools**:

   - Open Chrome and navigate to `chrome://inspect`
   - Click "Open dedicated DevTools for Node"
   - Go to the "Profiler" tab

3. **Generate CPU profiles**:

   - Start CPU profiling
   - Generate load using autocannon
   - Stop profiling and analyze the flame graph
   - Identify functions consuming the most CPU time

4. **Analyze performance patterns**:
   - Look for synchronous operations blocking the event loop
   - Identify inefficient algorithms or loops
   - Note functions called frequently

**Expected Learning**: Understanding CPU profiling and identifying synchronous bottlenecks.

### Exercise 3: Memory Analysis and Leak Detection

#### Step 3: Heap Snapshot Analysis

1. **Generate heap snapshots**:

   ```bash
   # Start app with memory monitoring
   node --inspect --max-old-space-size=2048 app.js
   ```

2. **Create memory pressure**:

   ```bash
   # Run sustained load to trigger potential leaks
   autocannon -c 20 -d 300 http://localhost:3000/api/products
   ```

3. **Compare heap snapshots**:

   - Take snapshot before load test
   - Take snapshot during peak load
   - Take snapshot after load test completion
   - Analyze memory growth patterns

4. **Identify memory leaks**:
   - Look for objects that don't get garbage collected
   - Identify growing arrays or caches
   - Find event listeners that aren't removed

**Expected Learning**: Memory profiling techniques and leak detection strategies.

### Exercise 4: Advanced Profiling with Clinic.js

#### Step 4: Comprehensive Performance Analysis

1. **Install and run Clinic.js tools**:

   ```bash
   # CPU profiling with flame graphs
   clinic flame -- node app.js &
   sleep 5
   autocannon -c 10 -d 60 http://localhost:3000/api/search?q=test
   pkill -f "node app.js"

   # Event loop monitoring
   clinic bubbleprof -- node app.js &
   sleep 5
   autocannon -c 10 -d 60 http://localhost:3000/api/reports/sales
   pkill -f "node app.js"

   # Memory and GC analysis
   clinic heapprofiler -- node app.js &
   sleep 5
   autocannon -c 10 -d 60 http://localhost:3000/api/products
   pkill -f "node app.js"
   ```

2. **Analyze generated reports**:
   - Review flame graphs for CPU hotspots
   - Examine bubble graphs for async operation delays
   - Study heap profiles for memory usage patterns

**Expected Learning**: Advanced profiling tools and interpreting complex performance data.

### Exercise 5: Database Query Optimization

#### Step 5: Database Performance Analysis

1. **Enable query logging**:

   ```javascript
   // Add to database configuration
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     log: (sql, params) => {
       const start = Date.now();
       return (...args) => {
         const duration = Date.now() - start;
         if (duration > 100) {
           // Log slow queries
           console.log(`Slow Query (${duration}ms): ${sql}`);
         }
       };
     },
   });
   ```

2. **Analyze query performance**:

   - Identify N+1 query problems
   - Find missing database indexes
   - Optimize complex joins and aggregations

3. **Implement query optimizations**:
   - Add appropriate database indexes
   - Implement query result caching
   - Use database connection pooling
   - Optimize data fetching patterns

**Expected Learning**: Database performance optimization and query analysis.

### Exercise 6: Caching Strategy Implementation

#### Step 6: Multi-Level Caching

1. **Implement in-memory caching**:

   ```javascript
   const NodeCache = require('node-cache');
   const cache = new NodeCache({ stdTTL: 300 });

   // Cache expensive computations
   app.get('/api/reports/sales', async (req, res) => {
     const cacheKey = `sales-report-${JSON.stringify(req.query)}`;
     let result = cache.get(cacheKey);

     if (!result) {
       result = await generateSalesReport(req.query);
       cache.set(cacheKey, result);
     }

     res.json(result);
   });
   ```

2. **Add Redis caching layer**:

   ```javascript
   const redis = require('redis');
   const client = redis.createClient();

   // Implement distributed caching
   async function getCachedData(key, fetchFunction, ttl = 300) {
     try {
       const cached = await client.get(key);
       if (cached) return JSON.parse(cached);

       const data = await fetchFunction();
       await client.setex(key, ttl, JSON.stringify(data));
       return data;
     } catch (error) {
       return await fetchFunction(); // Fallback to direct fetch
     }
   }
   ```

3. **Implement cache invalidation strategies**:
   - Time-based expiration (TTL)
   - Event-based invalidation
   - Cache warming techniques

**Expected Learning**: Caching strategies and implementation patterns.

### Exercise 7: Async Pattern Optimization

#### Step 7: Event Loop Optimization

1. **Identify blocking operations**:

   ```javascript
   // Before: Synchronous file operations
   const fs = require('fs');
   const data = fs.readFileSync('large-file.json'); // Blocks event loop

   // After: Asynchronous operations
   const fsPromises = require('fs').promises;
   const data = await fsPromises.readFile('large-file.json');
   ```

2. **Optimize CPU-intensive tasks**:

   ```javascript
   const {
     Worker,
     isMainThread,
     parentPort,
     workerData,
   } = require('worker_threads');

   if (isMainThread) {
     // Main thread - delegate CPU work to worker
     function processLargeDataset(data) {
       return new Promise((resolve, reject) => {
         const worker = new Worker(__filename, {
           workerData: { data },
         });
         worker.on('message', resolve);
         worker.on('error', reject);
       });
     }
   } else {
     // Worker thread - perform CPU-intensive work
     const result = performComplexCalculation(workerData.data);
     parentPort.postMessage(result);
   }
   ```

3. **Implement proper error handling**:

   ```javascript
   // Graceful error handling that doesn't crash the server
   process.on('uncaughtException', (error) => {
     console.error('Uncaught Exception:', error);
     // Log error but don't exit in production
   });

   process.on('unhandledRejection', (reason, promise) => {
     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
   });
   ```

**Expected Learning**: Async optimization patterns and error handling strategies.

### Exercise 8: Performance Monitoring Implementation

#### Step 8: Production Monitoring Setup

1. **Implement custom performance metrics**:

   ```javascript
   const { PerformanceObserver, performance } = require('perf_hooks');

   // Monitor HTTP request performance
   app.use((req, res, next) => {
     const start = performance.now();

     res.on('finish', () => {
       const duration = performance.now() - start;
       console.log(`${req.method} ${req.path}: ${duration.toFixed(2)}ms`);

       // Alert on slow requests
       if (duration > 1000) {
         console.warn(`Slow request detected: ${req.method} ${req.path}`);
       }
     });

     next();
   });
   ```

2. **Set up health check endpoints**:

   ```javascript
   app.get('/health', async (req, res) => {
     const health = {
       uptime: process.uptime(),
       memory: process.memoryUsage(),
       cpu: process.cpuUsage(),
       timestamp: Date.now(),
     };

     // Check database connectivity
     try {
       await db.query('SELECT 1');
       health.database = 'connected';
     } catch (error) {
       health.database = 'disconnected';
     }

     res.json(health);
   });
   ```

3. **Implement performance alerting**:

   ```javascript
   // Simple alerting system
   function checkPerformanceThresholds() {
     const memUsage = process.memoryUsage();
     const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

     if (heapUsedMB > 500) {
       console.alert(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
     }
   }

   setInterval(checkPerformanceThresholds, 30000);
   ```

**Expected Learning**: Production monitoring and alerting implementation.

### Exercise 9: Load Testing and Benchmarking

#### Step 9: Comprehensive Performance Testing

1. **Create realistic load test scenarios**:

   ```yaml
   # artillery-config.yml
   config:
     target: 'http://localhost:3000'
     phases:
       - duration: 60
         arrivalRate: 5
         name: 'Warm up'
       - duration: 120
         arrivalRate: 10
         rampTo: 50
         name: 'Ramp up load'
       - duration: 300
         arrivalRate: 50
         name: 'Sustained load'

   scenarios:
     - name: 'Product search workflow'
       weight: 70
       flow:
         - get:
             url: '/api/products'
         - get:
             url: '/api/search?q={{ $randomString() }}'

     - name: 'Report generation'
       weight: 30
       flow:
         - get:
             url: '/api/reports/sales'
   ```

2. **Run comprehensive benchmarks**:

   ```bash
   # Before optimization
   artillery run artillery-config.yml --output before-optimization.json

   # After optimization
   artillery run artillery-config.yml --output after-optimization.json

   # Compare results
   artillery report before-optimization.json
   artillery report after-optimization.json
   ```

**Expected Learning**: Load testing strategies and performance comparison methods.

### Exercise 10: Documentation and Reporting

#### Step 10: Performance Analysis Report

1. **Create performance comparison report**:

   - Document baseline vs optimized metrics
   - Include before/after profiling screenshots
   - Quantify improvements (response time, throughput, memory usage)
   - List specific optimizations implemented

2. **Prepare recommendations document**:
   - Prioritize remaining performance improvements
   - Suggest monitoring and alerting strategies
   - Document performance best practices for the team

**Expected Learning**: Performance reporting and documentation best practices.

## Advanced Concepts

### Real-World Performance Patterns

1. **Microservice Performance**:

   - Service-to-service communication optimization
   - Circuit breaker patterns for resilience
   - Distributed tracing for performance debugging

2. **Container Performance**:

   - Docker container optimization
   - Resource limit tuning
   - Multi-stage build optimization

3. **CDN and Edge Optimization**:
   - Static asset optimization
   - Edge caching strategies
   - Geographic distribution optimization

## Assessment Criteria

### Technical Implementation (40%)

- **Profiling Tool Usage**: Correct application of Node.js profiling tools
- **Optimization Techniques**: Effective implementation of performance improvements
- **Code Quality**: Clean, maintainable optimized code

### Performance Analysis (35%)

- **Bottleneck Identification**: Accurate identification of performance issues
- **Metric Collection**: Comprehensive baseline and post-optimization measurements
- **Impact Quantification**: Clear documentation of performance improvements

### Documentation & Reporting (25%)

- **Analysis Report**: Clear documentation of findings and optimizations
- **Methodology**: Well-structured approach to performance analysis
- **Recommendations**: Actionable suggestions for ongoing performance management

## Deliverables

### Required Submissions

1. **Performance Analysis Report**:

   - Executive summary of findings
   - Detailed optimization documentation
   - Before/after performance comparisons
   - Profiling screenshots and data

2. **Optimized Source Code**:

   - Complete optimized application
   - Performance monitoring implementation
   - Load testing configurations

3. **Benchmark Results**:
   - Baseline performance data
   - Post-optimization benchmarks
   - Load testing reports
   - Memory usage analysis

### Bonus Deliverables

- **Performance Dashboard**: Real-time monitoring interface
- **Automated Testing**: CI/CD performance testing integration
- **Scalability Analysis**: Recommendations for horizontal scaling

## Resources

### Documentation

- [Node.js Performance Guide](https://nodejs.org/en/docs/guides/simple-profiling/)
- [V8 Performance Optimization](https://v8.dev/docs/optimize)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/evaluate-performance/)

### Tools & Libraries

- [Clinic.js](https://clinicjs.org/) - Comprehensive performance toolkit
- [Artillery](https://artillery.io/) - Load testing framework
- [AutoCannon](https://github.com/mcollina/autocannon) - HTTP benchmarking tool
- [0x](https://github.com/davidmarkclements/0x) - Flame graph profiling

### Advanced Reading

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/nodejs-performance-best-practices/)
- [Memory Management in V8](https://v8.dev/blog/memory-management)
- [Event Loop Performance](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/)

---
