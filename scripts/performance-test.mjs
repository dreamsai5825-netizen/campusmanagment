#!/usr/bin/env node
/**
 * Performance test: measures response times for key pages.
 * Run with app serving on BASE_URL (default http://localhost:3000).
 * Usage: npm run test:performance
 * For full Lighthouse audit, use: npx playwright test --project=chromium e2e/performance.spec.ts (if added)
 */

const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:3000';

async function measure(url, label) {
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const body = await res.text();
    const end = performance.now();
    const duration = Math.round(end - start);
    const ok = res.ok;
    const size = new TextEncoder().encode(body).length;
    return { label, url, ok, status: res.status, durationMs: duration, sizeBytes: size };
  } catch (err) {
    const end = performance.now();
    return {
      label,
      url,
      ok: false,
      error: err.message,
      durationMs: Math.round(end - start),
    };
  }
}

async function main() {
  const routes = [
    ['/', 'Home'],
    ['/student-login', 'Student login page'],
  ];

  console.log('Performance test');
  console.log('Base URL:', BASE_URL);
  console.log('');

  const results = [];
  for (const [path, label] of routes) {
    const url = `${BASE_URL}${path}`;
    const result = await measure(url, label);
    results.push(result);
  }

  let failed = false;
  for (const r of results) {
    const status = r.error ? `ERROR: ${r.error}` : (r.ok ? `${r.status}` : `HTTP ${r.status}`);
    const time = r.durationMs != null ? `${r.durationMs} ms` : '-';
    const size = r.sizeBytes != null ? ` (${(r.sizeBytes / 1024).toFixed(1)} KB)` : '';
    if (!r.ok && !r.error) failed = true;
    console.log(`${r.label}: ${status} – ${time}${size}`);
  }

  const slow = results.filter((r) => r.durationMs != null && r.durationMs > 3000);
  if (slow.length) {
    console.log('');
    console.log('Slow (>3s):', slow.map((r) => r.label).join(', '));
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
