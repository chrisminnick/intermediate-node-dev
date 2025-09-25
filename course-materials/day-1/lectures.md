# Day 1: Advanced Asynchronous Programming & Express Design

## Session 1: Event Loop Deep Dive & Performance Considerations

**Duration**: 90 minutes  
**Objective**: Master the Node.js event loop and understand performance implications

### Learning Outcomes

- Understand the phases of the Node.js event loop
- Identify performance bottlenecks in asynchronous code
- Apply best practices for non-blocking operations

### Lecture Content

#### 1. Event Loop Architecture (30 minutes)

- **Call Stack vs Event Loop**

  - Single-threaded nature of JavaScript
  - How Node.js handles I/O operations
  - Thread pool and libuv's role

- **Event Loop Phases**
  ```
  ┌───────────────────────────┐
  ┌─>│           timers          │  ← setTimeout, setInterval
  │  └─────────────┬─────────────┘
  │  ┌─────────────┴─────────────┐
  │  │     pending callbacks     │  ← I/O callbacks
  │  └─────────────┬─────────────┘
  │  ┌─────────────┴─────────────┐
  │  │       idle, prepare       │  ← internal use
  │  └─────────────┬─────────────┘
  │  ┌─────────────┴─────────────┐
  │  │           poll            │  ← new I/O events
  │  └─────────────┬─────────────┘
  │  ┌─────────────┴─────────────┐
  │  │           check           │  ← setImmediate
  │  └─────────────┬─────────────┘
  │  ┌─────────────┴─────────────┐
  └──┤      close callbacks      │  ← close events
     └───────────────────────────┘
  ```

#### 2. Performance Considerations (30 minutes)

- **Blocking vs Non-blocking Operations**

  - CPU-intensive tasks and the event loop
  - When to use worker threads
  - Memory management and garbage collection

- **Microtasks vs Macrotasks**
  - Promise resolution priority
  - process.nextTick() behavior
  - setImmediate() vs setTimeout(0)

#### 3. Profiling and Debugging (30 minutes)

- **Built-in Profiling Tools**
  - `--inspect` and Chrome DevTools
  - `--trace-events` for detailed analysis
  - Memory leak detection techniques

### Code Examples

#### Event Loop Demonstration

```javascript
// Demonstrates event loop phases
console.log('Start');

setTimeout(() => console.log('Timer 1'), 0);
setImmediate(() => console.log('Immediate 1'));

process.nextTick(() => console.log('NextTick 1'));
Promise.resolve().then(() => console.log('Promise 1'));

setTimeout(() => console.log('Timer 2'), 0);
setImmediate(() => console.log('Immediate 2'));

process.nextTick(() => console.log('NextTick 2'));
Promise.resolve().then(() => console.log('Promise 2'));

console.log('End');
```

#### Performance Monitoring

```javascript
const { performance, PerformanceObserver } = require('perf_hooks');

// Monitor async operations
const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});
obs.observe({ entryTypes: ['measure', 'mark'] });

async function monitoredOperation() {
  performance.mark('operation-start');

  // Simulate async work
  await new Promise((resolve) => setTimeout(resolve, 100));

  performance.mark('operation-end');
  performance.measure('async-operation', 'operation-start', 'operation-end');
}
```

### Discussion Points

1. When would you choose worker threads over clustering?
2. How do you identify if your application is CPU-bound vs I/O-bound?
3. What are the trade-offs between different timer functions?

---

## Session 2: Async Iterators, Generators & Worker Threads

**Duration**: 75 minutes  
**Objective**: Implement advanced async patterns for scalable applications

### Learning Outcomes

- Create and consume async iterators
- Use generators for memory-efficient data processing
- Implement worker threads for CPU-intensive tasks
- Design message queues for background processing

### Lecture Content

#### 1. Async Iterators and Generators (35 minutes)

- **Async Iterator Protocol**

  - Symbol.asyncIterator implementation
  - Creating custom async iterables
  - for-await-of loops

- **Async Generators**
  - Combining generators with async/await
  - Yielding promises and handling errors
  - Memory-efficient data streaming

#### 2. Worker Threads (25 minutes)

- **When to Use Worker Threads**

  - CPU-intensive computations
  - Image/video processing
  - Data transformation tasks

- **Worker Thread API**
  - Creating and managing workers
  - Message passing and SharedArrayBuffer
  - Error handling and cleanup

#### 3. Message Queues and Job Scheduling (15 minutes)

- **Queue Patterns**
  - Producer-consumer architecture
  - Job prioritization and retries
  - Popular libraries (Bull, Bee-Queue)

### Code Examples

#### Async Iterator Implementation

```javascript
class DataStream {
  constructor(data) {
    this.data = data;
    this.index = 0;
  }

  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        if (this.index < this.data.length) {
          // Simulate async data fetching
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            value: this.data[this.index++],
            done: false,
          };
        }
        return { done: true };
      },
    };
  }
}

// Usage
async function processData() {
  const stream = new DataStream([1, 2, 3, 4, 5]);

  for await (const item of stream) {
    console.log(`Processing: ${item}`);
  }
}
```

#### Async Generator for File Processing

```javascript
const fs = require('fs').promises;
const path = require('path');

async function* processFiles(directory) {
  const files = await fs.readdir(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = await fs.stat(filePath);

    if (stats.isFile()) {
      const content = await fs.readFile(filePath, 'utf8');
      yield {
        filename: file,
        size: stats.size,
        content: content,
      };
    }
  }
}
```

#### Worker Thread Implementation

```javascript
// main.js
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require('worker_threads');

if (isMainThread) {
  // Main thread
  async function runWorker(data) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: data,
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  // Usage
  runWorker({ numbers: [1, 2, 3, 4, 5] }).then((result) =>
    console.log('Result:', result)
  );
} else {
  // Worker thread
  function intensiveCalculation(numbers) {
    return numbers.reduce((sum, num) => {
      // Simulate CPU-intensive work
      for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(num);
      }
      return sum;
    }, 0);
  }

  const result = intensiveCalculation(workerData.numbers);
  parentPort.postMessage(result);
}
```

### Hands-on Exercises

1. **Async Iterator Challenge**: Create an async iterator that fetches paginated API data
2. **Generator Memory Test**: Compare memory usage between arrays and generators for large datasets
3. **Worker Thread Benchmark**: Implement and benchmark different approaches to parallel processing

### Assessment Questions

1. What's the difference between regular iterators and async iterators?
2. When should you use worker threads vs child processes?
3. How do you handle errors in async generators?
