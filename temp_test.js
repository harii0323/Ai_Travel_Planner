const planner = require('./backend/src/services/planner');

(async () => {
  const it = await planner.generateItinerary({
    budget: 1000,
    travelDates: '2026-04-01 to 2026-04-05',
    startLocation: 'Delhi',
    destination: 'Mumbai',
    activities: 'cultural',
    accommodation: 'hostel',
    transport: 'bus'
  });

  console.log('estimatedCosts:', JSON.stringify(it.estimatedCosts, null, 2));
  console.log('total sum:', it.estimatedCosts.mainTransport + it.estimatedCosts.accommodation + it.estimatedCosts.food + it.estimatedCosts.activities + it.estimatedCosts.miscellaneous);
})();
