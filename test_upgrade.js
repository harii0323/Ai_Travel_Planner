require('./backend/node_modules/dotenv').config({ path: './backend/.env' });
const planner = require('./backend/src/services/planner');

async function testUpgrade() {
  console.log('Testing Advanced AI Travel Planner Upgrade Engine...');
  const input = {
    startLocation: 'Hyderabad',
    destination: 'Kerala',
    travelDates: '2026-10-10 to 2026-10-16',
    numberOfTravelers: 4,
    budget: 50000,
    transportType: 'own',
    transport: 'ownTransport',
    vehicleType: 'car',
    fuelType: 'petrol',
    vehicleMileage: 15,
    preferences: {
      nature: 0.90,
      photography: 0.90,
      beaches: 0.80,
      adventure: 0.70,
      temples: 0.50,
      shopping: 0.20,
      localFood: 0.85,
      wildlife: 0.75
    },
    activities: 'nature,photography,beaches,adventure,temples,wildlife',
    travelStyle: 'standard',
    accommodation: 'budgetHotel'
  };

  const itinerary = await planner.generateItinerary(input);

  console.log('=== 1. SUCCESS STATUS ===', itinerary.success);
  if (!itinerary.success) {
    console.error('FAILED:', itinerary.error);
    return;
  }

  console.log('\n=== 2. TRIP SUMMARY ===');
  console.log(itinerary.tripSummary);

  console.log('\n=== 3. ROUTE SUMMARY ===');
  console.log(itinerary.routeSummary);

  console.log('\n=== 4. COST SUMMARY (ZERO PERCENTAGES) ===');
  console.log(itinerary.costSummary);

  console.log('\n=== 5. PREFERENCE COVERAGE MATRIX ===');
  console.log('Summary Stats:', itinerary.preferenceCoverage?.summaryStats);
  console.log('Matrix items sample:');
  console.table((itinerary.preferenceCoverage?.matrix || []).slice(0, 8));

  console.log('\n=== 6. ROUTE DIVERSITY ===');
  console.log('Outbound Route:', itinerary.routeDiversity?.outboundRoute);
  console.log('Return Route:', itinerary.routeDiversity?.returnRoute);
  console.log('Route Overlap:', itinerary.routeDiversity?.routeOverlap);
  console.log('New Return Experiences:', itinerary.routeDiversity?.newReturnExperiences);
  console.log('Alternative Return Routes Count:', itinerary.routeDiversity?.alternativeReturnRoutes?.length);
  if (itinerary.routeDiversity?.alternativeReturnRoutes) {
    itinerary.routeDiversity.alternativeReturnRoutes.forEach(r => {
      console.log(` - [${r.id}] ${r.title} (${r.distanceKm} km, Overlap: ${r.routeOverlapPercent}%, Highlights: ${r.highlights})`);
    });
  }

  console.log('\n=== 7. VALIDATION CHECKLIST (24 POINTS) ===');
  console.log('Score:', itinerary.validation?.score);
  console.log('Summary:', itinerary.validation?.summary);
  console.log('Check sample (first 6):', itinerary.validation?.checks?.slice(0, 6));

  console.log('\n=== 8. DAY 1 TIMELINE (STRUCTURED TIMELINE WITH REASONS & TIME WINDOWS) ===');
  const day1 = itinerary.dayByDayItinerary?.[0];
  if (day1) {
    console.log(`Day 1: ${day1.phase} (${day1.date})`);
    if (day1.timeline && day1.timeline.length > 0) {
      console.table(day1.timeline.map(t => ({
        Time: t.time,
        Place: t.place,
        Travel: t.travelTime,
        Window: t.bestVisitWindow,
        Cost: t.cost,
        Reason: (t.reason || '').substring(0, 45) + '...'
      })));
    }
  }

  console.log('\n=== 9. MAP ARTIFACTS ===');
  console.log('Outbound POIs:', itinerary.map?.outboundPOIs?.length);
  console.log('Destination POIs:', itinerary.map?.destinationPOIs?.length);
  console.log('Return POIs:', itinerary.map?.returnPOIs?.length);
  console.log('Total Markers:', itinerary.map?.markers?.length);
  console.log('Route Polylines Present:', !!itinerary.map?.routePolylines?.onward);

  console.log('\nTEST COMPLETED SUCCESSFULLY!');
}

testUpgrade().catch(console.error);
