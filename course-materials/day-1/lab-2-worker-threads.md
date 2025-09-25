# Lab 2: Worker Thread Implementation for CPU-Intensive Tasks

## Objective

Use Node.js worker threads to offload CPU-intensive work and improve application responsiveness by implementing a prime number calculator that demonstrates the performance benefits of parallel processing.

## Setup

### Create Project Structure

```bash
mkdir worker-threads-lab
cd worker-threads-lab
npm init -y
```

### Install Dependencies

```bash
npm install chalk worker_threads
```

## Instructions

### Part 1: Synchronous CPU Task (`cpu-intensive.js`)

Create CPU-intensive functions that will block the event loop:

#### 1.1 Prime Number Calculator

```javascript
function isPrime(num) {
  if (num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;

  for (let i = 3; i <= Math.sqrt(num); i += 2) {
    if (num % i === 0) return false;
  }
  return true;
}

function findPrimesInRange(start, end) {
  const primes = [];
  for (let i = start; i <= end; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }
  }
  return primes;
}

function calculatePrimes(limit) {
  console.log(`Calculating primes up to ${limit}...`);
  const startTime = Date.now();
  const primes = findPrimesInRange(2, limit);
  const duration = Date.now() - startTime;

  return {
    count: primes.length,
    largest: primes[primes.length - 1] || 0,
    duration,
    primes: limit <= 1000 ? primes : [], // Only return array for small datasets
  };
}

module.exports = { isPrime, findPrimesInRange, calculatePrimes };
```

#### 1.2 Hash Calculation (Alternative CPU Task)

```javascript
const crypto = require('crypto');

function intensiveHash(data, iterations = 100000) {
  let result = data;
  for (let i = 0; i < iterations; i++) {
    result = crypto.createHash('sha256').update(result).digest('hex');
  }
  return result;
}

function batchHashCalculation(dataArray, iterations = 50000) {
  const results = [];
  const startTime = Date.now();

  for (const data of dataArray) {
    results.push({
      input: data,
      hash: intensiveHash(data, iterations),
      timestamp: Date.now(),
    });
  }

  return {
    results,
    duration: Date.now() - startTime,
    count: results.length,
  };
}

module.exports = {
  isPrime,
  findPrimesInRange,
  calculatePrimes,
  intensiveHash,
  batchHashCalculation,
};
```

### Part 2: Worker Thread Implementation

#### 2.1 Prime Calculator Worker (`prime-worker.js`)

```javascript
const { parentPort, workerData } = require('worker_threads');
const { findPrimesInRange, calculatePrimes } = require('./cpu-intensive');

// Handle different types of work
parentPort.on('message', (data) => {
  try {
    const { taskType, ...params } = data;

    switch (taskType) {
      case 'calculatePrimes':
        const result = calculatePrimes(params.limit);
        parentPort.postMessage({
          success: true,
          result,
          taskId: params.taskId,
        });
        break;

      case 'findPrimesInRange':
        const primes = findPrimesInRange(params.start, params.end);
        parentPort.postMessage({
          success: true,
          result: {
            primes,
            count: primes.length,
            range: `${params.start}-${params.end}`,
          },
          taskId: params.taskId,
        });
        break;

      default:
        parentPort.postMessage({
          success: false,
          error: `Unknown task type: ${taskType}`,
          taskId: params.taskId,
        });
    }
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error.message,
      taskId: data.taskId,
    });
  }
});

// Handle initialization data
if (workerData) {
  console.log('Worker initialized with data:', workerData);
}
```

#### 2.2 Worker Manager (`worker-manager.js`)

