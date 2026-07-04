#!/usr/bin/env node
/**
 * Stress test: sends concurrent requests to the app to find breaking point.
 * Uses autocannon (npm dependency). Run with app on BASE_URL.
 * Usage: npm run test:stress
 * Optional: STRESS_DURATION=10 STRESS_CONNECTIONS=50 npm run test:stress
 */

const BASE_URL = process.env.STRESS_BASE_URL || 'http://localhost:3000';
const DURATION = parseInt(process.env.STRESS_DURATION || '5', 10);
const CONNECTIONS = parseInt(process.env.STRESS_CONNECTIONS || '10', 10);
const PIPELINING = parseInt(process.env.STRESS_PIPELINING || '1', 10);

async function main() {
  let autocannon;
  try {
    autocannon = (await import('autocannon')).default;
  } catch {
    console.error('autocannon not found. Run: npm install --save-dev autocannon');
    process.exit(1);
  }

  console.log('Stress test');
  console.log('URL:', BASE_URL);
  console.log('Duration:', DURATION, 's, Connections:', CONNECTIONS, ', Pipelining:', PIPELINING);
  console.log('');

  const result = await autocannon({
    url: BASE_URL,
    duration: DURATION,
    connections: CONNECTIONS,
    pipelining: PIPELINING,
  });

  console.log('Requests:', result.requests.total);
  console.log('Throughput:', result.requests.average?.toFixed(1) || 0, 'req/s');
  console.log('Latency (mean):', result.latency.mean ? `${(result.latency.mean / 1000).toFixed(2)} ms` : 'N/A');
  console.log('Latency (p99):', result.latency.p99 ? `${(result.latency.p99 / 1000).toFixed(2)} ms` : 'N/A');
  console.log('Errors:', result.errors || 0);
  console.log('Timeouts:', result.timeouts || 0);

  if ((result.errors || 0) + (result.timeouts || 0) > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
