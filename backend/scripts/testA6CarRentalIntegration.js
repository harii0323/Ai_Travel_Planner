const carRentalService = require('../src/services/carRentalService');

async function testA6CarRental() {
  console.log('🚗 Testing A6 Cars Rental Integration...');

  const searchParams = {
    pickupLocation: 'Chennai',
    dropoffLocation: 'Madurai',
    pickupDate: '2026-11-15',
    pickupTime: '09:00',
    returnDate: '2026-11-18',
    returnTime: '18:00',
    vehicleCategory: 'suv',
    passengers: 4
  };

  console.log('\n1. Searching for vehicles...');
  const searchResult = await carRentalService.searchAvailableCars(searchParams);
  console.log(`   Provider: ${searchResult.provider}`);
  console.log(`   Source: ${searchResult.source}`);
  console.log(`   Total cars: ${searchResult.totalCars} (${searchResult.availableCarsCount} available)`);

  if (!searchResult.vehicles || searchResult.vehicles.length === 0) {
    throw new Error('No vehicles returned from search');
  }

  const selectedVehicle = searchResult.vehicles.find(v => v.availability) || searchResult.vehicles[0];
  console.log(`\n2. Selected Vehicle: ${selectedVehicle.name} (${selectedVehicle.category.toUpperCase()})`);
  console.log(`   Rate: ₹${selectedVehicle.pricePerDay}/day | Total (${selectedVehicle.rentalDays} days): ₹${selectedVehicle.estimatedTotalCost}`);
  console.log(`   Reservation Deposit: ₹${selectedVehicle.reservationDeposit}`);

  console.log('\n3. Creating Reservation Booking...');
  const booking = await carRentalService.createBooking({
    ...searchParams,
    vehicleId: selectedVehicle.id,
    paymentPlan: 'reserve'
  });
  console.log(`   Booking ID: ${booking.bookingId}`);
  console.log(`   Status: ${booking.status}`);
  console.log(`   Amount Due: ₹${booking.amountDue}`);

  console.log('\n4. Simulating Payment Confirmation...');
  const paymentResult = await carRentalService.processPayment({
    bookingId: booking.bookingId,
    paymentMethod: 'upi',
    paymentPlan: 'reserve',
    amount: booking.amountDue
  });
  console.log(`   Success: ${paymentResult.success}`);
  console.log(`   Transaction ID: ${paymentResult.booking.transactionId}`);
  console.log(`   Status: ${paymentResult.booking.status} (${paymentResult.booking.paymentStatus})`);
  console.log(`   Collection PIN: ${paymentResult.booking.collectionPin}`);

  console.log('\n✅ All A6 Cars Rental Integration tests PASSED!');
}

testA6CarRental().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