```javascript
const { Worker } = require('worker_threads');
const path = require('path');

class WorkerManager {
  constructor(workerScript, maxWorkers = 4) {
    this.workerScript = path.resolve(workerScript);
    this.maxWorkers = maxWorkers;
    this.workers = [];
    this.taskQueue = [];
    this.taskId = 0;
    this.chalk = null;
  }

  async initChalk() {
    if (!this.chalk) {
      this.chalk = (await import('chalk')).default;
    }
  }

  async initialize() {
    await this.initChalk();
    console.log(this.chalk.blue(`Initializing ${this.maxWorkers} workers...`));

    for (let i = 0; i < this.maxWorkers; i++) {
      await this.createWorker(i);
    }

    console.log(
      this.chalk.green(`Worker pool ready with ${this.workers.length} workers`)
    );
  }

  async createWorker(workerId) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerScript, {
        workerData: { workerId },
      });

      worker.on('message', (result) => {
        this.handleWorkerMessage(worker, result);
      });

      worker.on('error', (error) => {
        console.error(this.chalk.red(`Worker ${workerId} error:`), error);
        this.handleWorkerError(worker, error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(
            this.chalk.red(`Worker ${workerId} exited with code ${code}`)
          );
        }
        this.removeWorker(worker);
      });

      worker.workerId = workerId;
      worker.busy = false;
      worker.currentTask = null;

      this.workers.push(worker);
      resolve(worker);
    });
  }

  async executeTask(taskType, params) {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskId;
      const task = {
        taskId,
        taskType,
        params,
        resolve,
        reject,
        startTime: Date.now(),
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  processQueue() {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) return;

    const task = this.taskQueue.shift();
    availableWorker.busy = true;
    availableWorker.currentTask = task;

    availableWorker.postMessage({
      taskType: task.taskType,
      taskId: task.taskId,
      ...task.params,
    });
  }

  handleWorkerMessage(worker, result) {
    const task = worker.currentTask;
    if (!task) return;

    worker.busy = false;
    worker.currentTask = null;

    const duration = Date.now() - task.startTime;

    if (result.success) {
      console.log(
        this.chalk.green(`Task ${result.taskId} completed in ${duration}ms`)
      );
      task.resolve({ ...result.result, duration });
    } else {
      console.error(
        this.chalk.red(`Task ${result.taskId} failed:`, result.error)
      );
      task.reject(new Error(result.error));
    }

    // Process next task in queue
    this.processQueue();
  }

  handleWorkerError(worker, error) {
    if (worker.currentTask) {
      worker.currentTask.reject(error);
      worker.currentTask = null;
    }
    worker.busy = false;
    this.processQueue();
  }

  removeWorker(worker) {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
  }

  async shutdown() {
    console.log(this.chalk.yellow('Shutting down worker pool...'));

    await Promise.all(
      this.workers.map((worker) => {
        return worker.terminate();
      })
    );

    this.workers = [];
    console.log(this.chalk.green('All workers terminated'));
  }
}

module.exports = WorkerManager;
```

### Part 3: Performance Comparison (`performance-comparison.js`)

#### 3.1 Blocking vs Non-blocking Comparison

```javascript
const { calculatePrimes } = require('./cpu-intensive');
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
    await this.cleanup();
  }

  async testBlockingBehavior() {
    console.log(this.chalk.blue('Test 1: Blocking Main Thread'));
    console.log('Starting CPU-intensive task on main thread...');

    const responsiveCheck = setInterval(() => {
      console.log(
        this.chalk.red('❌ Event loop blocked - this message is delayed')
      );
    }, 500);

    const startTime = Date.now();
    const result = calculatePrimes(500000);
    const duration = Date.now() - startTime;

    clearInterval(responsiveCheck);

    console.log(
      this.chalk.yellow(`Found ${result.count} primes in ${duration}ms`)
    );
    console.log(this.chalk.red('Main thread was blocked during calculation\n'));
  }

  async testWorkerThreadBehavior() {
    console.log(this.chalk.blue('Test 2: Non-blocking with Worker Thread'));
    console.log('Starting CPU-intensive task in worker thread...');

    const responsiveCheck = setInterval(() => {
      console.log(
        this.chalk.green('✅ Event loop responsive - messages appear on time')
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
      this.chalk.green('Main thread remained responsive during calculation\n')
    );
  }

  async testConcurrentProcessing() {
    console.log(this.chalk.blue('Test 3: Concurrent Processing'));
    console.log('Running multiple tasks concurrently...');

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
    console.log(
      this.chalk.green(
        `Speedup: ${(sequentialDuration / concurrentDuration).toFixed(
          2
        )}x faster\n`
      )
    );
  }

  async cleanup() {
    await this.workerManager.shutdown();
  }
}

module.exports = PerformanceComparison;
```

### Part 4: Main Application (`index.js`)

