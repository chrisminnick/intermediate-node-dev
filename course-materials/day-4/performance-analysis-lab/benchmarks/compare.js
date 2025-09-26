const autocannon = require('autocannon');
const fs = require('fs').promises;
const path = require('path');

// Benchmark configuration
const BENCHMARK_DURATION = 30; // seconds
const CONNECTIONS = 10;
const WARM_UP_DURATION = 10; // seconds

const endpoints = [
  {
    name: 'Products List',
    url: '/api/products?page=1&limit=20',
  },
  {
    name: 'Product Search',
    url: '/api/search?q=laptop&limit=20',
  },
  {
    name: 'Product Detail',
    url: '/api/products/sample-product-id', // Will be replaced with actual ID
  },
  {
    name: 'Sales Report',
    url: '/api/reports/sales',
  },
  {
    name: 'Health Check',
    url: '/health',
  },
];

async function runBenchmark(baseUrl, endpointConfig) {
  console.log(`\n🚀 Benchmarking: ${endpointConfig.name}`);
  console.log(`   URL: ${baseUrl}${endpointConfig.url}`);
  console.log(
    `   Duration: ${BENCHMARK_DURATION}s, Connections: ${CONNECTIONS}`
  );

  try {
    const result = await autocannon({
      url: `${baseUrl}${endpointConfig.url}`,
      connections: CONNECTIONS,
      duration: BENCHMARK_DURATION,
      headers: {
        'User-Agent': 'Performance Benchmark Script',
      },
    });

    return {
      endpoint: endpointConfig.name,
      url: endpointConfig.url,
      requests: {
        total: result.requests.total,
        average: result.requests.average,
        mean: result.requests.mean,
        stddev: result.requests.stddev,
        min: result.requests.min,
        max: result.requests.max,
      },
      latency: {
        average: result.latency.average,
        mean: result.latency.mean,
        stddev: result.latency.stddev,
        min: result.latency.min,
        max: result.latency.max,
        p50: result.latency.p50,
        p90: result.latency.p90,
        p95: result.latency.p95,
        p99: result.latency.p99,
      },
      throughput: {
        average: result.throughput.average,
        mean: result.throughput.mean,
        stddev: result.throughput.stddev,
        min: result.throughput.min,
        max: result.throughput.max,
      },
      errors: result.errors,
      timeouts: result.timeouts,
      duration: result.duration,
      start: result.start,
      finish: result.finish,
    };
  } catch (error) {
    console.error(
      `❌ Error benchmarking ${endpointConfig.name}:`,
      error.message
    );
    return {
      endpoint: endpointConfig.name,
      error: error.message,
    };
  }
}

async function getFirstProductId(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/products?page=1&limit=1`);
    const data = await response.json();
    return data.products && data.products.length > 0
      ? data.products[0].id
      : null;
  } catch (error) {
    console.warn('Could not fetch product ID, using placeholder');
    return 'placeholder-id';
  }
}

async function warmUpServer(baseUrl) {
  console.log(`🔥 Warming up server at ${baseUrl}...`);

  try {
    await autocannon({
      url: `${baseUrl}/health`,
      connections: 2,
      duration: WARM_UP_DURATION,
    });

    console.log('✅ Server warm-up complete');
  } catch (error) {
    console.warn('⚠️  Server warm-up failed:', error.message);
  }
}

async function runAllBenchmarks(baseUrl, outputFile) {
  console.log(`\n📊 Starting performance benchmarks for ${baseUrl}`);
  console.log(`📝 Results will be saved to: ${outputFile}`);

  // Warm up the server
  await warmUpServer(baseUrl);

  // Get a real product ID
  const productId = await getFirstProductId(baseUrl);

  // Update the product detail endpoint with real ID
  const updatedEndpoints = endpoints.map((endpoint) => {
    if (endpoint.name === 'Product Detail' && productId) {
      return {
        ...endpoint,
        url: `/api/products/${productId}`,
      };
    }
    return endpoint;
  });

  const results = [];

  for (const endpoint of updatedEndpoints) {
    const result = await runBenchmark(baseUrl, endpoint);
    results.push(result);

    if (result.error) {
      console.log(`❌ ${result.endpoint}: ERROR - ${result.error}`);
    } else {
      console.log(`✅ ${result.endpoint}:`);
      console.log(`   Avg Latency: ${result.latency.average.toFixed(2)}ms`);
      console.log(`   P95 Latency: ${result.latency.p95.toFixed(2)}ms`);
      console.log(`   Requests/sec: ${result.requests.average.toFixed(2)}`);
      console.log(
        `   Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(
          2
        )} MB/s`
      );

      if (result.errors > 0) {
        console.log(`   ⚠️  Errors: ${result.errors}`);
      }
    }

    // Brief pause between benchmarks
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl,
    configuration: {
      duration: BENCHMARK_DURATION,
      connections: CONNECTIONS,
      warmUpDuration: WARM_UP_DURATION,
    },
    results,
  };

  // Save results to file
  await fs.writeFile(outputFile, JSON.stringify(summary, null, 2));

  console.log(`\n📈 Benchmark Summary:`);
  console.log(`   Total endpoints tested: ${results.length}`);
  console.log(`   Successful tests: ${results.filter((r) => !r.error).length}`);
  console.log(`   Failed tests: ${results.filter((r) => r.error).length}`);

  const successfulResults = results.filter((r) => !r.error);
  if (successfulResults.length > 0) {
    const avgLatency =
      successfulResults.reduce((sum, r) => sum + r.latency.average, 0) /
      successfulResults.length;
    const avgThroughput =
      successfulResults.reduce((sum, r) => sum + r.requests.average, 0) /
      successfulResults.length;

    console.log(`   Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`   Average requests/sec: ${avgThroughput.toFixed(2)}`);
  }

  return summary;
}

