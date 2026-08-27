# AI Travel Planner Load Tests

This k6 suite tests the actual API endpoints in the app:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `GET /api/history`
- `POST /api/itinerary/generate`
- `POST /api/itinerary/save`
- `GET /api/places?q=...&limit=25`

The mixed workload is weighted as requested:

- 60% history/dashboard reads
- 15% itinerary generation
- 10% itinerary saves
- 10% auth/profile operations
- 5% place search

## Important Safety Rule

Run smoke and normal tests against local Docker or staging first. Do not run stress/spike/soak against production unless you have a maintenance window, monitoring open, and an abort plan.

## Environment Variables

Common variables:

```sh
BASE_URL=http://localhost:5000
TEST_USER_PREFIX=loadtest
TEST_USER_DOMAIN=example.test
TEST_RUN_ID=optional-stable-run-id
TEST_PASSWORD=LoadTest123!
TEST_USERS=1200
REQUEST_TIMEOUT=60s
SUMMARY_FILE=load-tests/results/smoke-summary.json
WORKLOAD_MODE=mixed
```

Threshold variables:

```sh
NORMAL_API_P95_MS=800
AUTH_P95_MS=1500
SAVE_P95_MS=1500
ITINERARY_P95_MS=30000
GLOBAL_P95_MS=5000
HTTP_5XX_RATE_LIMIT=0.01
HTTP_ERROR_RATE_LIMIT=0.05
```

`ITINERARY_P95_MS=30000` is the product threshold used here: itinerary generation should complete within 30 seconds at p95. If your product accepts longer waits, raise it explicitly, but record that choice in the report.

## Run Locally With Docker Compose

Start the app:

```sh
docker compose up -d --build
```

Verify health:

```sh
curl http://localhost:5000/api/health
```

Note: the current `/api/health` endpoint calls Google Maps validation. Avoid high-frequency health polling during tests because it can consume external API quota and distort results.

Create the results directory if it does not exist:

```powershell
New-Item -ItemType Directory -Force load-tests/results
```

## Install k6

Windows:

```powershell
winget install k6.k6
```

macOS:

```sh
brew install k6
```

Linux:

```sh
sudo gpg -k
sudo apt install gpg ca-certificates
curl -s https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

## Exact Commands

PowerShell smoke test:

```powershell
$env:BASE_URL="http://localhost:5000"; $env:SUMMARY_FILE="load-tests/results/smoke-summary.json"; k6 run load-tests/smoke-test.js
```

PowerShell normal load test:

```powershell
$env:BASE_URL="http://localhost:5000"; $env:TEST_USERS="125"; $env:SUMMARY_FILE="load-tests/results/normal-summary.json"; k6 run load-tests/normal-load-test.js
```

PowerShell stress test:

```powershell
$env:BASE_URL="http://localhost:5000"; $env:TEST_USERS="1100"; $env:SUMMARY_FILE="load-tests/results/stress-summary.json"; k6 run load-tests/stress-test.js
```

PowerShell spike test:

```powershell
$env:BASE_URL="http://localhost:5000"; $env:TEST_USERS="550"; $env:SUMMARY_FILE="load-tests/results/spike-summary.json"; k6 run load-tests/spike-test.js
```

PowerShell soak test:

```powershell
$env:BASE_URL="http://localhost:5000"; $env:TEST_USERS="150"; $env:VUS="100"; $env:DURATION="45m"; $env:SUMMARY_FILE="load-tests/results/soak-summary.json"; k6 run load-tests/soak-test.js
```

POSIX smoke test:

```sh
BASE_URL=http://localhost:5000 SUMMARY_FILE=load-tests/results/smoke-summary.json k6 run load-tests/smoke-test.js
```

POSIX normal load test:

```sh
BASE_URL=http://localhost:5000 TEST_USERS=125 SUMMARY_FILE=load-tests/results/normal-summary.json k6 run load-tests/normal-load-test.js
```

POSIX stress test:

```sh
BASE_URL=http://localhost:5000 TEST_USERS=1100 SUMMARY_FILE=load-tests/results/stress-summary.json k6 run load-tests/stress-test.js
```

POSIX spike test:

```sh
BASE_URL=http://localhost:5000 TEST_USERS=550 SUMMARY_FILE=load-tests/results/spike-summary.json k6 run load-tests/spike-test.js
```

POSIX soak test:

```sh
BASE_URL=http://localhost:5000 TEST_USERS=150 VUS=100 DURATION=45m SUMMARY_FILE=load-tests/results/soak-summary.json k6 run load-tests/soak-test.js
```

Generate report:

```sh
node load-tests/scripts/generate-report.js load-tests/results
```

On Git Bash/Linux/macOS you can use:

```sh
chmod +x load-tests/scripts/run-tests.sh
BASE_URL=http://localhost:5000 load-tests/scripts/run-tests.sh smoke
BASE_URL=http://localhost:5000 load-tests/scripts/run-tests.sh normal
BASE_URL=http://localhost:5000 load-tests/scripts/run-tests.sh stress
BASE_URL=http://localhost:5000 load-tests/scripts/run-tests.sh spike
BASE_URL=http://localhost:5000 load-tests/scripts/run-tests.sh soak
```

## Run k6 Using Docker

From the repository root:

```sh
docker run --rm -i ^
  -e BASE_URL=http://host.docker.internal:5000 ^
  -e SUMMARY_FILE=/results/smoke-summary.json ^
  -v "%cd%/load-tests:/scripts" ^
  -v "%cd%/load-tests/results:/results" ^
  grafana/k6 run /scripts/smoke-test.js
