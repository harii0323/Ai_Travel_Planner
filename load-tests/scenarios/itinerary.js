import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  authHeaders,
  metrics,
  recordStatus,
  recordTimeout,
  jsonValue,
  sampleItineraryPayload,
  sampleSavedItinerary
} from '../config.js';

export function generateItinerary(token, seed = 1) {
  const started = Date.now();
  try {
    const res = http.post(
      `${BASE_URL}/api/itinerary/generate`,
      JSON.stringify(sampleItineraryPayload(seed)),
      authHeaders(token)
    );

    metrics.itineraryLatency.add(Date.now() - started);
    recordStatus(res);

    const ok = check(res, {
      'itinerary generate returned 200': (r) => r.status === 200,
      'itinerary body has success': (r) => jsonValue(r, 'success') === true
    });

    const routeSource = jsonValue(res, 'itinerary.metadata.routeSource');
    const error = jsonValue(res, 'itinerary.error');
    metrics.googleBackedItineraryFailures.add(Boolean(routeSource && error));

    return ok ? jsonValue(res, 'itinerary', null) : null;
  } catch (error) {
    recordTimeout(error);
    metrics.googleBackedItineraryFailures.add(true);
    return null;
  }
}

export function saveItinerary(token, seed = 1, itinerary = null) {
  const started = Date.now();
  const body = sampleSavedItinerary(seed);

  if (itinerary?.summary && itinerary?.details && itinerary?.estimatedCosts) {
    body.itineraryData = itinerary;
  }

  try {
    const res = http.post(`${BASE_URL}/api/itinerary/save`, JSON.stringify(body), authHeaders(token));
    metrics.saveLatency.add(Date.now() - started);
    recordStatus(res);
    check(res, { 'itinerary save returned 201': (r) => r.status === 201 });
    return res;
  } catch (error) {
    recordTimeout(error);
    return null;
  }
}

export function itineraryFlow(token, seed = 1) {
  return generateItinerary(token, seed);
}

export function saveFlow(token, seed = 1) {
  return saveItinerary(token, seed);
}
