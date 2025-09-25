const { calculatePrimes, calculateFibonacci } = require('./cpu-intensive');
const WorkerManager = require('./worker-manager');

class PerformanceComparison {
  constructor() {
    this.chalk = null;
    this.workerManager = null;
  }

  async initialize() {
    this.chalk = (await import('chalk')).default;
    this.workerManager = new WorkerManager('./prime-worker.js', 4);
    await this.workerManager.initialize();
  }

  async runAllTests() {
    console.log(
      this.chalk.magenta('=== Worker Thread Performance Comparison ===\n')
    );

    await this.testBlockingBehavior();
    await this.testWorkerThreadBehavior();
    await this.testConcurrentProcessing();
    await this.testScalability();
    await this.cleanup();
  }

  async testBlockingBehavior() {
    console.log(this.chalk.blue('Test 1: Blocking Main Thread'));
    console.log('Starting CPU-intensive task on main thread...');

    let messageCount = 0;
    const responsiveCheck = setInterval(() => {
      messageCount++;
      console.log(
        this.chalk.red(
          `❌ Event loop blocked - message ${messageCount} (delayed)`
        )
      );
    }, 500);

    const startTime = Date.now();
    const result = calculatePrimes(500000);
    const duration = Date.now() - startTime;

    clearInterval(responsiveCheck);

    console.log(
      this.chalk.yellow(`Found ${result.count} primes in ${duration}ms`)
    );
    console.log(
      this.chalk.red(
        `Main thread was blocked - only ${messageCount} responsive messages shown`
      )
    );
    console.log('---\n');
  }

  async testWorkerThreadBehavior() {
    console.log(this.chalk.blue('Test 2: Non-blocking with Worker Thread'));
    console.log('Starting CPU-intensive task in worker thread...');

    let messageCount = 0;
    const responsiveCheck = setInterval(() => {
      messageCount++;
      console.log(
        this.chalk.green(
          `✅ Event loop responsive - message ${messageCount} (on time)`
        )
      );
    }, 500);

    const startTime = Date.now();
    const result = await this.workerManager.executeTask('calculatePrimes', {
      limit: 500000,
    });
    const totalDuration = Date.now() - startTime;

    clearInterval(responsiveCheck);

    console.log(
      this.chalk.yellow(
        `Found ${result.count} primes in ${result.duration}ms (total: ${totalDuration}ms)`
      )
    );
    console.log(
      this.chalk.green(
        `Main thread remained responsive - ${messageCount} messages shown on time`
      )
    );
    console.log('---\n');
  }

  async testConcurrentProcessing() {
    console.log(this.chalk.blue('Test 3: Sequential vs Concurrent Processing'));

    const ranges = [
      { start: 1, end: 100000 },
      { start: 100001, end: 200000 },
      { start: 200001, end: 300000 },
      { start: 300001, end: 400000 },
    ];

    // Sequential processing
    console.log(this.chalk.cyan('Sequential processing:'));
    const sequentialStart = Date.now();
    const sequentialResults = [];

    for (const range of ranges) {
      const result = await this.workerManager.executeTask(
        'findPrimesInRange',
        range
      );
      sequentialResults.push(result);
      console.log(`  Range ${result.range}: ${result.count} primes`);
    }

    const sequentialDuration = Date.now() - sequentialStart;
    const sequentialTotal = sequentialResults.reduce(
      (sum, r) => sum + r.count,
      0
    );

    // Concurrent processing
    console.log(this.chalk.cyan('Concurrent processing:'));
    const concurrentStart = Date.now();

    const concurrentPromises = ranges.map((range) =>
      this.workerManager.executeTask('findPrimesInRange', range)
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentDuration = Date.now() - concurrentStart;
    const concurrentTotal = concurrentResults.reduce(
      (sum, r) => sum + r.count,
      0
    );

    concurrentResults.forEach((result) => {
      console.log(
        `  Range ${result.range}: ${result.count} primes (worker ${result.workerId})`
      );
    });

    console.log(
      this.chalk.yellow(
        `Sequential: ${sequentialTotal} primes in ${sequentialDuration}ms`
      )
    );
    console.log(
      this.chalk.yellow(
        `Concurrent: ${concurrentTotal} primes in ${concurrentDuration}ms`
      )
    );
    const speedup = (sequentialDuration / concurrentDuration).toFixed(2);
    console.log(
      this.chalk.green(`Speedup: ${speedup}x faster with concurrent processing`)
    );
    console.log('---\n');
  }

  async testScalability() {
    console.log(this.chalk.blue('Test 4: Scalability Analysis'));
    console.log('Testing different numbers of concurrent tasks...');

    const taskCounts = [1, 2, 4, 8];
    const baseTask = { limit: 100000 };

    for (const taskCount of taskCounts) {
      console.log(this.chalk.cyan(`Running ${taskCount} concurrent tasks:`));

      const startTime = Date.now();
      const promises = Array(taskCount)
        .fill()
        .map(() => this.workerManager.executeTask('calculatePrimes', baseTask));

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      const totalPrimes = results.reduce((sum, r) => sum + r.count, 0);
      const avgTaskTime =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      console.log(`  Total time: ${duration}ms`);
      console.log(`  Average task time: ${Math.round(avgTaskTime)}ms`);
      console.log(`  Total primes found: ${totalPrimes}`);
      console.log(
        `  Throughput: ${Math.round(
          totalPrimes / (duration / 1000)
        )} primes/second`
      );

      // Show worker utilization
      const stats = this.workerManager.getStats();
      console.log(
        `  Workers used: ${Math.min(taskCount, stats.totalWorkers)}/${
          stats.totalWorkers
        }`
      );
      console.log('');
    }

    console.log('---\n');
  }

  async testDifferentTaskTypes() {
    console.log(this.chalk.blue('Test 5: Different Task Types'));

    const tasks = [
      {
        type: 'calculatePrimes',
        params: { limit: 100000 },
        name: 'Prime Calculation',
      },
      { type: 'fibonacci', params: { n: 40 }, name: 'Fibonacci Calculation' },
      {
        type: 'intensiveHash',
        params: { data: 'test-data', iterations: 100000 },
        name: 'Hash Calculation',
      },
    ];

    for (const task of tasks) {
      console.log(this.chalk.cyan(`${task.name}:`));

      const startTime = Date.now();
      const result = await this.workerManager.executeTask(
        task.type,
        task.params
      );
      const duration = Date.now() - startTime;

      console.log(`  Completed in ${duration}ms`);
      console.log(`  Worker: ${result.workerId}`);

      if (task.type === 'calculatePrimes') {
        console.log(`  Primes found: ${result.count}`);
      } else if (task.type === 'fibonacci') {
        console.log(`  Fibonacci(${task.params.n}) = ${result.result}`);
      } else if (task.type === 'intensiveHash') {
        console.log(`  Hash: ${result.hash.substring(0, 16)}...`);
      }

      console.log('');
    }

    console.log('---\n');
  }

  async cleanup() {
    await this.workerManager.shutdown();
  }
}

module.exports = PerformanceComparison;
