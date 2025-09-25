# Lab 1: Building Async Iterators for Data Processing

## Objective

Create a memory-efficient data processing pipeline using async iterators and generators in Node.js.

## Setup

### Create Project Structure

Create a new directory and initialize your Node.js project:

```bash
mkdir async-iterators-lab
cd async-iterators-lab
npm init -y
```

### Install Dependencies

```bash
npm install chalk uuid
```

**Note:** If you encounter issues with chalk, ensure you're using the dynamic import pattern for ES modules.

## Instructions

### Part 1: Data Generation (`data-generator.js`)

Create a `LogDataGenerator` class that simulates log data generation with three different approaches:

#### 1.1 Basic Structure

```javascript
const { v4: uuidv4 } = require('uuid');

class LogDataGenerator {
  constructor(logCount = 1000) {
    this.logCount = logCount;
    this.logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    this.endpoints = ['/api/users', '/api/orders', '/api/products', '/health'];
  }

  // Your methods will go here
}
```

#### 1.2 Generate Sample Log Entry

Create a method to generate realistic log entries:

```javascript
generateLogEntry(index) {
  return {
    id: uuidv4(),
    timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    level: this.logLevels[Math.floor(Math.random() * this.logLevels.length)],
    userId: `user_${Math.floor(Math.random() * 10000)}`,
    endpoint: this.endpoints[Math.floor(Math.random() * this.endpoints.length)],
    responseTime: Math.floor(Math.random() * 5000) + 50,
    message: `Request processed for ${this.endpoints[Math.floor(Math.random() * this.endpoints.length)]}`
  };
}
```

#### 1.3 Implement Three Generation Methods

**Method 1: Array Generation (Memory Intensive)**

```javascript
generateArray() {
  const logs = [];
  for (let i = 0; i < this.logCount; i++) {
    logs.push(this.generateLogEntry(i));
  }
  return logs;
}
```

**Method 2: Sync Generator (Memory Efficient)**

```javascript
*generateSync() {
  for (let i = 0; i < this.logCount; i++) {
    yield this.generateLogEntry(i);
  }
}
```

**Method 3: Async Generator (Simulates I/O)**

```javascript
async *generateAsync() {
  for (let i = 0; i < this.logCount; i++) {
    // Simulate async I/O delay
    await new Promise(resolve => setTimeout(resolve, 1));
    yield this.generateLogEntry(i);
  }
}
```

### Part 2: Async Log Processing (`log-processor.js`)

Create a `LogProcessor` class that processes logs efficiently using async iterators:

#### 2.1 Basic Structure with Dynamic Chalk Import

```javascript
class LogProcessor {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.warningCount = 0;
    this.userStats = new Map();
    this.chalk = null;
  }

  async initChalk() {
    if (!this.chalk) {
      this.chalk = (await import('chalk')).default;
    }
  }
}
```

#### 2.2 Main Processing Method

```javascript
async processLogsAsync(logSource) {
  await this.initChalk();
  console.log(this.chalk.blue('Starting async log processing...'));
  const startTime = Date.now();

  try {
    for await (const log of logSource) {
      await this.processLogEntry(log);

      // Progress indicator
      if (this.processedCount % 1000 === 0) {
        console.log(this.chalk.green(`Processed ${this.processedCount} logs...`));
      }
    }
  } catch (error) {
    console.error(this.chalk.red('Error processing logs:'), error);
  }

  const duration = Date.now() - startTime;
  this.printStats(duration);
}
```

#### 2.3 Individual Log Processing

```javascript
async processLogEntry(log) {
  this.processedCount++;

  // Track error and warning counts
  if (log.level === 'ERROR') {
    this.errorCount++;
    await this.handleCriticalError(log);
  } else if (log.level === 'WARN') {
    this.warningCount++;
  }

  // Track user statistics
  this.updateUserStats(log);

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
}
```

#### 2.4 User Statistics and Error Handling

```javascript
updateUserStats(log) {
  const userId = log.userId;
  if (!this.userStats.has(userId)) {
    this.userStats.set(userId, {
      requests: 0,
      errors: 0,
      totalDuration: 0
    });
  }

  const stats = this.userStats.get(userId);
  stats.requests++;
  stats.totalDuration += log.responseTime;

  if (log.level === 'ERROR') {
    stats.errors++;
  }
}

async handleCriticalError(log) {
  // Simulate async error handling
  await new Promise(resolve => setTimeout(resolve, 5));
}
```

#### 2.5 Statistics Display

