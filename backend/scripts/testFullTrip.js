const planner = require('../src/services/planner');

async function testFullTrip() {
  console.log('Testing full planner.generateItinerary with dynamic planner integration...');
  const itinerary = await planner.generateItinerary({
    budget: 15000,
    travelDates: '2026-09-01 to 2026-09-04',
    startLocation: 'Mumbai',
    destination: 'Goa',
    activities: 'beach,culture,food,adventure',
    accommodation: 'hostel',
    transport: 'bus',
    numberOfTravelers: 2,
    travelCompanionType: 'friends'
  });

  console.log('Itinerary summary:', {
    totalDays: itinerary.summary.totalDays,
    destination: itinerary.summary.destination,
    estimatedCost: itinerary.estimatedCosts.total,
    withinBudget: itinerary.summary.withinBudget,
    dayPlansCount: itinerary.dayPlans.length
  });

  itinerary.dayPlans.forEach((dp) => {
    console.log(`\nDay ${dp.day} [${dp.phase}]:`);
    if (dp.activities && dp.activities.length > 0) {
      console.log('  Activities:');
      dp.activities.forEach((act) => console.log(`    - ${act.name || act.rawName} (₹${act.cost || 0})`));
    }
  });

  console.log('\n✅ Full trip integration test completed successfully!');
}

testFullTrip().catch(console.error);