async function compareResults(beforeFile, afterFile) {
  try {
    const [beforeData, afterData] = await Promise.all([
      fs.readFile(beforeFile, 'utf8').then(JSON.parse),
      fs.readFile(afterFile, 'utf8').then(JSON.parse),
    ]);

    console.log('\n📊 Performance Comparison Report');
    console.log('='.repeat(50));

    const beforeResults = beforeData.results.filter((r) => !r.error);
    const afterResults = afterData.results.filter((r) => !r.error);

    for (const beforeResult of beforeResults) {
      const afterResult = afterResults.find(
        (r) => r.endpoint === beforeResult.endpoint
      );

      if (afterResult) {
        console.log(`\n🔍 ${beforeResult.endpoint}:`);

        const latencyImprovement =
          ((beforeResult.latency.average - afterResult.latency.average) /
            beforeResult.latency.average) *
          100;
        const throughputImprovement =
          ((afterResult.requests.average - beforeResult.requests.average) /
            beforeResult.requests.average) *
          100;
        const p95Improvement =
          ((beforeResult.latency.p95 - afterResult.latency.p95) /
            beforeResult.latency.p95) *
          100;

        console.log(
          `   Avg Latency: ${beforeResult.latency.average.toFixed(
            2
          )}ms → ${afterResult.latency.average.toFixed(2)}ms (${
            latencyImprovement > 0 ? '↓' : '↑'
          }${Math.abs(latencyImprovement).toFixed(1)}%)`
        );
        console.log(
          `   P95 Latency: ${beforeResult.latency.p95.toFixed(
            2
          )}ms → ${afterResult.latency.p95.toFixed(2)}ms (${
            p95Improvement > 0 ? '↓' : '↑'
          }${Math.abs(p95Improvement).toFixed(1)}%)`
        );
        console.log(
          `   Requests/sec: ${beforeResult.requests.average.toFixed(
            2
          )} → ${afterResult.requests.average.toFixed(2)} (${
            throughputImprovement > 0 ? '↑' : '↓'
          }${Math.abs(throughputImprovement).toFixed(1)}%)`
        );

        if (latencyImprovement > 5) {
          console.log(`   🎉 Significant latency improvement!`);
        } else if (latencyImprovement < -5) {
          console.log(`   ⚠️  Latency regression detected`);
        }

        if (throughputImprovement > 10) {
          console.log(`   🚀 Great throughput improvement!`);
        }
      }
    }

    // Overall summary
    const beforeAvgLatency =
      beforeResults.reduce((sum, r) => sum + r.latency.average, 0) /
      beforeResults.length;
    const afterAvgLatency =
      afterResults.reduce((sum, r) => sum + r.latency.average, 0) /
      afterResults.length;
    const beforeAvgThroughput =
      beforeResults.reduce((sum, r) => sum + r.requests.average, 0) /
      beforeResults.length;
    const afterAvgThroughput =
      afterResults.reduce((sum, r) => sum + r.requests.average, 0) /
      afterResults.length;

    const overallLatencyImprovement =
      ((beforeAvgLatency - afterAvgLatency) / beforeAvgLatency) * 100;
    const overallThroughputImprovement =
      ((afterAvgThroughput - beforeAvgThroughput) / beforeAvgThroughput) * 100;

    console.log('\n📈 Overall Performance Summary:');
    console.log(
      `   Average latency improvement: ${overallLatencyImprovement.toFixed(1)}%`
    );
    console.log(
      `   Average throughput improvement: ${overallThroughputImprovement.toFixed(
        1
      )}%`
    );
  } catch (error) {
    console.error('Error comparing results:', error.message);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'run':
      const baseUrl = args[1] || 'http://localhost:3000';
      const outputFile = args[2] || `benchmark-${Date.now()}.json`;
      await runAllBenchmarks(baseUrl, outputFile);
      break;

    case 'compare':
      const beforeFile = args[1];
      const afterFile = args[2];

      if (!beforeFile || !afterFile) {
        console.error(
          'Usage: node compare.js compare <before-file> <after-file>'
        );
        process.exit(1);
      }

      await compareResults(beforeFile, afterFile);
      break;

    default:
      console.log('Performance Benchmarking Tool');
      console.log('Usage:');
      console.log('  node compare.js run [baseUrl] [outputFile]');
      console.log('  node compare.js compare <before-file> <after-file>');
      console.log('');
      console.log('Examples:');
      console.log(
        '  node compare.js run http://localhost:3000 before-optimization.json'
      );
      console.log(
        '  node compare.js run http://localhost:3000 after-optimization.json'
      );
      console.log(
        '  node compare.js compare before-optimization.json after-optimization.json'
      );
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runAllBenchmarks,
  compareResults,
};
