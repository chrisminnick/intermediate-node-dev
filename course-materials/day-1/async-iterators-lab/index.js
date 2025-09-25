const LogDataGenerator = require('./data-generator');
const LogProcessor = require('./log-processor');
const PerformanceTest = require('./performance-test');

// Dynamic import for chalk since it's an ES module
let chalk;

async function main() {
  // Dynamic import for chalk ES module
  chalk = (await import('chalk')).default;

  const args = process.argv.slice(2);
  const command = args[0] || 'demo';
  switch (command) {
    case 'demo':
      await runDemo();
      break;
    case 'performance':
      await runPerformanceTests();
      break;
    case 'interactive':
      await runInteractive();
      break;
    default:
      console.log(
        chalk.red('Unknown command. Use: demo, performance, or interactive')
      );
  }
}

async function runDemo() {
  console.log(chalk.green('=== Async Iterator Demo ===\n'));
  const generator = new LogDataGenerator(5000);
  const processor = new LogProcessor();
  console.log('Processing logs with async iterator...');
  await processor.processLogsAsync(generator.generateAsync());
}

async function runPerformanceTests() {
  const test = new PerformanceTest();
  await test.runAllTests();
}

async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log(chalk.green('=== Interactive Log Processor ==='));
  console.log('Commands: generate <count>, process, stats, quit');
  const generator = new LogDataGenerator();
  const processor = new LogProcessor();
  let currentLogs = null;
  const askQuestion = () => {
    rl.question(chalk.cyan('> '), async (answer) => {
      const [command, ...args] = answer.trim().split(' ');
      switch (command) {
        case 'generate':
          const count = parseInt(args[0]) || 1000;
          generator.totalRecords = count;
          console.log(`Generated ${count} log entries`);
          currentLogs = generator.generateAsync();
          break;
        case 'process':
          if (currentLogs) {
            await processor.processLogsAsync(currentLogs);
          } else {
            console.log('No logs generated. Use "generate <count>" first.');
          }
          break;
        case 'stats':
          console.log(
            `Processed: ${processor.processedCount}, Errors: ${processor.errorCount}, Warnings: ${processor.warningCount}`
          );
          break;
        case 'quit':
          rl.close();
          return;
        default:
          console.log('Unknown command');
      }
      askQuestion();
    });
  };
  askQuestion();
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\nGracefully shutting down...'));
  process.exit(0);
});

main().catch(console.error);
