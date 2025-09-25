const crypto = require('crypto');

function isPrime(num) {
  if (num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;

  for (let i = 3; i <= Math.sqrt(num); i += 2) {
    if (num % i === 0) return false;
  }
  return true;
}

function findPrimesInRange(start, end) {
  const primes = [];
  for (let i = start; i <= end; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }
  }
  return primes;
}

function calculatePrimes(limit) {
  console.log(`Calculating primes up to ${limit}...`);
  const startTime = Date.now();
  const primes = findPrimesInRange(2, limit);
  const duration = Date.now() - startTime;

  return {
    count: primes.length,
    largest: primes[primes.length - 1] || 0,
    duration,
    primes: limit <= 1000 ? primes : [], // Only return array for small datasets
  };
}

function intensiveHash(data, iterations = 100000) {
  let result = data;
  for (let i = 0; i < iterations; i++) {
    result = crypto.createHash('sha256').update(result).digest('hex');
  }
  return result;
}

function batchHashCalculation(dataArray, iterations = 50000) {
  const results = [];
  const startTime = Date.now();

  for (const data of dataArray) {
    results.push({
      input: data,
      hash: intensiveHash(data, iterations),
      timestamp: Date.now(),
    });
  }

  return {
    results,
    duration: Date.now() - startTime,
    count: results.length,
  };
}

// Fibonacci calculation (another CPU-intensive task)
function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function calculateFibonacci(n) {
  const startTime = Date.now();
  const result = fibonacci(n);
  const duration = Date.now() - startTime;

  return {
    input: n,
    result,
    duration,
  };
}

module.exports = {
  isPrime,
  findPrimesInRange,
  calculatePrimes,
  intensiveHash,
  batchHashCalculation,
  fibonacci,
  calculateFibonacci,
};
