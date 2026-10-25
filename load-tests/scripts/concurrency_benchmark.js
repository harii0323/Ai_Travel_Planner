const http = require('http');

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 10000,
  maxFreeSockets: 5000,
  timeout: 30000
});

function sendRequest(options, postData = null) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = http.request({
      ...options,
      agent,
      headers: {
        'Content-Type': 'application/json',
        'X-Bypass-RateLimit': 'true', // benchmark testing flag
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({
          statusCode: res.statusCode,
          durationMs,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (err) => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      resolve({
        statusCode: 0,
        durationMs,
        success: false,
        error: err.code || err.message
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      resolve({
        statusCode: 504,
        durationMs,
        success: false,
        error: 'TIMEOUT'
      });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;
  return { p50, p95, p99, min, max, avg };
}

async function runTier(name, concurrency, totalRequests, reqFn) {
  console.log(`\n--------------------------------------------------------------`);
  console.log(`🚀 Benchmarking Tier: ${name} | Concurrency: ${concurrency} | Total: ${totalRequests}`);
  console.log(`--------------------------------------------------------------`);

  const startTime = Date.now();
  let completed = 0;
  let active = 0;
  let cursor = 0;
  const results = [];

  const initialMem = process.memoryUsage();

  await new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) {
        return resolve();
      }

      while (active < concurrency && cursor < totalRequests) {
        cursor++;
        active++;
        reqFn().then(res => {
          results.push(res);
          active--;
          completed++;
          if (completed % Math.max(100, Math.floor(totalRequests / 5)) === 0 || completed === totalRequests) {
            process.stdout.write(`   Progress: ${completed}/${totalRequests} (${Math.round((completed/totalRequests)*100)}%)\r`);
          }
          launchNext();
        });
      }
    }

    launchNext();
  });

  const totalTimeSeconds = (Date.now() - startTime) / 1000;
  const rps = totalRequests / totalTimeSeconds;
  const finalMem = process.memoryUsage();

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  const latencies = results.map(r => r.durationMs);
  const stats = calculatePercentiles(latencies);

  console.log(`\n   ✓ Completed in: ${totalTimeSeconds.toFixed(2)}s`);
  console.log(`   ✓ Throughput:   ${rps.toFixed(1)} req/s`);
  console.log(`   ✓ Success Rate: ${((successCount / totalRequests) * 100).toFixed(2)}% (${successCount}/${totalRequests})`);
  console.log(`   ✓ Latency:      p50 = ${stats.p50.toFixed(1)}ms | p95 = ${stats.p95.toFixed(1)}ms | p99 = ${stats.p99.toFixed(1)}ms`);
  console.log(`   ✓ Latency Span: min = ${stats.min.toFixed(1)}ms | avg = ${stats.avg.toFixed(1)}ms | max = ${stats.max.toFixed(1)}ms`);
  console.log(`   ✓ Heap Used:    ${(finalMem.heapUsed / 1024 / 1024).toFixed(1)} MB`);

  return {
    tier: name,
    concurrency,
    totalRequests,
    durationSec: Number(totalTimeSeconds.toFixed(2)),
    rps: Number(rps.toFixed(1)),
    successRate: Number(((successCount / totalRequests) * 100).toFixed(2)),
    p50: Number(stats.p50.toFixed(1)),
    p95: Number(stats.p95.toFixed(1)),
    p99: Number(stats.p99.toFixed(1)),
    avgLatency: Number(stats.avg.toFixed(1)),
    errors: errorCount
  };
}

async function runAllBenchmarks() {
  console.log('==============================================================');
  console.log('       AI TRAVEL PLANNER HIGH-CONCURRENCY LOAD BENCHMARK      ');
  console.log('==============================================================');

  const allMetrics = [];

  // 1. Health & Liveness tier (100 concurrency)
  const m100 = await runTier('100 Concurrent Users (API Health)', 100, 1000, () => {
    return sendRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
  });
  allMetrics.push(m100);

  // 2. High-volume read & metadata (500 concurrency)
  const m500 = await runTier('500 Concurrent Users (Privacy & Policy)', 500, 2500, () => {
    return sendRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/privacy',
      method: 'GET'
    });
  });
  allMetrics.push(m500);

  // 3. State & LinUCB exploration (1,000 concurrency)
  const m1000 = await runTier('1,000 Concurrent Users (Bandit State)', 1000, 5000, () => {
    return sendRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/itinerary/bandit/state',
      method: 'GET'
    });
  });
  allMetrics.push(m1000);

  // 4. Heavy load read & cache tier (2,500 concurrency)
  const m2500 = await runTier('2,500 Concurrent Users (Cached Read Pipeline)', 2500, 10000, () => {
    return sendRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
  });
  allMetrics.push(m2500);

  // 5. Massive 5,000 concurrency capacity target
  const m5000 = await runTier('5,000 Concurrent Capacity Target', 5000, 15000, () => {
    return sendRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/privacy',
      method: 'GET'
    });
  });
  allMetrics.push(m5000);

  console.log('\n==============================================================');
  console.log('                    FINAL BENCHMARK SUMMARY                   ');
  console.log('==============================================================');
  console.table(allMetrics);
  
  const fs = require('fs');
  fs.writeFileSync('load-tests/results/concurrency_summary.json', JSON.stringify(allMetrics, null, 2));
  console.log('\nSaved metrics to load-tests/results/concurrency_summary.json');
}

runAllBenchmarks().catch(console.error);
