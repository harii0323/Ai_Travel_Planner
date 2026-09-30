const http = require('http');

function postJSON(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runApiTests() {
  console.log('Testing /api/itinerary/optimize-spatiotemporal ...');
  const res1 = await postJSON('/api/itinerary/optimize-spatiotemporal', {
    origin: 'Mumbai',
    destination: 'Goa',
    travel_date: '2026-10-20',
    start_time: '06:00 AM',
    trip_duration: 3,
    number_of_travelers: 2,
    traveler_type: 'couples',
    travel_mode: 'car',
    preferred_activities: ['nature', 'scenic', 'beaches'],
    optimization_mode: 'BALANCED'
  });
  console.log('Status:', res1.status);
  console.log('Success:', res1.data.success);
  console.log('Mode:', res1.data.data.activeItineraryMode);
  console.log('Pareto Frontier Modes:', res1.data.data.paretoFrontier?.map(p => p.mode));
  console.log('Validation Checklist count:', res1.data.data.validationChecklist?.length);
  console.log('Return Route Plan overlap:', res1.data.data.returnRoutePlan?.routeOverlapRatio);

  console.log('\nTesting /api/itinerary/rolling-horizon-reoptimize ...');
  const res2 = await postJSON('/api/itinerary/rolling-horizon-reoptimize', {
    currentLocation: 'Pune Highway Exit',
    currentTime: '10:30 AM',
    remainingStops: res1.data.data.recommendedPlacesAlongRoute,
    trafficDelayMinutes: 50,
    weatherRiskAlert: null
  });
  console.log('Status:', res2.status);
  console.log('Success:', res2.data.success);
  console.log('Reopt Status:', res2.data.data.reoptimizationStatus);
  console.log('Adjusted ETA Destination:', res2.data.data.adjustedEtaDestination);
  console.log('Preserved Stops:', res2.data.data.reoptimizedStops?.length);

  console.log('\nAPI ENDPOINTS TEST COMPLETE!');
}

runApiTests().catch(console.error);
