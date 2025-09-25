# Lab 1: Building Async Iterators for Data Processing

## Objective
Create a memory-efficient data processing pipeline using async iterators and generators in Node.js.

## Instructions

### Part 1: Data Generation
1. Create a Node.js project and install dependencies:
   - `chalk` for colored output
   - `uuid` for unique IDs
2. Implement a `LogDataGenerator` class that can:
   - Generate all logs in memory
   - Yield logs using a sync generator
   - Yield logs using an async generator (simulate async I/O)

### Part 2: Async Log Processing
1. Implement a `LogProcessor` class that:
   - Processes logs using an async iterator
   - Tracks errors, warnings, and user activity
   - Prints summary statistics
2. Add error handling and progress indicators.

### Part 3: Performance Comparison
1. Compare memory and speed for:
   - Array approach
   - Sync generator
   - Async generator
2. Print results and discuss trade-offs.

### Part 4: Extension (Optional)
- Batch process logs (e.g., 100 at a time)
- Write results to a file as processed
- Implement a custom iterator that resumes from a checkpoint

## Deliverables
- Data generator and log processor code
- Performance comparison results
- Brief explanation of async iterator benefits

## Resources
- [MDN: Iterators and Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)
- [Node.js Streams](https://nodejs.org/api/stream.html)

---

**Tip:** Focus on async iterator usage and memory efficiency. Add extensions if time allows.
