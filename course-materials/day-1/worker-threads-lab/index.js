const { calculatePrimes, calculateFibonacci } = require('./cpu-intensive');
const WorkerManager = require('./worker-manager');
const PerformanceComparison = require('./performance-comparison');

let chalk;

async function main() {
  chalk = (await import('chalk')).default;

  const command = process.argv[2] || 'demo';

  try {
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
      case 'comparison':
        await runTaskComparison();
        break;
      default:
        showUsage();
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
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
    console.log(chalk.yellow(`Processed by worker: ${result.workerId}`));
  } finally {
    await workerManager.shutdown();
  }
}

async function runBlockingDemo() {
  console.log(chalk.red('=== Blocking Main Thread Demo ===\n'));
  console.log('This will block the event loop...');
  console.log('Notice how the timer messages are delayed!\n');

  let timerCount = 0;
  const timer = setInterval(() => {
    timerCount++;
    const timestamp = new Date().toISOString();
    console.log(
      chalk.red(`${timestamp} - Timer ${timerCount}: Event loop is blocked!`)
    );
  }, 1000);

  console.log('Starting CPU-intensive calculation...');
  const result = calculatePrimes(500000);

  setTimeout(() => {
    clearInterval(timer);
    console.log(
      chalk.yellow(
        `\nResult: ${result.count} primes found in ${result.duration}ms`
      )
    );
    console.log(
      chalk.red(
        `Timer fired ${timerCount} times (should have been ${Math.ceil(
          result.duration / 1000
        )})`
      )
    );
  }, 100);
}

async function runWorkerDemo() {
  console.log(chalk.green('=== Non-blocking Worker Demo ===\n'));
  console.log('This will NOT block the event loop...');
  console.log('Notice how the timer messages appear on schedule!\n');

  const workerManager = new WorkerManager('./prime-worker.js', 1);
  await workerManager.initialize();

  let timerCount = 0;
  const startTime = Date.now();
  const timer = setInterval(() => {
    timerCount++;
    const timestamp = new Date().toISOString();
    console.log(
      chalk.green(
        `${timestamp} - Timer ${timerCount}: Event loop is responsive!`
      )
    );
  }, 1000);

  try {
    console.log('Starting CPU-intensive calculation in worker...');
    const result = await workerManager.executeTask('calculatePrimes', {
      limit: 500000,
    });
    const totalDuration = Date.now() - startTime;

    setTimeout(() => {
      clearInterval(timer);
      console.log(
        chalk.yellow(
          `\nResult: ${result.count} primes found in ${result.duration}ms`
        )
      );
      console.log(chalk.yellow(`Total time: ${totalDuration}ms`));
      console.log(
        chalk.green(
          `Timer fired ${timerCount} times (expected: ${Math.ceil(
            totalDuration / 1000
          )})`
        )
      );
      console.log(chalk.green('Event loop remained responsive throughout!'));
    }, 100);
  } finally {
    await workerManager.shutdown();
  }
}

async function runPerformanceTests() {
  const comparison = new PerformanceComparison();
  await comparison.initialize();
  await comparison.runAllTests();
}

