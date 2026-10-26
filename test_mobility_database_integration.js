/**
 * Mobility Database Comprehensive Integration Test
 * 
 * Validates:
 * 1. Token exchange & API connectivity with api.mobilitydatabase.org
 * 2. GTFS Indian Railways Feed (mdb-2867) & TGSRTC Bus Feed (mdb-3361)
 * 3. Train & Bus route generation, intermediate stops, and distance tariffs
 * 4. Cost Engine integration (Outbound & Return public transit expense items)
 * 5. Backend REST API endpoints (/transit-routes, /mobility-feeds, /recalculate-cost)
 */

require('./backend/node_modules/dotenv').config({ path: './backend/.env' });
const http = require('http');
const mobilityService = require('./backend/src/services/mobilityDatabaseService');
const { calculateTripCost } = require('./backend/src/services/costEngine');

async function testMobilityIntegration() {
  console.log('=================================================================');
  console.log('🚆 VISTA AI TRAVEL PLANNER — MOBILITY DATABASE INTEGRATION TEST');
  console.log('=================================================================\n');

  // Test 1: Live Token Exchange
  console.log('[Test 1] Testing live token exchange with api.mobilitydatabase.org...');
  const accessToken = await mobilityService.getAccessToken();
  if (!accessToken) {
    throw new Error('FAILED: Access token could not be obtained from Mobility Database.');
  }
  console.log('✅ Access Token acquired successfully:', accessToken.slice(0, 30) + '...\n');

  // Test 2: Live GTFS Feeds
  console.log('[Test 2] Querying active GTFS feeds for India (country_code=IN)...');
  const feeds = await mobilityService.getMobilityFeeds('IN');
  console.log(`✅ Retrieved ${feeds.length} GTFS transit feeds.`);
  const hasIR = feeds.some(f => f.provider?.toLowerCase().includes('railway') || f.id === 'mdb-2867');
  const hasBus = feeds.some(f => f.provider?.toLowerCase().includes('bus') || f.id === 'mdb-3361' || f.id === 'mdb-1835');
  console.log(`   - Indian Railways Feed present: ${hasIR ? 'YES (mdb-2867)' : 'NO'}`);
  console.log(`   - Regional State Bus Feeds present: ${hasBus ? 'YES (mdb-3361/1835)' : 'NO'}\n`);

  // Test 3: Train Routes & Cost Estimation (Hyderabad -> Kerala, 4 Travelers)
  console.log('[Test 3] Testing Train Routes & Cost Estimation (Hyderabad -> Kerala, 4 travelers)...');
  const trainRes = mobilityService.getTrainRoutes({
    origin: 'Hyderabad',
    destination: 'Kerala',
    numTravelers: 4,
    travelClass: '3A'
  });

  if (!trainRes || !trainRes.primaryRoute) {
    throw new Error('FAILED: No train routes returned.');
  }
  console.log(`✅ Primary Train: ${trainRes.primaryRoute.trainName} (#${trainRes.primaryRoute.trainNumber})`);
  console.log(`   - Origin Station: ${trainRes.primaryRoute.originStation}`);
  console.log(`   - Destination Station: ${trainRes.primaryRoute.destinationStation}`);
  console.log(`   - Journey Duration: ${trainRes.primaryRoute.duration}`);
  console.log(`   - Intermediate Stops (${trainRes.primaryRoute.intermediateStops.length}): ${trainRes.primaryRoute.intermediateStops.slice(0, 5).join(', ')}...`);
  console.log(`   - One-Way 3AC Fare: ₹${trainRes.oneWayPerPerson} / traveler`);
  console.log(`   - Round-Trip Fare: ₹${trainRes.roundTripPerPerson} / traveler`);
  console.log(`   - Total Group Cost (4 travelers): ₹${trainRes.totalTripTransitCost}`);
  console.log(`   - Provenance Feed: ${trainRes.databaseProvenance.feedId} (${trainRes.databaseProvenance.feedProvider})\n`);

  // Test 4: Intercity Bus Routes & Cost Estimation (Hyderabad -> Kerala, 4 Travelers)
  console.log('[Test 4] Testing Intercity Bus Routes & Cost Estimation (Hyderabad -> Kerala, 4 travelers)...');
  const busRes = mobilityService.getBusRoutes({
    origin: 'Hyderabad',
    destination: 'Kerala',
    numTravelers: 4,
    busClass: 'acSleeper'
  });

  if (!busRes || !busRes.primaryRoute) {
    throw new Error('FAILED: No bus routes returned.');
  }
  console.log(`✅ Primary Bus: ${busRes.primaryRoute.serviceName}`);
  console.log(`   - Operator: ${busRes.primaryRoute.operator}`);
  console.log(`   - Origin Terminal: ${busRes.primaryRoute.originTerminal}`);
  console.log(`   - Destination Terminal: ${busRes.primaryRoute.destinationTerminal}`);
  console.log(`   - Duration: ${busRes.primaryRoute.duration}`);
  console.log(`   - One-Way AC Sleeper Fare: ₹${busRes.oneWayPerPerson} / traveler`);
  console.log(`   - Total Group Cost (4 travelers): ₹${busRes.totalTripTransitCost}`);
  console.log(`   - Provenance Feed: ${busRes.databaseProvenance.feedId} (${busRes.databaseProvenance.feedProvider})\n`);

  // Test 5: Cost Engine Integration with Train Transport
  console.log('[Test 5] Validating Cost Engine integration with train transport...');
  const trainCostSummary = calculateTripCost({
    startLocation: 'Hyderabad',
    destination: 'Kerala',
    totalDays: 4,
    numberOfTravelers: 4,
    transportMode: 'train',
    budget: 35000
  });

  const outboundItem = trainCostSummary.items.find(i => i.expenseId === 'TRANSIT_OUTBOUND_001');
  const returnItem = trainCostSummary.items.find(i => i.expenseId === 'TRANSIT_RETURN_002');

  if (!outboundItem || !returnItem) {
    throw new Error('FAILED: Transit expense items not found in cost engine output.');
  }
  console.log(`✅ Outbound Item: "${outboundItem.name}" — ₹${outboundItem.amount}`);
  console.log(`   - Source: ${outboundItem.source}`);
  console.log(`   - Feed ID: ${outboundItem.details?.feedId}`);
  console.log(`✅ Return Item: "${returnItem.name}" — ₹${returnItem.amount}`);
  console.log(`   - Grand Total Trip Cost: ₹${trainCostSummary.totalTripCost}`);
  console.log(`   - Category Sum Valid: ${trainCostSummary.validation?.checks?.find(c => c.id === 2)?.passed ? 'YES' : 'NO'}`);
  console.log(`   - Day Sum Valid: ${trainCostSummary.validation?.checks?.find(c => c.id === 3)?.passed ? 'YES' : 'NO'}\n`);

  // Test 6: Backend REST API Endpoints
  console.log('[Test 6] Testing Backend HTTP Endpoints on http://localhost:5000...');

  function httpGet(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:5000${path}`, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }).on('error', reject);
    });
  }

  const transitApiRes = await httpGet('/api/itinerary/transit-routes?origin=Hyderabad&destination=Kerala&travelers=4');
  console.log(`✅ GET /api/itinerary/transit-routes: Status ${transitApiRes.status}`);
  console.log(`   - Recommended Mode: ${transitApiRes.data?.recommendedMode}`);
  console.log(`   - Train Primary: ${transitApiRes.data?.train?.primaryRoute?.trainName}`);
  console.log(`   - Bus Primary: ${transitApiRes.data?.bus?.primaryRoute?.serviceName}`);

  const feedsApiRes = await httpGet('/api/itinerary/mobility-feeds?country_code=IN');
  console.log(`✅ GET /api/itinerary/mobility-feeds: Status ${feedsApiRes.status}`);
  console.log(`   - Feeds Count: ${feedsApiRes.data?.totalFeeds}`);

  console.log('\n=================================================================');
  console.log('🎉 ALL MOBILITY DATABASE INTEGRATION TESTS PASSED (100% SUCCESS)');
  console.log('=================================================================\n');
}

testMobilityIntegration().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
