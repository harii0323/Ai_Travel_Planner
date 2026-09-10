const realTimePricingService = require('../src/services/realTimePricingService');

async function testRealTimePricing() {
  console.log('📊 Testing Real-Time Pricing Service...\n');

  console.log('1. Live Fuel Prices across major hubs:');
  const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Goa'];
  for (const city of cities) {
    const petrol = realTimePricingService.getLiveFuelPrice(city, 'petrol');
    const diesel = realTimePricingService.getLiveFuelPrice(city, 'diesel');
    console.log(`   - ${city}: Petrol ₹${petrol.price}/L, Diesel ₹${diesel.price}/L (${petrol.source})`);
  }

  console.log('\n2. Live Accommodation Rates for Ooty (3 Nights):');
  const hotelRate = await realTimePricingService.getLiveAccommodationRate('Ooty', 'budgetHotel', '2026-10-15', 2);
  console.log(`   - Type: ${hotelRate.label}`);
  console.log(`   - Price Per Night: ₹${hotelRate.pricePerNight}`);
  console.log(`   - Source: ${hotelRate.source}`);

  console.log('\n3. Real-Time Trip Cost Computation (Bangalore to Ooty, 3 Days, 2 Travelers):');
  const tripCost = await realTimePricingService.computeRealTimeTripCost({
    startLocation: 'Bangalore',
    destination: 'Ooty',
    distanceKm: 275,
    numberOfDays: 3,
    numberOfTravelers: 2,
    transportMode: 'car',
    fuelType: 'petrol',
    vehicleMileage: 15,
    accommodationType: 'budgetHotel',
    scheduledPlaces: [
      { name: 'Ooty Botanical Gardens', rawName: 'Botanical Gardens', cost: 50 },
      { name: 'Doddabetta Peak', rawName: 'Doddabetta Peak', cost: 30 }
    ]
  });

  console.log(`   - Grand Total Trip Cost: ₹${tripCost.summary.grandTotal}`);
  console.log(`   - Per Person Total: ₹${tripCost.summary.perPersonTotal}`);
  console.log(`   - Transport: ₹${tripCost.breakdown.transport.totalTransportCost}`);
  console.log(`   - Accommodation: ₹${tripCost.breakdown.accommodation.totalCost}`);
  console.log(`   - Food: ₹${tripCost.breakdown.food.totalFoodCost}`);
  console.log(`   - Activities: ₹${tripCost.breakdown.activities.totalCost}`);
  console.log(`   - Misc Buffer (10%): ₹${tripCost.breakdown.miscellaneous.totalCost}`);

  console.log('\n✅ Real-Time Pricing tests PASSED!');
}

testRealTimePricing().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