```javascript
printStats(duration) {
  console.log(this.chalk.yellow('\n=== Processing Complete ==='));
  console.log(`Total logs processed: ${this.processedCount}`);
  console.log(`Errors found: ${this.errorCount}`);
  console.log(`Warnings found: ${this.warningCount}`);
  console.log(`Processing time: ${duration}ms`);
  console.log(`Average processing rate: ${Math.round(this.processedCount / (duration / 1000))} logs/second`);

  // Top active users
  const topUsers = Array.from(this.userStats.entries())
    .sort(([,a], [,b]) => b.requests - a.requests)
    .slice(0, 5);

  console.log(this.chalk.cyan('\nTop 5 Most Active Users:'));
  topUsers.forEach(([userId, stats]) => {
    console.log(`${userId}: ${stats.requests} requests, ${stats.errors} errors, avg duration: ${Math.round(stats.totalDuration / stats.requests)}ms`);
  });
}
```

### Part 3: Performance Comparison (`performance-test.js`)

Create a comprehensive performance testing suite:

#### 3.1 Performance Test Structure

```javascript
const LogDataGenerator = require('./data-generator');
const LogProcessor = require('./log-processor');

class PerformanceTest {
  constructor() {
    this.generator = new LogDataGenerator(50000); // Large dataset
    this.processor = new LogProcessor();
    this.chalk = null;
  }

  async initChalk() {
    if (!this.chalk) {
      this.chalk = (await import('chalk')).default;
    }
  }

  async runAllTests() {
    await this.initChalk();
    console.log(this.chalk.magenta('=== Performance Comparison Tests ===\n'));

    await this.testArrayApproach();
    await this.testSyncGeneratorApproach();
    await this.testAsyncGeneratorApproach();
    await this.testMemoryUsage();
  }
}
```

#### 3.2 Test Individual Approaches

```javascript
async testArrayApproach() {
  console.log(this.chalk.blue('Test 1: Traditional Array Approach'));
  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  try {
    const logs = this.generator.generateArray();
    console.log(`Generated ${logs.length} logs in memory`);

    // Process array (simulate async iteration)
    for (const log of logs) {
      await this.processor.processLogEntry(log);
    }

    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryUsed = Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024);

    console.log(`Duration: ${duration}ms`);
    console.log(`Memory used: ${memoryUsed}MB`);
    console.log('---\n');
  } catch (error) {
    console.error('Error in array approach:', error);
  }

  // Reset processor stats
  this.processor = new LogProcessor();
}

async testSyncGeneratorApproach() {
  console.log(this.chalk.blue('Test 2: Sync Generator Approach'));
  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  try {
    let count = 0;
    for (const log of this.generator.generateSync()) {
      await this.processor.processLogEntry(log);
      count++;
    }

    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryUsed = Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024);

    console.log(`Processed ${count} logs`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Memory used: ${memoryUsed}MB`);
    console.log('---\n');
  } catch (error) {
    console.error('Error in sync generator approach:', error);
  }

  this.processor = new LogProcessor();
}

async testAsyncGeneratorApproach() {
  console.log(this.chalk.blue('Test 3: Async Generator Approach'));
  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  try {
    await this.processor.processLogsAsync(this.generator.generateAsync());

    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryUsed = Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024);

    console.log(`Duration: ${duration}ms`);
    console.log(`Memory used: ${memoryUsed}MB`);
    console.log('---\n');
  } catch (error) {
    console.error('Error in async generator approach:', error);
  }

  this.processor = new LogProcessor();
}
```

#### 3.3 Memory Usage Analysis

```javascript
async testMemoryUsage() {
  console.log(this.chalk.blue('Test 4: Memory Usage Detailed Analysis'));

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const baseline = process.memoryUsage();
  console.log('Baseline memory:', baseline);

  // Test array memory usage
  console.log('\nCreating large array...');
  const logs = this.generator.generateArray();
  const arrayMemory = process.memoryUsage();
  const arrayImpact = Math.round((arrayMemory.heapUsed - baseline.heapUsed) / 1024 / 1024);
  console.log(`Array memory impact: ${arrayImpact}MB`);

  // Clear array and test generator
  logs.length = 0;
  if (global.gc) global.gc();

  console.log('\nUsing generator (no array storage)...');
  let count = 0;
  for (const log of this.generator.generateSync()) {
    count++;
    if (count >= 10000) break; // Sample for memory test
  }

  const generatorMemory = process.memoryUsage();
  const generatorImpact = Math.round((generatorMemory.heapUsed - baseline.heapUsed) / 1024 / 1024);
  console.log(`Generator memory impact: ${generatorImpact}MB`);
}
```

### Part 4: Main Application (`index.js`)

Create a command-line interface to run different modes:

#### 4.1 Main Application Structure

```javascript
const LogDataGenerator = require('./data-generator');
const LogProcessor = require('./log-processor');
const PerformanceTest = require('./performance-test');

