import { summaryOutput, makeThresholds, TEST_USERS, userForIndex } from './config.js';
import { registerUser } from './scenarios/auth.js';
import { mixedWorkload } from './scenarios/mixed-workload.js';

export const options = {
  scenarios: {
    normal_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.RAMP_25 || '5m', target: 25 },
        { duration: __ENV.HOLD_25 || '10m', target: 25 },
        { duration: __ENV.RAMP_50 || '5m', target: 50 },
        { duration: __ENV.HOLD_50 || '10m', target: 50 },
        { duration: __ENV.RAMP_100 || '5m', target: 100 },
        { duration: __ENV.HOLD_100 || '15m', target: 100 },
        { duration: __ENV.RAMP_DOWN || '3m', target: 0 }
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: makeThresholds()
};

export function setup() {
  const count = Math.min(TEST_USERS, Number.parseInt(__ENV.SETUP_USERS || '125', 10));
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
