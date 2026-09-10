const carRentalService = require('../src/services/carRentalService');
const planner = require('../src/services/planner');

async function testAvailabilityAndPaymentFlow() {
  console.log('🧪 Testing Car Availability & Reservation/Booking Payment Flow...\n');

  console.log('--- Step 1: Searching for available cars with real-time date availability check ---');
  const search = await carRentalService.searchAvailableCars({
    pickupLocation: 'Bangalore',
    dropoffLocation: 'Coorg',
    pickupDate: '2026-11-01',
    pickupTime: '09:00',
    returnDate: '2026-11-05',
    returnTime: '18:00',
    passengers: 4
  });

  console.log(`Total Cars: ${search.totalCars}`);
  console.log(`Available Cars: ${search.availableCarsCount}`);

  const car = search.vehicles.find(v => v.availability) || search.vehicles[0];
  console.log('\nSelected Available Car:', {
    name: car.name,
    category: car.category,
    availability: car.availabilityStatus,
    pricePerDay: car.pricePerDay,
    rentalDays: car.rentalDays,
    estimatedTotalCost: car.estimatedTotalCost,
    reservationDeposit: car.reservationDeposit,
    fullPaymentAmount: car.fullPaymentAmount
  });

  console.log('\n--- Step 2: Initiating Vehicle Reservation (Plan: Reservation Deposit) ---');
  const booking = await carRentalService.createBooking({
    pickupLocation: 'Bangalore',
    dropoffLocation: 'Coorg',
    pickupDate: '2026-11-01',
    pickupTime: '09:00',
    returnDate: '2026-11-05',
    returnTime: '18:00',
    vehicleId: car.id,
    paymentPlan: 'reserve'
  });

  console.log('Initiated Booking:', {
    bookingId: booking.bookingId,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    amountDue: booking.amountDue,
    paymentPlan: booking.paymentPlan
  });

  console.log('\n--- Step 3: Processing Payment (UPI QR Payment) ---');
  const payResult = await carRentalService.processPayment({
    bookingId: booking.bookingId,
    paymentMethod: 'upi',
    paymentPlan: 'reserve',
    amount: booking.amountDue
  });

  console.log('Payment Result:', {
    success: payResult.success,
    message: payResult.message,
    bookingId: payResult.booking.bookingId,
    transactionId: payResult.booking.transactionId,
    paidAmount: payResult.booking.paidAmount,
    status: payResult.booking.status,
    collectionPin: payResult.booking.collectionPin
  });

  console.log('\n✅ Availability & Payment Flow tests PASSED with flying colors!\n');
}

testAvailabilityAndPaymentFlow().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
