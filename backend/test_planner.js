// Test script for enhanced travel planner
const { generateItinerary } = require('./src/services/planner');

async function testPlanner() {
  try {
    console.log('🧪 Testing Enhanced Travel Planner...\n');

    const testData = {
      budget: '15000',
      travelDates: '2024-01-15 to 2024-01-18',
      startLocation: 'Delhi',
      destination: 'Jaipur',
      activities: 'cultural,nature',
      accommodation: 'hostel',
      transport: 'bus',
      numberOfTravelers: 2,
      transportType: 'public',
      vehicleType: null,
      fuelType: null,
      mileage: null
    };

    console.log('📋 Test Input:', JSON.stringify(testData, null, 2));
    console.log('\n⏳ Generating itinerary...\n');

    const result = await generateItinerary(testData);

    if (result.success) {
      console.log('✅ Itinerary generated successfully!\n');

      // Display structured output
      console.log('📌 TRIP OVERVIEW:');
      console.log(`   ${result.tripOverview.startLocation} → ${result.tripOverview.destination}`);
      console.log(`   Distance: ${result.tripOverview.totalDistance} km`);
      console.log(`   Duration: ${result.tripOverview.travelTime}`);
      console.log(`   Days: ${result.tripOverview.numDays}, Travelers: ${result.tripOverview.numTravelers}\n`);

      console.log('🗺️ OPTIMIZED ROUTE:');
      console.log(`   ${result.optimizedRoute.mainRoute}`);
      console.log(`   ${result.optimizedRoute.deviations}`);
      if (result.optimizedRoute.stopsAdded.length > 0) {
        console.log('   Stops:');
        result.optimizedRoute.stopsAdded.forEach(stop => {
          console.log(`     - ${stop.name}: ${stop.reason}`);
        });
      }
      console.log('');

      console.log('🌄 RECOMMENDED PLACES:');
      if (result.recommendedPlaces.length > 0) {
        result.recommendedPlaces.forEach(place => {
          console.log(`   - ${place.name} (${place.type}, ★${place.rating})`);
          console.log(`     ${place.reason}`);
        });
      } else {
        console.log('   No specific places recommended');
      }
      console.log('');

      console.log('💵 BUDGET BREAKDOWN:');
      console.log(`   Transport: ₹${result.budgetBreakdown.transport.cost}`);
      console.log(`   Food: ₹${result.budgetBreakdown.food.totalCost}`);
      console.log(`   Accommodation: ₹${result.budgetBreakdown.accommodation.totalCost}`);
      console.log(`   Activities: ₹${result.budgetBreakdown.activities.totalCost}`);
      console.log(`   Total Estimated: ₹${result.budgetBreakdown.totalEstimatedCost}`);
      console.log(`   Original Budget: ₹${result.budgetBreakdown.originalBudget}`);
      console.log(`   Status: ${result.budgetSuggestions.status}\n`);

      if (result.budgetSuggestions.message) {
        console.log('⚠️  BUDGET MESSAGE:');
        console.log(`   ${result.budgetSuggestions.message}\n`);
      }

      console.log('📅 DAY-WISE ITINERARY:');
      result.dayWiseItinerary.forEach(day => {
        console.log(`   Day ${day.day}:`);
        console.log(`     ${day.plan.replace(/\*\*([^*]+)\*\*/g, '$1')}`);
        console.log('');
      });

    } else {
      console.log('❌ Failed to generate itinerary:', result.error);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error(error.stack);
  }
}

testPlanner();