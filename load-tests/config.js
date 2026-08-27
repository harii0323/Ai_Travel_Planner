import { Counter, Rate, Trend } from 'k6/metrics';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
export const TEST_USER_PREFIX = __ENV.TEST_USER_PREFIX || 'loadtest';
export const TEST_USER_DOMAIN = __ENV.TEST_USER_DOMAIN || 'example.test';
export const TEST_RUN_ID = __ENV.TEST_RUN_ID || String(Date.now());
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!';
export const TEST_USERS = Number.parseInt(__ENV.TEST_USERS || '1200', 10);
export const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '60s';
export const WORKLOAD_MODE = (__ENV.WORKLOAD_MODE || 'mixed').toLowerCase();

export const NORMAL_API_P95_MS = Number.parseInt(__ENV.NORMAL_API_P95_MS || '800', 10);
export const ITINERARY_P95_MS = Number.parseInt(__ENV.ITINERARY_P95_MS || '30000', 10);
export const HTTP_5XX_RATE_LIMIT = Number.parseFloat(__ENV.HTTP_5XX_RATE_LIMIT || '0.01');
export const HTTP_ERROR_RATE_LIMIT = Number.parseFloat(__ENV.HTTP_ERROR_RATE_LIMIT || '0.05');

export const metrics = {
  http4xx: new Rate('http_4xx_rate'),
  http5xx: new Rate('http_5xx_rate'),
  timeoutErrors: new Counter('timeout_errors'),
  authLatency: new Trend('auth_latency', true),
  historyLatency: new Trend('history_latency', true),
  itineraryLatency: new Trend('itinerary_latency', true),
  saveLatency: new Trend('save_itinerary_latency', true),
  placesLatency: new Trend('places_latency', true),
  googleBackedItineraryFailures: new Rate('google_backed_itinerary_failures')
};

export function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: REQUEST_TIMEOUT
  };
}

export function jsonHeaders() {
  return {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: REQUEST_TIMEOUT
  };
}

export function recordStatus(res) {
  metrics.http4xx.add(res.status >= 400 && res.status < 500);
  metrics.http5xx.add(res.status >= 500);
}

export function recordTimeout(error) {
  if (!error) return;
  const message = String(error.message || error);
  if (message.toLowerCase().includes('timeout')) {
    metrics.timeoutErrors.add(1);
  }
}

export function jsonValue(res, selector, fallback = undefined) {
  try {
    return res.json(selector);
  } catch (_) {
    return fallback;
  }
}

export function userForIndex(index) {
  const id = Math.max(1, index);
  return {
    name: `Load Test User ${id}`,
    email: `${TEST_USER_PREFIX}-${TEST_RUN_ID}-${id}@${TEST_USER_DOMAIN}`,
    password: TEST_PASSWORD,
    travelCompanionType: id % 4 === 0 ? 'family' : id % 3 === 0 ? 'friends' : 'solo'
  };
}

export function pickUser(users, vu, iteration) {
  if (!users || users.length === 0) {
    return userForIndex(vu || 1);
  }
  const index = Math.abs(((vu || 1) + (iteration || 0)) % users.length);
  return users[index];
}

export function sampleItineraryPayload(seed = 1) {
  const routes = [
    ['Delhi', 'Mumbai'],
    ['Mumbai', 'Bangalore'],
    ['Chennai', 'Bangalore'],
    ['Delhi', 'Kolkata']
  ];
  const [startLocation, destination] = routes[seed % routes.length];

  return {
    budget: seed % 2 === 0 ? 25000 : 18000,
    travelDates: '2026-11-10 to 2026-11-14',
    startLocation,
    destination,
    activities: seed % 3 === 0 ? 'nature,photography,food' : 'cultural,nature,adventure',
    accommodation: seed % 2 === 0 ? 'budgetHotel' : 'hostel',
    transport: seed % 2 === 0 ? 'train' : 'bus',
    travelCompanionType: seed % 4 === 0 ? 'family' : 'solo',
    numberOfTravelers: seed % 4 === 0 ? 4 : 1,
    maxDetourKm: 20,
    minRating: 4.2,
    maxAttractionsPerDay: 2
  };
}

export function sampleSavedItinerary(seed = 1) {
  const payload = sampleItineraryPayload(seed);
  return {
    title: `Load Test Itinerary ${seed}`,
    description: 'Synthetic itinerary saved by k6 load test',
    tags: ['load-test'],
    plannedTravelDate: '2026-11-10',
    itineraryData: {
      summary: {
        destination: payload.destination,
        startDate: '2026-11-10',
        endDate: '2026-11-14',
        totalDays: 5,
        originalBudget: payload.budget,
        withinBudget: true
      },
      details: {
        startLocation: payload.startLocation,
        preferredActivities: payload.activities,
        accommodationType: payload.accommodation,
        transportMode: payload.transport
      },
      estimatedCosts: {
        total: 12500,
        mainTransport: 3500,
        accommodation: 3000,
        food: 2500,
        activities: 1500,
        miscellaneous: 2000
      },
      dayPlans: [
        {
          day: 1,
          date: '2026-11-10',
          location: payload.startLocation,
          activities: ['Start trip']
        }
      ],
      moneyTips: ['Book transport early'],
      recommendations: {}
    }
  };
}

export function makeThresholds(extra = {}) {
  return {
    http_req_failed: [`rate<${HTTP_ERROR_RATE_LIMIT}`],
    http_5xx_rate: [`rate<${HTTP_5XX_RATE_LIMIT}`],
    http_req_duration: [`p(95)<${Number.parseInt(__ENV.GLOBAL_P95_MS || '5000', 10)}`],
    history_latency: [`p(95)<${NORMAL_API_P95_MS}`],
    auth_latency: [`p(95)<${Number.parseInt(__ENV.AUTH_P95_MS || '1500', 10)}`],
    places_latency: [`p(95)<${NORMAL_API_P95_MS}`],
    save_itinerary_latency: [`p(95)<${Number.parseInt(__ENV.SAVE_P95_MS || '1500', 10)}`],
    itinerary_latency: [`p(95)<${ITINERARY_P95_MS}`],
    ...extra
  };
}

export function summaryOutput(data) {
  const file = __ENV.SUMMARY_FILE;
  if (!file) {
    return { stdout: JSON.stringify(data.metrics, null, 2) };
  }
  return {
    stdout: `k6 summary written to ${file}\n`,
    [file]: JSON.stringify(data, null, 2)
  };
}