async function runTaskComparison() {
  console.log(chalk.magenta('=== Task Type Comparison ===\n'));

  const workerManager = new WorkerManager('./prime-worker.js', 4);
  await workerManager.initialize();

  try {
    const tasks = [
      {
        type: 'calculatePrimes',
        params: { limit: 100000 },
        name: 'Prime Numbers (100K limit)',
        description: 'Calculate all prime numbers up to 100,000',
      },
      {
        type: 'fibonacci',
        params: { n: 40 },
        name: 'Fibonacci Sequence',
        description: 'Calculate the 40th Fibonacci number',
      },
      {
        type: 'intensiveHash',
        params: { data: 'worker-thread-test', iterations: 50000 },
        name: 'Hash Calculation',
        description: 'Perform 50,000 SHA-256 hash iterations',
      },
      {
        type: 'findPrimesInRange',
        params: { start: 1000000, end: 1100000, returnPrimes: false },
        name: 'Prime Range Search',
        description: 'Find primes between 1,000,000 and 1,100,000',
      },
    ];

    for (const task of tasks) {
      console.log(chalk.blue(`${task.name}:`));
      console.log(chalk.gray(`  ${task.description}`));

      const startTime = Date.now();
      const result = await workerManager.executeTask(task.type, task.params);
      const totalDuration = Date.now() - startTime;

      console.log(
        chalk.green(
          `  ✓ Completed in ${totalDuration}ms (worker time: ${result.duration}ms)`
        )
      );
      console.log(chalk.gray(`  ✓ Processed by worker ${result.workerId}`));

      // Show task-specific results
      if (task.type === 'calculatePrimes') {
        console.log(
          chalk.yellow(
            `  ✓ Found ${result.count} primes, largest: ${result.largest}`
          )
        );
      } else if (task.type === 'fibonacci') {
        console.log(
          chalk.yellow(`  ✓ Fibonacci(${task.params.n}) = ${result.result}`)
        );
      } else if (task.type === 'intensiveHash') {
        console.log(
          chalk.yellow(`  ✓ Final hash: ${result.hash.substring(0, 32)}...`)
        );
      } else if (task.type === 'findPrimesInRange') {
        console.log(
          chalk.yellow(
            `  ✓ Found ${result.count} primes in range ${result.range}`
          )
        );
      }

      console.log('');
    }
  } finally {
    await workerManager.shutdown();
  }
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
  console.log(chalk.cyan('Available commands:'));
  console.log(
    chalk.cyan('  primes <limit>     - Calculate primes up to limit')
  );
  console.log(chalk.cyan('  range <start> <end> - Find primes in range'));
  console.log(
    chalk.cyan('  fibonacci <n>      - Calculate nth Fibonacci number')
  );
  console.log(chalk.cyan('  hash <data> [iter] - Hash data with iterations'));
  console.log(chalk.cyan('  stats              - Show worker pool statistics'));
  console.log(chalk.cyan('  quit               - Exit the program'));
  console.log('');

  const prompt = () => {
    rl.question(chalk.blue('> '), async (input) => {
      const [command, ...args] = input.trim().split(' ');

      try {
        switch (command) {
          case 'primes':
            const limit = parseInt(args[0]) || 10000;
            console.log(chalk.gray(`Calculating primes up to ${limit}...`));
            const result = await workerManager.executeTask('calculatePrimes', {
              limit,
            });
            console.log(
              chalk.yellow(
                `Found ${result.count} primes in ${result.duration}ms (worker ${result.workerId})`
              )
            );
            if (result.largest) {
              console.log(chalk.yellow(`Largest prime: ${result.largest}`));
            }
            break;

          case 'range':
            const start = parseInt(args[0]) || 1;
            const end = parseInt(args[1]) || 1000;
            console.log(
              chalk.gray(`Finding primes in range ${start}-${end}...`)
            );
            const rangeResult = await workerManager.executeTask(
              'findPrimesInRange',
              { start, end, returnPrimes: false }
            );
            console.log(
              chalk.yellow(
                `Found ${rangeResult.count} primes in range ${rangeResult.range} (worker ${rangeResult.workerId})`
              )
            );
            break;

          case 'fibonacci':
            const n = parseInt(args[0]) || 30;
            console.log(chalk.gray(`Calculating Fibonacci(${n})...`));
            const fibResult = await workerManager.executeTask('fibonacci', {
              n,
            });
            console.log(
              chalk.yellow(
                `Fibonacci(${n}) = ${fibResult.result} (calculated in ${fibResult.duration}ms by worker ${fibResult.workerId})`
              )
            );
            break;

          case 'hash':
            const data = args[0] || 'default-data';
            const iterations = parseInt(args[1]) || 10000;
            console.log(
              chalk.gray(`Hashing '${data}' with ${iterations} iterations...`)
            );
            const hashResult = await workerManager.executeTask(
              'intensiveHash',
              { data, iterations }
            );
            console.log(
              chalk.yellow(
                `Hash: ${hashResult.hash} (worker ${hashResult.workerId})`
              )
            );
            break;

          case 'stats':
            const stats = workerManager.getStats();
            console.log(chalk.cyan('Worker Pool Statistics:'));
            console.log(chalk.cyan(`  Total workers: ${stats.totalWorkers}`));
            console.log(chalk.cyan(`  Busy workers: ${stats.busyWorkers}`));
            console.log(
              chalk.cyan(`  Available workers: ${stats.availableWorkers}`)
            );
            console.log(chalk.cyan(`  Queued tasks: ${stats.queuedTasks}`));
            break;

          case 'quit':
          case 'exit':
            console.log(chalk.yellow('Shutting down...'));
            await workerManager.shutdown();
            rl.close();
            return;

          case 'help':
            console.log(chalk.cyan('Available commands:'));
            console.log(
              chalk.cyan('  primes <limit>     - Calculate primes up to limit')
            );
            console.log(
              chalk.cyan('  range <start> <end> - Find primes in range')
            );
            console.log(
              chalk.cyan(
                '  fibonacci <n>      - Calculate nth Fibonacci number'
              )
            );
            console.log(
              chalk.cyan('  hash <data> [iter] - Hash data with iterations')
            );
            console.log(
              chalk.cyan('  stats              - Show worker pool statistics')
            );
            console.log(chalk.cyan('  quit               - Exit the program'));
            break;

          case '':
            // Empty command, just show prompt again
            break;

          default:
            console.log(
              chalk.red(
                `Unknown command: ${command}. Type 'help' for available commands.`
              )
            );
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
  console.log(chalk.cyan('Node.js Worker Threads Lab'));
  console.log(chalk.cyan('Usage: node index.js [command]'));
  console.log(chalk.cyan(''));
  console.log(chalk.cyan('Commands:'));
  console.log(chalk.cyan('  demo         - Basic worker thread demonstration'));
  console.log(
    chalk.cyan('  blocking     - Show how CPU tasks block the event loop')
  );
  console.log(
    chalk.cyan('  worker       - Show non-blocking behavior with workers')
  );
  console.log(
    chalk.cyan('  performance  - Run comprehensive performance tests')
  );
  console.log(chalk.cyan('  comparison   - Compare different task types'));
  console.log(chalk.cyan('  interactive  - Interactive mode for testing'));
  console.log(chalk.cyan(''));
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.cyan('  npm start           # Run basic demo'));
  console.log(chalk.cyan('  npm run blocking    # Show blocking behavior'));
  console.log(chalk.cyan('  npm run performance # Run performance tests'));
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nReceived SIGINT, shutting down gracefully...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\nReceived SIGTERM, shutting down gracefully...'));
  process.exit(0);
});

main().catch((error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});
