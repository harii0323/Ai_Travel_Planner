import { sleep } from 'k6';
import { WORKLOAD_MODE, pickUser } from '../config.js';
import { loginUser, authFlow } from './auth.js';
import { historyFlow } from './history.js';
import { itineraryFlow, saveFlow } from './itinerary.js';
import { placesFlow } from './places.js';

function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getSession(users, vu, iteration) {
  const user = pickUser(users, vu, iteration);
  return loginUser(user);
}

export function mixedWorkload(users) {
  const session = getSession(users, __VU, __ITER);
  if (!session?.token) {
    sleep(1);
    return;
  }

  const roll = randomIntBetween(1, 100);
  const seed = (__VU * 100000) + __ITER;

  if (WORKLOAD_MODE === 'read') {
    if (roll <= 80) historyFlow(session.token);
    else placesFlow(seed);
    sleep(randomIntBetween(1, 3));
    return;
  }

  if (WORKLOAD_MODE === 'auth') {
    authFlow(pickUser(users, __VU, __ITER));
    sleep(randomIntBetween(1, 2));
    return;
  }

  if (WORKLOAD_MODE === 'itinerary') {
    itineraryFlow(session.token, seed);
    sleep(randomIntBetween(1, 3));
    return;
  }

  if (WORKLOAD_MODE === 'save') {
    saveFlow(session.token, seed);
    sleep(randomIntBetween(1, 2));
    return;
  }

  if (roll <= 60) {
    historyFlow(session.token);
  } else if (roll <= 75) {
    itineraryFlow(session.token, seed);
  } else if (roll <= 85) {
    saveFlow(session.token, seed);
  } else if (roll <= 95) {
    authFlow(pickUser(users, __VU, __ITER));
  } else {
    placesFlow(seed);
  }

  sleep(randomIntBetween(1, 3));
}
