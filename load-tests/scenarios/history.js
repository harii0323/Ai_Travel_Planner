import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, authHeaders, metrics, recordStatus, recordTimeout } from '../config.js';

export function getHistory(token) {
  const started = Date.now();
  try {
    const res = http.get(`${BASE_URL}/api/history`, authHeaders(token));
    metrics.historyLatency.add(Date.now() - started);
    recordStatus(res);
    check(res, { 'history returned 200': (r) => r.status === 200 });
    return res;
  } catch (error) {
    recordTimeout(error);
    return null;
  }
}

export function historyFlow(token) {
  return getHistory(token);
}
