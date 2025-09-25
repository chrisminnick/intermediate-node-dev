// Dynamic import for chalk will be handled in the constructor

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

  async processLogsAsync(logSource) {
    await this.initChalk();
    console.log(this.chalk.blue('Starting async log processing...'));
    const startTime = Date.now();
    try {
      for await (const log of logSource) {
        await this.processLogEntry(log);
        if (this.processedCount % 1000 === 0) {
          console.log(
            this.chalk.green(`Processed ${this.processedCount} logs...`)
          );
        }
      }
    } catch (error) {
      console.error(this.chalk.red('Error processing logs:'), error);
    }
    const duration = Date.now() - startTime;
    this.printStats(duration);
  }

  async processLogEntry(log) {
    this.processedCount++;
    if (log.level === 'error') {
      this.errorCount++;
    } else if (log.level === 'warn') {
      this.warningCount++;
    }
    if (!this.userStats.has(log.userId)) {
      this.userStats.set(log.userId, {
        requests: 0,
        totalDuration: 0,
        errors: 0,
      });
    }
    const userStat = this.userStats.get(log.userId);
    userStat.requests++;
    userStat.totalDuration += log.duration;
    if (log.level === 'error') {
      userStat.errors++;
    }
    if (log.level === 'error' && log.service === 'payment') {
      await this.handleCriticalError(log);
    }
  }

  async handleCriticalError(log) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  printStats(duration) {
    console.log(this.chalk.yellow('\n=== Processing Complete ==='));
    console.log(`Total logs processed: ${this.processedCount}`);
    console.log(`Errors found: ${this.errorCount}`);
    console.log(`Warnings found: ${this.warningCount}`);
    console.log(`Processing time: ${duration}ms`);
    console.log(
      `Average processing rate: ${Math.round(
        this.processedCount / (duration / 1000)
      )} logs/second`
    );
    const topUsers = Array.from(this.userStats.entries())
      .sort(([, a], [, b]) => b.requests - a.requests)
      .slice(0, 5);
    console.log(this.chalk.cyan('\nTop 5 Most Active Users:'));
    topUsers.forEach(([userId, stats]) => {
      console.log(
        `${userId}: ${stats.requests} requests, ${
          stats.errors
        } errors, avg duration: ${Math.round(
          stats.totalDuration / stats.requests
        )}ms`
      );
    });
  }

  reset() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.warningCount = 0;
    this.userStats.clear();
  }
}

module.exports = LogProcessor;
