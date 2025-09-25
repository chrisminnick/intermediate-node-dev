const { randomUUID } = require('crypto');

class LogDataGenerator {
  constructor(totalRecords = 10000) {
    this.totalRecords = totalRecords;
    this.currentRecord = 0;
  }

  generateAll() {
    const logs = [];
    for (let i = 0; i < this.totalRecords; i++) {
      logs.push(this.createLogEntry());
    }
    return logs;
  }

  *generateSync() {
    for (let i = 0; i < this.totalRecords; i++) {
      yield this.createLogEntry();
    }
  }

  async *generateAsync() {
    for (let i = 0; i < this.totalRecords; i++) {
      if (i % 1000 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      yield this.createLogEntry();
    }
  }

  createLogEntry() {
    const levels = ['info', 'warn', 'error', 'debug'];
    const services = ['auth', 'api', 'database', 'cache', 'payment'];
    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      service: services[Math.floor(Math.random() * services.length)],
      message: `Operation completed with status ${Math.floor(
        Math.random() * 1000
      )}`,
      duration: Math.floor(Math.random() * 5000),
      userId: `user_${Math.floor(Math.random() * 10000)}`,
    };
  }
}

module.exports = LogDataGenerator;
