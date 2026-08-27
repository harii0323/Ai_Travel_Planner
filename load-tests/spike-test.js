import { summaryOutput, makeThresholds, TEST_USERS, userForIndex } from './config.js';
import { registerUser } from './scenarios/auth.js';
import { mixedWorkload } from './scenarios/mixed-workload.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.WARMUP || '3m', target: 50 },
        { duration: __ENV.SPIKE_RAMP || '1m', target: 500 },
        { duration: __ENV.SPIKE_HOLD || '5m', target: 500 },
        { duration: __ENV.RECOVERY || '3m', target: 50 },
        { duration: __ENV.RAMP_DOWN || '2m', target: 0 }
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: makeThresholds({
    http_req_failed: [`rate<${Number.parseFloat(__ENV.SPIKE_HTTP_ERROR_RATE_LIMIT || '0.10')}`]
  })
};

export function setup() {
  const count = Math.min(TEST_USERS, Number.parseInt(__ENV.SETUP_USERS || '550', 10));
  const users = [];
  for (let i = 1; i <= count; i += 1) {
    const user = userForIndex(i);
    registerUser(user);
    users.push(user);
  }
  return { users };
}

export default function (data) {
  mixedWorkload(data.users);
}

export function handleSummary(data) {
  return summaryOutput(data);
}
