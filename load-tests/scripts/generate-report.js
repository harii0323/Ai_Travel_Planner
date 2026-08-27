const fs = require('fs');
const path = require('path');

const resultsDir = process.argv[2] || path.join('load-tests', 'results');

function metricValue(summary, name, key) {
  return summary.metrics?.[name]?.values?.[key];
}

function fmt(value, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return Number(value).toFixed(digits);
}

function statusFor(row) {
  const p95 = Number(row.p95 || 0);
  const errorRate = Number(row.errorRate || 0);
  if (errorRate >= 1 || p95 >= 5000) return 'FAIL';
  if (errorRate >= 0.5 || p95 >= 800) return 'WATCH';
  return 'PASS';
}

function parseSummary(file) {
  const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = path.basename(file).replace('-summary.json', '');
  const row = {
    testType: base,
    concurrentUsers: fmt(metricValue(summary, 'vus_max', 'value'), 0),
    rps: fmt(metricValue(summary, 'http_reqs', 'rate')),
    avg: fmt(metricValue(summary, 'http_req_duration', 'avg')),
    p95: fmt(metricValue(summary, 'http_req_duration', 'p(95)')),
    p99: fmt(metricValue(summary, 'http_req_duration', 'p(99)')),
    errorRate: fmt((metricValue(summary, 'http_req_failed', 'rate') || 0) * 100),
    http4xx: fmt((metricValue(summary, 'http_4xx_rate', 'rate') || 0) * 100),
    http5xx: fmt((metricValue(summary, 'http_5xx_rate', 'rate') || 0) * 100),
    itineraryP95: fmt(metricValue(summary, 'itinerary_latency', 'p(95)')),
    status: ''
  };
  row.status = statusFor(row);
  return row;
}

if (!fs.existsSync(resultsDir)) {
  console.error(`Results directory does not exist: ${resultsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(resultsDir)
  .filter((file) => file.endsWith('-summary.json'))
  .map((file) => path.join(resultsDir, file));

if (files.length === 0) {
  console.error(`No *-summary.json files found in ${resultsDir}`);
  process.exit(1);
}

const rows = files.map(parseSummary);

const lines = [
  '| Test Type | Concurrent Users | RPS | Avg Response ms | p95 ms | p99 ms | Error Rate % | 4xx % | 5xx % | Itinerary p95 ms | Status |',
  '| --------- | ---------------: | --: | --------------: | -----: | -----: | -----------: | ----: | ----: | ---------------: | ------ |'
];

for (const row of rows) {
  lines.push(`| ${row.testType} | ${row.concurrentUsers} | ${row.rps} | ${row.avg} | ${row.p95} | ${row.p99} | ${row.errorRate} | ${row.http4xx} | ${row.http5xx} | ${row.itineraryP95} | ${row.status} |`);
}

const report = [
  '# Load Test Summary',
  '',
  ...lines,
  '',
  'Infrastructure metrics such as CPU, memory, event-loop lag, PostgreSQL CPU, active connections, connection wait time, slow queries, and Google API latency must be copied from your monitoring stack or the commands in README.md. k6 only records client-observed HTTP metrics unless you add telemetry endpoints/exporters.',
  ''
].join('\n');

const outputFile = path.join(resultsDir, 'capacity-report.md');
fs.writeFileSync(outputFile, report);
console.log(report);
console.log(`Wrote ${outputFile}`);
