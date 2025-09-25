# Lab 2: Worker Thread Implementation for CPU-Intensive Tasks

## Objective
Use Node.js worker threads to offload CPU-intensive work and improve application responsiveness.

## Instructions

### Part 1: Synchronous CPU Task
1. Create a Node.js project.
2. Implement a CPU-bound function (e.g., large prime calculation or hashing).

### Part 2: Worker Thread Integration
1. Use the `worker_threads` module to move the CPU task into a worker.
2. Set up message passing between main and worker threads.
3. Compare performance and responsiveness with/without workers.

### Part 3: Extension (Optional)
- Implement a worker pool for multiple tasks
- Add error handling for worker failures
- Use transferable objects for large data

## Deliverables
- Main and worker thread code
- Performance comparison results
- Brief explanation of worker thread benefits

## Resources
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)

---

**Tip:** Focus on freeing the event loop and handling heavy computation efficiently.
