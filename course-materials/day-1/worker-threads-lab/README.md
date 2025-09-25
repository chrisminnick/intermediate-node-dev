# Worker Threads Lab

This lab demonstrates the use of Node.js Worker Threads for CPU-intensive tasks.

## Installation

```bash
npm install
```

## Running the Lab

### Basic Commands

```bash
# Basic demo
node index.js demo

# Show blocking behavior
node index.js blocking

# Show non-blocking worker behavior
node index.js worker

# Run performance comparisons
node index.js performance

# Compare different task types
node index.js comparison

# Interactive mode
node index.js interactive
```

### Using npm scripts

```bash
npm start              # Basic demo
npm run demo           # Same as above
npm run blocking       # Blocking demo
npm run worker         # Worker demo
npm run performance    # Performance tests
npm run interactive    # Interactive mode
```

## What This Lab Demonstrates

### 1. **Event Loop Blocking**

- Shows how CPU-intensive tasks block the main thread
- Demonstrates delayed timer execution
- Highlights responsiveness issues

### 2. **Worker Thread Benefits**

- Non-blocking execution of CPU tasks
- Main thread remains responsive
- Parallel processing capabilities

### 3. **Performance Comparison**

- Sequential vs concurrent processing
- Memory usage patterns
- Scalability analysis

### 4. **Real-world Applications**

- Prime number calculation
- Hash computation
- Fibonacci sequences
- Range-based processing

## Key Files

- `index.js` - Main application with CLI interface
- `cpu-intensive.js` - CPU-bound functions
- `prime-worker.js` - Worker thread implementation
- `worker-manager.js` - Worker pool management
- `performance-comparison.js` - Performance testing suite

## Expected Output

### Demo Mode

```
=== Worker Thread Demo ===

Initializing 2 workers...
Worker 0 initialized
Worker 1 initialized
Worker pool ready with 2 workers
Calculating primes using worker thread...
Task 1 completed in 1234ms by worker 0
Found 9592 primes up to 100,000
Largest prime: 99991
Calculation time: 1234ms
Processed by worker: 0
```

### Blocking vs Non-blocking

The blocking demo will show delayed timer messages, while the worker demo shows timely timer execution.

## Learning Objectives

- Understand when to use worker threads
- Learn worker thread communication patterns
- Experience the benefits of non-blocking processing
- Implement worker pool management
- Compare performance characteristics

## Extensions

Try modifying the code to:

- Add more CPU-intensive tasks
- Implement different worker pool strategies
- Add task prioritization
- Monitor memory usage patterns
- Implement graceful shutdown handling