```

Linux/macOS:

```sh
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:5000 \
  -e SUMMARY_FILE=/results/smoke-summary.json \
  -v "$PWD/load-tests:/scripts" \
  -v "$PWD/load-tests/results:/results" \
  grafana/k6 run /scripts/smoke-test.js
```

If k6 runs inside the same Docker network as the app, use `BASE_URL=http://backend:5000`.

## Infrastructure Metrics To Capture

k6 captures client-side HTTP metrics. For the full capacity result, capture server metrics at the same time.

Backend container CPU/RAM:

```sh
docker stats
```

PostgreSQL active connections:

```sh
docker compose exec postgres psql -U postgres -d ai_travel_planner -c "select state, count(*) from pg_stat_activity group by state;"
```

PostgreSQL slow/active queries:

```sh
docker compose exec postgres psql -U postgres -d ai_travel_planner -c "select now() - query_start as age, state, wait_event_type, wait_event, left(query, 160) from pg_stat_activity where state <> 'idle' order by age desc;"
```

Database size:

```sh
docker compose exec postgres psql -U postgres -d ai_travel_planner -c "select pg_size_pretty(pg_database_size('ai_travel_planner'));"
```

Node.js event-loop lag is not currently exposed by the app. Add a lightweight metrics endpoint or an OpenTelemetry/Prometheus exporter before using event-loop lag as a hard pass/fail gate.

Google Maps latency/failures are currently visible only through API response latency, backend logs, and Google Cloud metrics. For precise attribution, add per-call timing counters around `getRouteFromGoogleRoutesAPI`, `getDirectionsFromGoogleMaps`, and `searchPlacesByText`.

## How To Determine Actual Capacity

For each stage, record:

- active VUs
- RPS
- average, p50, p95, p99 response time
- HTTP error rate
- 4xx and 5xx rate
- itinerary p95
- backend CPU/RAM
- PostgreSQL active connections
- slow queries/waits
- Google Maps errors/latency

Stop increasing load when any condition holds for several minutes:

- normal API p95 exceeds 800 ms
- itinerary p95 exceeds 30 seconds
- HTTP 5xx exceeds 1%
- backend CPU remains above 80%
- memory continuously rises during soak
- PostgreSQL pool remains saturated
- DB wait events or slow queries rise sharply
- Google Maps quota/rate-limit errors appear

Report capacity separately:

- maximum read-heavy users: run with `WORKLOAD_MODE=read`
- maximum auth-heavy users: run with `WORKLOAD_MODE=auth`
- maximum simultaneous itinerary generators: run with `WORKLOAD_MODE=itinerary`
- maximum save throughput: run with `WORKLOAD_MODE=save`
- maximum mixed users: run with `WORKLOAD_MODE=mixed`

Examples:

```sh
BASE_URL=http://localhost:5000 WORKLOAD_MODE=read SUMMARY_FILE=load-tests/results/read-stress-summary.json k6 run load-tests/stress-test.js
BASE_URL=http://localhost:5000 WORKLOAD_MODE=auth SUMMARY_FILE=load-tests/results/auth-stress-summary.json k6 run load-tests/stress-test.js
BASE_URL=http://localhost:5000 WORKLOAD_MODE=itinerary SUMMARY_FILE=load-tests/results/itinerary-stress-summary.json k6 run load-tests/stress-test.js
BASE_URL=http://localhost:5000 WORKLOAD_MODE=mixed SUMMARY_FILE=load-tests/results/mixed-stress-summary.json k6 run load-tests/stress-test.js
```

Do not claim final capacity until the k6 summaries and infrastructure metrics are collected.
