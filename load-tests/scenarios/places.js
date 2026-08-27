import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, metrics, recordStatus, recordTimeout, REQUEST_TIMEOUT } from '../config.js';

const queries = ['Delhi', 'Mumbai', 'Bangalore', 'Goa', 'Jaipur', 'Kolkata'];

export function searchPlaces(seed = 1) {
  const q = encodeURIComponent(queries[seed % queries.length]);
  const started = Date.now();

  try {
    const res = http.get(`${BASE_URL}/api/places?q=${q}&limit=25`, { timeout: REQUEST_TIMEOUT });
    metrics.placesLatency.add(Date.now() - started);
    recordStatus(res);
    check(res, { 'places search returned 200': (r) => r.status === 200 });
    return res;
  } catch (error) {
    recordTimeout(error);
    return null;
  }
}

export function placesFlow(seed = 1) {
  return searchPlaces(seed);
}
