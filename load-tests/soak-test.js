import { summaryOutput, makeThresholds, TEST_USERS, userForIndex } from './config.js';
import { registerUser } from './scenarios/auth.js';
import { mixedWorkload } from './scenarios/mixed-workload.js';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number.parseInt(__ENV.VUS || '100', 10),
      duration: __ENV.DURATION || '45m',
      gracefulStop: '1m'
    }
  },
  thresholds: makeThresholds()
};

export function setup() {
  const count = Math.min(TEST_USERS, Number.parseInt(__ENV.SETUP_USERS || '150', 10));
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
