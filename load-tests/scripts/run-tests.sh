#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:5000}"
RESULTS_DIR="${RESULTS_DIR:-load-tests/results}"
TEST="${1:-smoke}"

mkdir -p "$RESULTS_DIR"

run_k6() {
  name="$1"
  file="$2"
  echo "Running $name against $BASE_URL"
  BASE_URL="$BASE_URL" SUMMARY_FILE="$RESULTS_DIR/$name-summary.json" k6 run "$file"
}

case "$TEST" in
  smoke)
    run_k6 smoke load-tests/smoke-test.js
    ;;
  normal)
    run_k6 normal load-tests/normal-load-test.js
    ;;
  stress)
    run_k6 stress load-tests/stress-test.js
    ;;
  spike)
    run_k6 spike load-tests/spike-test.js
    ;;
  soak)
    run_k6 soak load-tests/soak-test.js
    ;;
  all)
    run_k6 smoke load-tests/smoke-test.js
    run_k6 normal load-tests/normal-load-test.js
    run_k6 stress load-tests/stress-test.js
    run_k6 spike load-tests/spike-test.js
    run_k6 soak load-tests/soak-test.js
    node load-tests/scripts/generate-report.js "$RESULTS_DIR"
    ;;
  *)
    echo "Usage: $0 [smoke|normal|stress|spike|soak|all]"
    exit 1
    ;;
esac