// Dynamic import for chalk ES module
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
```

#### 4.2 Demo Mode

```javascript
async function runDemo() {
  console.log(chalk.green('=== Async Iterator Demo ===\n'));

  const generator = new LogDataGenerator(5000);
  const processor = new LogProcessor();

  console.log('Processing logs with async iterator...');
  await processor.processLogsAsync(generator.generateAsync());
}
```

#### 4.3 Performance Test Mode

```javascript
async function runPerformanceTests() {
  const performanceTest = new PerformanceTest();
  await performanceTest.runAllTests();
}
```

#### 4.4 Interactive Mode (Optional)

```javascript
async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.green('=== Interactive Log Processor ==='));
  console.log('Commands: generate <count>, process, stats, quit');

  let generator = null;
  let processor = new LogProcessor();

  const prompt = () => {
    rl.question('> ', async (input) => {
      const [command, ...args] = input.trim().split(' ');

      switch (command) {
        case 'generate':
          const count = parseInt(args[0]) || 1000;
          generator = new LogDataGenerator(count);
          console.log(chalk.blue(`Generator created for ${count} logs`));
          break;
        case 'process':
          if (!generator) {
            console.log(chalk.red('Please generate logs first'));
          } else {
            await processor.processLogsAsync(generator.generateAsync());
          }
          break;
        case 'stats':
          processor.printStats(0);
          break;
        case 'quit':
          rl.close();
          return;
        default:
          console.log('Unknown command');
      }
      prompt();
    });
  };

  prompt();
}

// Run the application
main().catch(console.error);
```

### Part 5: Extension Ideas (Optional)

#### 5.1 Batch Processing

Implement batch processing for better memory management:

```javascript
async *batchLogs(logSource, batchSize = 100) {
  let batch = [];

  for await (const log of logSource) {
    batch.push(log);

    if (batch.length === batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}
```

#### 5.2 File Output

Write processed results to files:

```javascript
const fs = require('fs').promises;

async processToFile(logSource, outputFile) {
  const writeStream = fs.createWriteStream(outputFile);

  for await (const log of logSource) {
    const processed = await this.processLogEntry(log);
    writeStream.write(JSON.stringify(processed) + '\n');
  }

  writeStream.end();
}
```

#### 5.3 Resumable Processing

Implement checkpoint-based processing:

```javascript
async *resumableGenerator(startFrom = 0) {
  for (let i = startFrom; i < this.logCount; i++) {
    // Save checkpoint every 1000 items
    if (i % 1000 === 0) {
      await this.saveCheckpoint(i);
    }
    yield this.generateLogEntry(i);
  }
}
```

## Running Your Application

### Basic Commands

```bash
# Run demo mode (default)
node index.js

# Run performance tests
node index.js performance

# Run interactive mode
node index.js interactive
```

### Expected Output

- **Demo Mode**: Processes 5,000 logs and shows statistics
- **Performance Mode**: Compares memory and speed across different approaches
- **Interactive Mode**: Allows real-time command execution

## Common Issues and Solutions

### Chalk Import Error

If you encounter `TypeError: chalk.green is not a function`, ensure you're using dynamic imports:

```javascript
// Correct approach for chalk ES module
let chalk;
chalk = (await import('chalk')).default;
```

### Memory Issues

- Use generators instead of arrays for large datasets
- Monitor memory usage with `process.memoryUsage()`
- Force garbage collection with `global.gc()` (run with `--expose-gc` flag)

## Deliverables

- [ ] `data-generator.js` - Three generation methods (array, sync generator, async generator)
- [ ] `log-processor.js` - Async iterator processing with statistics
- [ ] `performance-test.js` - Memory and speed comparisons
- [ ] `index.js` - CLI interface with multiple modes
- [ ] Performance comparison results and analysis
- [ ] Brief explanation of async iterator benefits and trade-offs

## Key Learning Objectives

By completing this lab, you should understand:

1. **Memory Efficiency**: How generators use less memory than arrays
2. **Async Iteration**: Processing data streams without blocking
3. **Performance Trade-offs**: Speed vs. memory consumption
4. **Real-world Application**: Log processing pipeline patterns

## Assessment Criteria

- **Functionality** (40%): All three generation methods work correctly
- **Performance Analysis** (30%): Clear comparison and understanding of trade-offs
- **Code Quality** (20%): Clean, readable, and well-structured code
- **Error Handling** (10%): Proper async error handling and edge cases

## Extension Challenges

If you finish early, try these advanced features:

- [ ] Implement log filtering by level or user
- [ ] Add real-time log streaming simulation
- [ ] Create a web dashboard showing processing stats
- [ ] Implement log aggregation by time windows
- [ ] Add configurable processing delays and error rates

## Resources

- [MDN: Iterators and Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)
- [MDN: for await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- [Memory Management in Node.js](https://nodejs.org/en/docs/guides/simple-profiling/)

---

**💡 Pro Tips:**

- Use `console.time()` and `console.timeEnd()` for quick performance measurements
- The `--expose-gc` flag allows manual garbage collection for memory testing
- Watch memory usage patterns - generators maintain constant memory usage
- Async generators are perfect for I/O-heavy operations like file or database processing