```javascript
const { calculatePrimes } = require('./cpu-intensive');
const WorkerManager = require('./worker-manager');
const PerformanceComparison = require('./performance-comparison');

let chalk;

async function main() {
  chalk = (await import('chalk')).default;

  const command = process.argv[2] || 'demo';

  switch (command) {
    case 'demo':
      await runDemo();
      break;
    case 'blocking':
      await runBlockingDemo();
      break;
    case 'worker':
      await runWorkerDemo();
      break;
    case 'performance':
      await runPerformanceTests();
      break;
    case 'interactive':
      await runInteractive();
      break;
    default:
      showUsage();
  }
}

async function runDemo() {
  console.log(chalk.green('=== Worker Thread Demo ===\n'));

  const workerManager = new WorkerManager('./prime-worker.js', 2);
  await workerManager.initialize();

  try {
    console.log('Calculating primes using worker thread...');
    const result = await workerManager.executeTask('calculatePrimes', {
      limit: 100000,
    });

    console.log(chalk.yellow(`Found ${result.count} primes up to 100,000`));
    console.log(chalk.yellow(`Largest prime: ${result.largest}`));
    console.log(chalk.yellow(`Calculation time: ${result.duration}ms`));
  } finally {
    await workerManager.shutdown();
  }
}

async function runBlockingDemo() {
  console.log(chalk.red('=== Blocking Main Thread Demo ===\n'));
  console.log('This will block the event loop...');

  const timer = setInterval(() => {
    console.log(chalk.red('Event loop is blocked!'));
  }, 1000);

  const result = calculatePrimes(500000);
  clearInterval(timer);

  console.log(
    chalk.yellow(`Result: ${result.count} primes found in ${result.duration}ms`)
  );
}

async function runWorkerDemo() {
  console.log(chalk.green('=== Non-blocking Worker Demo ===\n'));
  console.log('This will NOT block the event loop...');

  const workerManager = new WorkerManager('./prime-worker.js', 1);
  await workerManager.initialize();

  const timer = setInterval(() => {
    console.log(chalk.green('Event loop is responsive!'));
  }, 1000);

  try {
    const result = await workerManager.executeTask('calculatePrimes', {
      limit: 500000,
    });
    clearInterval(timer);
    console.log(
      chalk.yellow(
        `Result: ${result.count} primes found in ${result.duration}ms`
      )
    );
  } finally {
    await workerManager.shutdown();
  }
}

async function runPerformanceTests() {
  const comparison = new PerformanceComparison();
  await comparison.initialize();
  await comparison.runAllTests();
}

async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const workerManager = new WorkerManager('./prime-worker.js', 4);
  await workerManager.initialize();

  console.log(chalk.green('=== Interactive Worker Thread Demo ==='));
  console.log('Commands: primes <limit>, range <start> <end>, quit');

  const prompt = () => {
    rl.question('> ', async (input) => {
      const [command, ...args] = input.trim().split(' ');

      try {
        switch (command) {
          case 'primes':
            const limit = parseInt(args[0]) || 10000;
            console.log(`Calculating primes up to ${limit}...`);
            const result = await workerManager.executeTask('calculatePrimes', {
              limit,
            });
            console.log(
              chalk.blue(`Found ${result.count} primes in ${result.duration}ms`)
            );
            break;

          case 'range':
            const start = parseInt(args[0]) || 1;
            const end = parseInt(args[1]) || 1000;
            console.log(`Finding primes in range ${start}-${end}...`);
            const rangeResult = await workerManager.executeTask(
              'findPrimesInRange',
              { start, end }
            );
            console.log(
              chalk.blue(
                `Found ${rangeResult.count} primes in range ${rangeResult.range}`
              )
            );
            break;

          case 'quit':
            await workerManager.shutdown();
            rl.close();
            return;

          default:
            console.log(chalk.red('Unknown command'));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }

      prompt();
    });
  };

  prompt();
}

function showUsage() {
  console.log(chalk.cyan('Usage: node index.js [command]'));
  console.log(chalk.cyan('Commands:'));
  console.log(chalk.cyan('  demo       - Basic worker thread demonstration'));
  console.log(chalk.cyan('  blocking   - Show blocking behavior'));
  console.log(chalk.cyan('  worker     - Show non-blocking behavior'));
  console.log(chalk.cyan('  performance - Run performance comparison tests'));
  console.log(chalk.cyan('  interactive - Interactive mode'));
}

main().catch(console.error);
```

## Deliverables

- [ ] `cpu-intensive.js` - CPU-bound functions (prime calculation, hashing)
- [ ] `prime-worker.js` - Worker thread implementation
- [ ] `worker-manager.js` - Worker pool management
- [ ] `performance-comparison.js` - Blocking vs non-blocking tests
- [ ] `index.js` - CLI interface with multiple demo modes
- [ ] `package.json` - Project configuration

## Resources

- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Worker Thread Performance](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/)

---

**💡 Pro Tips:**

- Use worker threads for CPU-intensive tasks, not I/O
- Monitor memory usage when transferring large objects
- Handle worker errors gracefully to prevent crashes
