const LogDataGenerator = require('./data-generator');
const LogProcessor = require('./log-processor');

class PerformanceTest {
  constructor() {
    this.generator = new LogDataGenerator(50000);
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

  async testArrayApproach() {
    console.log(this.chalk.blue('Test 1: Traditional Array Approach'));
    const startMemory = process.memoryUsage();
    const startTime = Date.now();
    try {
      const logs = this.generator.generateAll();
      console.log(`Generated ${logs.length} logs in memory`);
      for (const log of logs) {
        await this.processor.processLogEntry(log);
      }
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      console.log(`Duration: ${endTime - startTime}ms`);
      console.log(
        `Memory used: ${Math.round(
          (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024
        )}MB`
      );
    } catch (error) {
      console.error('Error in array approach:', error);
    }
    this.processor.reset();
    console.log('---\n');
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
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      console.log(`Processed ${count} logs`);
      console.log(`Duration: ${endTime - startTime}ms`);
      console.log(
        `Memory used: ${Math.round(
          (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024
        )}MB`
      );
    } catch (error) {
      console.error('Error in sync generator approach:', error);
    }
    this.processor.reset();
    console.log('---\n');
  }

  async testAsyncGeneratorApproach() {
    console.log(this.chalk.blue('Test 3: Async Generator Approach'));
    const startMemory = process.memoryUsage();
    const startTime = Date.now();
    try {
      let count = 0;
      for await (const log of this.generator.generateAsync()) {
        await this.processor.processLogEntry(log);
        count++;
      }
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      console.log(`Processed ${count} logs`);
      console.log(`Duration: ${endTime - startTime}ms`);
      console.log(
        `Memory used: ${Math.round(
          (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024
        )}MB`
      );
    } catch (error) {
      console.error('Error in async generator approach:', error);
    }
    this.processor.reset();
    console.log('---\n');
  }

  async testMemoryUsage() {
    console.log(this.chalk.blue('Test 4: Memory Usage Detailed Analysis'));
    if (global.gc) {
      global.gc();
    }
    const baseline = process.memoryUsage();
    console.log('Baseline memory:', baseline);
    console.log('\nCreating large array...');
    const largeArray = this.generator.generateAll();
    const afterArray = process.memoryUsage();
    console.log(
      `Array memory impact: ${Math.round(
        (afterArray.heapUsed - baseline.heapUsed) / 1024 / 1024
      )}MB`
    );
    largeArray.length = 0;
    if (global.gc) global.gc();
    console.log('\nUsing generator (no array storage)...');
    const beforeGenerator = process.memoryUsage();
    let count = 0;
    for (const log of this.generator.generateSync()) {
      count++;
      if (count >= 50000) break;
    }
    const afterGenerator = process.memoryUsage();
    console.log(
      `Generator memory impact: ${Math.round(
        (afterGenerator.heapUsed - beforeGenerator.heapUsed) / 1024 / 1024
      )}MB`
    );
  }
}

module.exports = PerformanceTest;
