class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        cached: 0,
        uncached: 0,
      },
      responseTimes: {
        cached: [],
        uncached: [],
      },
      cacheStats: {
        hits: 0,
        misses: 0,
      },
      endpoints: new Map(),
    };
  }

  /**
   * Record a request
   * @param {string} endpoint - API endpoint
   * @param {number} responseTime - Response time in ms
   * @param {boolean} cached - Whether response was cached
   */
  recordRequest(endpoint, responseTime, cached = false) {
    this.metrics.requests.total++;

    if (cached) {
      this.metrics.requests.cached++;
      this.metrics.responseTimes.cached.push(responseTime);
      this.metrics.cacheStats.hits++;
    } else {
      this.metrics.requests.uncached++;
      this.metrics.responseTimes.uncached.push(responseTime);
      this.metrics.cacheStats.misses++;
    }

    // Track per-endpoint metrics
    if (!this.metrics.endpoints.has(endpoint)) {
      this.metrics.endpoints.set(endpoint, {
        total: 0,
        cached: 0,
        uncached: 0,
        avgResponseTime: 0,
        responseTimes: [],
      });
    }

    const endpointStats = this.metrics.endpoints.get(endpoint);
    endpointStats.total++;
    endpointStats.responseTimes.push(responseTime);
    endpointStats.avgResponseTime = this.calculateAverage(
      endpointStats.responseTimes
    );

    if (cached) {
      endpointStats.cached++;
    } else {
      endpointStats.uncached++;
    }
  }

  /**
   * Calculate average from array of numbers
   * @param {Array<number>} numbers
   * @returns {number}
   */
  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
  }

  /**
   * Calculate percentile
   * @param {Array<number>} numbers
   * @param {number} percentile
   * @returns {number}
   */
  calculatePercentile(numbers, percentile) {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get performance statistics
   * @returns {Object}
   */
  getStats() {
    const cachedTimes = this.metrics.responseTimes.cached;
    const uncachedTimes = this.metrics.responseTimes.uncached;

    const stats = {
      summary: {
        totalRequests: this.metrics.requests.total,
        cachedRequests: this.metrics.requests.cached,
        uncachedRequests: this.metrics.requests.uncached,
        cacheHitRatio:
          this.metrics.requests.total > 0
            ? (
                (this.metrics.requests.cached / this.metrics.requests.total) *
                100
              ).toFixed(2) + '%'
            : '0%',
      },
      responseTimeStats: {
        cached: {
          count: cachedTimes.length,
          average: this.calculateAverage(cachedTimes),
          min: cachedTimes.length > 0 ? Math.min(...cachedTimes) : 0,
          max: cachedTimes.length > 0 ? Math.max(...cachedTimes) : 0,
          p50: this.calculatePercentile(cachedTimes, 50),
          p95: this.calculatePercentile(cachedTimes, 95),
          p99: this.calculatePercentile(cachedTimes, 99),
        },
        uncached: {
          count: uncachedTimes.length,
          average: this.calculateAverage(uncachedTimes),
          min: uncachedTimes.length > 0 ? Math.min(...uncachedTimes) : 0,
          max: uncachedTimes.length > 0 ? Math.max(...uncachedTimes) : 0,
          p50: this.calculatePercentile(uncachedTimes, 50),
          p95: this.calculatePercentile(uncachedTimes, 95),
          p99: this.calculatePercentile(uncachedTimes, 99),
        },
      },
      endpoints: {},
    };

    // Convert endpoint stats to plain object
    for (const [endpoint, endpointStats] of this.metrics.endpoints) {
      stats.endpoints[endpoint] = {
        ...endpointStats,
        cacheHitRatio:
          endpointStats.total > 0
            ? ((endpointStats.cached / endpointStats.total) * 100).toFixed(2) +
              '%'
            : '0%',
      };

      // Remove raw response times array to keep response size manageable
      delete stats.endpoints[endpoint].responseTimes;
    }

    // Calculate performance improvement
    if (
      stats.responseTimeStats.cached.count > 0 &&
      stats.responseTimeStats.uncached.count > 0
    ) {
      const improvement =
        ((stats.responseTimeStats.uncached.average -
          stats.responseTimeStats.cached.average) /
          stats.responseTimeStats.uncached.average) *
        100;
      stats.performanceImprovement = improvement.toFixed(2) + '%';
    }

    return stats;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        cached: 0,
        uncached: 0,
      },
      responseTimes: {
        cached: [],
        uncached: [],
      },
      cacheStats: {
        hits: 0,
        misses: 0,
      },
      endpoints: new Map(),
    };
  }

  /**
   * Run performance comparison test
   * @param {Function} testFunction - Function to test
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async runPerformanceTest(testFunction, options = {}) {
    const {
      iterations = 10,
      warmupIterations = 2,
      name = 'Performance Test',
    } = options;

    console.log(
      `🧪 Running ${name} (${warmupIterations} warmup + ${iterations} iterations)...`
    );

    const times = [];

    // Warmup iterations (not counted in final results)
    for (let i = 0; i < warmupIterations; i++) {
      try {
        await testFunction();
      } catch (error) {
        console.warn(`Warmup iteration ${i + 1} failed:`, error.message);
      }
    }

    // Actual test iterations
    for (let i = 0; i < iterations; i++) {
      try {
        const start = process.hrtime.bigint();
        await testFunction();
        const end = process.hrtime.bigint();

        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        times.push(duration);
      } catch (error) {
        console.warn(`Test iteration ${i + 1} failed:`, error.message);
        times.push(null); // Mark failed iteration
      }
    }

    // Filter out failed iterations
    const validTimes = times.filter((time) => time !== null);

    if (validTimes.length === 0) {
      throw new Error('All test iterations failed');
    }

    const results = {
      name,
      iterations: iterations,
      successfulIterations: validTimes.length,
      failedIterations: iterations - validTimes.length,
      times: validTimes,
      average: this.calculateAverage(validTimes),
      min: Math.min(...validTimes),
      max: Math.max(...validTimes),
      p50: this.calculatePercentile(validTimes, 50),
      p95: this.calculatePercentile(validTimes, 95),
      p99: this.calculatePercentile(validTimes, 99),
      standardDeviation: this.calculateStandardDeviation(validTimes),
      timestamp: new Date().toISOString(),
    };

    console.log(
      `✅ ${name} completed: avg ${results.average.toFixed(
        2
      )}ms, min ${results.min.toFixed(2)}ms, max ${results.max.toFixed(2)}ms`
    );

    return results;
  }

  /**
   * Calculate standard deviation
   * @param {Array<number>} numbers
   * @returns {number}
   */
  calculateStandardDeviation(numbers) {
    if (numbers.length === 0) return 0;

    const mean = this.calculateAverage(numbers);
    const squaredDifferences = numbers.map((x) => Math.pow(x - mean, 2));
    const avgSquaredDiff = this.calculateAverage(squaredDifferences);

    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Compare performance between cached and uncached scenarios
   * @param {Function} cachedFunction - Function that uses cache
   * @param {Function} uncachedFunction - Function that bypasses cache
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Comparison results
   */
  async comparePerformance(cachedFunction, uncachedFunction, options = {}) {
    const testOptions = {
      iterations: 10,
      warmupIterations: 2,
      ...options,
    };

    console.log('🔬 Starting performance comparison...');

    const [cachedResults, uncachedResults] = await Promise.all([
      this.runPerformanceTest(cachedFunction, {
        ...testOptions,
        name: 'Cached Request',
      }),
      this.runPerformanceTest(uncachedFunction, {
        ...testOptions,
        name: 'Uncached Request',
      }),
    ]);

    const improvement =
      ((uncachedResults.average - cachedResults.average) /
        uncachedResults.average) *
      100;
    const speedupFactor = uncachedResults.average / cachedResults.average;

    const comparison = {
      cached: cachedResults,
      uncached: uncachedResults,
      improvement: {
        percentage: improvement.toFixed(2) + '%',
        speedupFactor: speedupFactor.toFixed(2) + 'x',
        timeSaved:
          (uncachedResults.average - cachedResults.average).toFixed(2) + 'ms',
      },
      recommendation: this.getPerformanceRecommendation(improvement),
      timestamp: new Date().toISOString(),
    };

    console.log(
      `📊 Performance improvement: ${comparison.improvement.percentage} (${comparison.improvement.speedupFactor} faster)`
    );

    return comparison;
  }

  /**
   * Get performance recommendation based on improvement
   * @param {number} improvement - Percentage improvement
   * @returns {string}
   */
  getPerformanceRecommendation(improvement) {
    if (improvement > 80) {
      return 'Excellent caching performance! Cache is providing significant benefits.';
    } else if (improvement > 50) {
      return 'Good caching performance. Consider optimizing cache TTL or data size.';
    } else if (improvement > 20) {
      return 'Moderate caching benefits. Review cache strategy and TTL settings.';
    } else if (improvement > 0) {
      return 'Minor caching benefits. Consider if caching overhead is worth it.';
    } else {
      return 'Caching may be adding overhead. Review cache implementation.';
    }
  }

  /**
   * Generate performance report
   * @returns {Object}
   */
  generateReport() {
    const stats = this.getStats();

    return {
      generatedAt: new Date().toISOString(),
      summary: stats.summary,
      performance: {
        ...stats.responseTimeStats,
        improvement: stats.performanceImprovement || 'N/A',
      },
      endpoints: stats.endpoints,
      recommendations: this.generateRecommendations(stats),
    };
  }

  /**
   * Generate performance recommendations
   * @param {Object} stats - Performance statistics
   * @returns {Array<string>}
   */
  generateRecommendations(stats) {
    const recommendations = [];

    // Cache hit ratio recommendations
    const hitRatio = parseFloat(stats.summary.cacheHitRatio);
    if (hitRatio < 30) {
      recommendations.push(
        'Cache hit ratio is low. Consider increasing TTL or improving cache key strategies.'
      );
    } else if (hitRatio > 90) {
      recommendations.push(
        'Excellent cache hit ratio! Consider if TTL can be optimized further.'
      );
    }

    // Response time recommendations
    if (stats.responseTimeStats.uncached.average > 1000) {
      recommendations.push(
        'Uncached response times are high. Caching is strongly recommended for these endpoints.'
      );
    }

    if (stats.responseTimeStats.cached.average > 100) {
      recommendations.push(
        'Cached response times could be improved. Check Redis network latency and data size.'
      );
    }

    // Endpoint-specific recommendations
    for (const [endpoint, endpointStats] of Object.entries(stats.endpoints)) {
      const endpointHitRatio = parseFloat(endpointStats.cacheHitRatio);
      if (endpointHitRatio < 20 && endpointStats.total > 10) {
        recommendations.push(
          `Endpoint ${endpoint} has low cache hit ratio. Review cache strategy.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Performance looks good! Continue monitoring cache effectiveness.'
      );
    }

    return recommendations;
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
