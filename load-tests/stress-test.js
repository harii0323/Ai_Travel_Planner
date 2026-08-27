import { summaryOutput, makeThresholds, TEST_USERS, userForIndex } from './config.js';
import { registerUser } from './scenarios/auth.js';
import { mixedWorkload } from './scenarios/mixed-workload.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.RAMP_100 || '5m', target: 100 },
        { duration: __ENV.HOLD_100 || '10m', target: 100 },
        { duration: __ENV.RAMP_250 || '5m', target: 250 },
        { duration: __ENV.HOLD_250 || '10m', target: 250 },
        { duration: __ENV.RAMP_500 || '5m', target: 500 },
        { duration: __ENV.HOLD_500 || '10m', target: 500 },
        { duration: __ENV.RAMP_750 || '5m', target: 750 },
        { duration: __ENV.HOLD_750 || '10m', target: 750 },
        { duration: __ENV.RAMP_1000 || '5m', target: 1000 },
        { duration: __ENV.HOLD_1000 || '10m', target: 1000 },
        { duration: __ENV.RAMP_DOWN || '5m', target: 0 }
      ],
      gracefulRampDown: '1m'
    }
  },
  thresholds: makeThresholds()
};

export function setup() {
  const count = Math.min(TEST_USERS, Number.parseInt(__ENV.SETUP_USERS || '1100', 10));
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
