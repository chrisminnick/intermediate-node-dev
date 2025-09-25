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

    const workerPromises = [];
    for (let i = 0; i < this.maxWorkers; i++) {
      workerPromises.push(this.createWorker(i));
    }

    await Promise.all(workerPromises);
    console.log(
      this.chalk.green(`Worker pool ready with ${this.workers.length} workers`)
    );
  }

  async createWorker(workerId) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerScript, {
        workerData: { workerId },
      });

      let isReady = false;

      worker.on('message', (result) => {
        if (result.ready && !isReady) {
          isReady = true;
          resolve(worker);
        } else {
          this.handleWorkerMessage(worker, result);
        }
      });

      worker.on('error', (error) => {
        console.error(this.chalk.red(`Worker ${workerId} error:`), error);
        if (!isReady) {
          reject(error);
        } else {
          this.handleWorkerError(worker, error);
        }
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(
            this.chalk.red(`Worker ${workerId} exited with code ${code}`)
          );
        }
        this.removeWorker(worker);
      });

      // Set worker properties
      worker.workerId = workerId;
      worker.busy = false;
      worker.currentTask = null;

      this.workers.push(worker);

      // Set timeout for worker initialization
      setTimeout(() => {
        if (!isReady) {
          reject(
            new Error(`Worker ${workerId} failed to initialize within timeout`)
          );
        }
      }, 5000);
    });
  }

  async executeTask(taskType, params = {}) {
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
        this.chalk.green(
          `Task ${result.taskId} completed in ${duration}ms by worker ${worker.workerId}`
        )
      );
      task.resolve({ ...result.result, duration, workerId: worker.workerId });
    } else {
      console.error(
        this.chalk.red(`Task ${result.taskId} failed:`, result.error)
      );
      task.reject(new Error(result.error));
    }

    // Process next task in queue
    this.processQueue();

    // Continue processing if there are more tasks
    setImmediate(() => this.processQueue());
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

  getStats() {
    const busyWorkers = this.workers.filter((w) => w.busy).length;
    return {
      totalWorkers: this.workers.length,
      busyWorkers,
      availableWorkers: this.workers.length - busyWorkers,
      queuedTasks: this.taskQueue.length,
    };
  }

  async shutdown() {
    console.log(this.chalk.yellow('Shutting down worker pool...'));

    const terminationPromises = this.workers.map((worker) => {
      return worker.terminate();
    });

    await Promise.all(terminationPromises);

    this.workers = [];
    this.taskQueue = [];
    console.log(this.chalk.green('All workers terminated'));
  }
}

module.exports = WorkerManager;
