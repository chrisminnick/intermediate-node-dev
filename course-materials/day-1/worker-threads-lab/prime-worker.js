const { parentPort, workerData } = require('worker_threads');
const {
  findPrimesInRange,
  calculatePrimes,
  intensiveHash,
  batchHashCalculation,
  calculateFibonacci,
} = require('./cpu-intensive');

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
            primes: params.returnPrimes ? primes : [],
            count: primes.length,
            range: `${params.start}-${params.end}`,
            start: params.start,
            end: params.end,
          },
          taskId: params.taskId,
        });
        break;

      case 'intensiveHash':
        const hash = intensiveHash(params.data, params.iterations);
        parentPort.postMessage({
          success: true,
          result: {
            input: params.data,
            hash,
            iterations: params.iterations,
          },
          taskId: params.taskId,
        });
        break;

      case 'batchHash':
        const batchResult = batchHashCalculation(
          params.dataArray,
          params.iterations
        );
        parentPort.postMessage({
          success: true,
          result: batchResult,
          taskId: params.taskId,
        });
        break;

      case 'fibonacci':
        const fibResult = calculateFibonacci(params.n);
        parentPort.postMessage({
          success: true,
          result: fibResult,
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
      taskId: data.taskId || 'unknown',
      stack: error.stack,
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    success: false,
    error: `Uncaught exception: ${error.message}`,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle initialization data
if (workerData) {
  console.log(`Worker ${workerData.workerId} initialized`);
}

// Send ready signal
parentPort.postMessage({ ready: true, workerId: workerData?.workerId });
