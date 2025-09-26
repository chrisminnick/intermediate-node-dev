const { parentPort } = require('worker_threads');

// CPU-intensive calculation in worker thread
function performCPUIntensiveWork(iterations) {
  let result = 0;

  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
  }

  return result;
}

// Listen for messages from main thread
parentPort.on('message', (data) => {
  try {
    const { iterations } = data;
    const result = performCPUIntensiveWork(iterations);

    parentPort.postMessage({
      value: result,
      iterations,
      processedBy: 'worker-thread',
    });
  } catch (error) {
    parentPort.postMessage({
      error: error.message,
    });
  }
});
