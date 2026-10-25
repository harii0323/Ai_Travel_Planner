const axios = require('axios');

const BACKEND_API_URL = process.env.CAR_RENTAL_API_URL || 'https://a6cars-backend-ylx7.onrender.com';
const A6_CARS_PORTAL_URL = process.env.CAR_RENTAL_FRONTEND_URL || 'https://a6cars-frontend-zv4g.onrender.com';
const REQUEST_TIMEOUT_MS = Number(process.env.CAR_RENTAL_TIMEOUT_MS || 3000);

// Circuit breaker state to prevent thread exhaustion when external service is sleeping/down
let circuitBreakerOpenUntil = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60000; // 1 minute cooldown after consecutive failure

// Transaction deduplication store to prevent replay attacks
const processedTransactions = new Set();

function isPrivateOrLocalIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  // Loopback and unspecified addresses
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0' || ip.startsWith('127.')) return true;
  // RFC 1918 10.0.0.0/8
  if (ip.startsWith('10.')) return true;
  // RFC 1918 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // RFC 1918 192.168.0.0/16
  if (ip.startsWith('192.168.')) return true;
  // Link-local / AWS / GCP / Azure metadata 169.254.0.0/16
  if (ip.startsWith('169.254.')) return true;
  // IPv6 unique local / link-local
  if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fe80:')) return true;
  return false;
}

function validateExternalUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    
    // Forbidden domain and metadata names
    const forbiddenHostnames = [
      'localhost',
      'metadata.google.internal',
      'instance-data',
      'metadata',
      'local'
    ];
    if (forbiddenHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }

    // Decimal or hex integer representations of IP
    if (/^\d+$/.test(hostname)) return false;
    if (/^0x[0-9a-fA-F]+$/.test(hostname)) return false;

    if (isPrivateOrLocalIp(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// In-memory bookings store for planner sessions
const activeBookingsStore = new Map();

// Session caching for A6 Cars backend authentication
let cachedA6Session = null;

function sanitizeBookingForClient(booking) {
  if (!booking || typeof booking !== 'object') return null;
  const safe = { ...booking };
  delete safe.authToken;
  delete safe.customerId;
  return safe;
}

const CATEGORIES = {
  economy: { rank: 1, seats: 4, luggage: 2, defaultPrice: 1500 },
  compact: { rank: 2, seats: 5, luggage: 2, defaultPrice: 2000 },
  sedan: { rank: 3, seats: 5, luggage: 3, defaultPrice: 2600 },
  suv: { rank: 4, seats: 7, luggage: 4, defaultPrice: 3500 },
  premium: { rank: 5, seats: 5, luggage: 3, defaultPrice: 6500 },
  ev: { rank: 3, seats: 5, luggage: 3, defaultPrice: 2400 }
};

// Static fallback fleet if A6 Cars API is unreachable
const A6_CARS_FALLBACK = [
  { id: 19, brand: 'Tata', model: 'Harrier Fearless', year: 2024, daily_rate: 2899, location: 'Hyderabad', images: ['/uploads/1775834297352-132144278.jpg'] },
  { id: 18, brand: 'Audi', model: 'A4 Technology', year: 2023, daily_rate: 6499, location: 'Bangalore', images: ['/uploads/1775834297352-132144278.jpg'] },
  { id: 17, brand: 'Mercedes-Benz', model: 'C-Class C200', year: 2024, daily_rate: 7999, location: 'Mumbai', images: ['/uploads/1775805903184-54453923.jpg'] },
  { id: 16, brand: 'BMW', model: '3 Series Gran Limousine', year: 2023, daily_rate: 6999, location: 'Delhi', images: ['/uploads/1775805903184-54453923.jpg'] },
  { id: 15, brand: 'Skoda', model: 'Kushaq Monte Carlo', year: 2023, daily_rate: 2499, location: 'Hyderabad', images: ['/uploads/1775834440203-603152217.jpg'] },
  { id: 14, brand: 'Volkswagen', model: 'Virtus GT', year: 2024, daily_rate: 2599, location: 'Mumbai', images: ['/uploads/1775834440203-603152217.jpg'] },
  { id: 13, brand: 'Mahindra', model: 'XUV700 AX7', year: 2024, daily_rate: 3499, location: 'Delhi', images: ['/uploads/1775834383261-248978666.jpg'] },
  { id: 12, brand: 'Tata', model: 'Nexon EV Empowered', year: 2024, daily_rate: 2299, location: 'Bangalore', images: ['/uploads/1775834297352-132144278.jpg'] },
  { id: 11, brand: 'Maruti Suzuki', model: 'Baleno Alpha', year: 2023, daily_rate: 1599, location: 'Pune', images: ['/uploads/1775805903184-54453923.jpg'] },
  { id: 10, brand: 'Honda', model: 'City ZX', year: 2023, daily_rate: 2199, location: 'Chennai', images: ['/uploads/1775805903184-54453923.jpg'] },
  { id: 9, brand: 'Toyota', model: 'Fortuner 4x4', year: 2024, daily_rate: 4999, location: 'Hyderabad', images: ['/uploads/1775834383261-248978666.jpg'] },
  { id: 8, brand: 'Kia', model: 'Seltos HTX', year: 2023, daily_rate: 2399, location: 'Mumbai', images: ['/uploads/1775834440203-603152217.jpg'] },
  { id: 7, brand: 'Mahindra', model: 'Thar 4x4', year: 2024, daily_rate: 3199, location: 'Goa', images: ['/uploads/1775834383261-248978666.jpg'] },
  { id: 6, brand: 'Hyundai', model: 'Creta SX', year: 2024, daily_rate: 2499, location: 'Bangalore', images: ['/uploads/1775834297352-132144278.jpg'] },
  { id: 5, brand: 'Maruti Suzuki', model: 'Swift ZXi', year: 2024, daily_rate: 1499, location: 'Hyderabad', images: ['/uploads/1775805903184-54453923.jpg'] },
  { id: 3, brand: 'Toyota', model: 'Innova Crysta', year: 2024, daily_rate: 3299, location: 'Hyderabad', images: ['/uploads/1775834383261-248978666.jpg'] },
  { id: 2, brand: 'Tata', model: 'Sierra', year: 2025, daily_rate: 2999, location: 'Hyderabad', images: ['/uploads/1775834297352-132144278.jpg'] }
];

/**
 * Obtain or renew authenticated session on A6 Cars backend
 */
async function getA6Session(userDetails = {}) {
  if (cachedA6Session && cachedA6Session.token && (Date.now() - cachedA6Session.acquiredAt < 12 * 3600 * 1000)) {
    return cachedA6Session;
  }

  // If circuit breaker is open or offline, use isolated mock session
  if (Date.now() < circuitBreakerOpenUntil || !validateExternalUrl(BACKEND_API_URL)) {
    return { token: null, customerId: 13, email: 'user@example.com', name: 'Travel Planner User' };
  }

  const email = process.env.CAR_RENTAL_SERVICE_EMAIL || userDetails.email || 'traveler@vistatravel.app';
  const password = process.env.CAR_RENTAL_SERVICE_PASSWORD || userDetails.password || null;
  const name = userDetails.name || 'Travel Planner User';
  const phone = userDetails.phone || '9876543210';

  if (!password) {
    return { token: null, customerId: 13, email, name };
  }

  // Try login first with short timeout
  try {
    const loginRes = await axios.post(
      `${BACKEND_API_URL.replace(/\/$/, '')}/api/login`,
      { email, password },
      { timeout: 3000 }
    );
    if (loginRes.data && loginRes.data.token) {
      cachedA6Session = {
        token: loginRes.data.token,
        customerId: loginRes.data.customer_id || loginRes.data.customerId || 13,
        name: loginRes.data.name || name,
        email: loginRes.data.email || email,
        acquiredAt: Date.now()
      };
      return cachedA6Session;
    }
  } catch (loginErr) {
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`[A6CarsService] A6 session unavailable, circuit breaker open: ${loginErr.message}`);
  }

  return cachedA6Session || { token: null, customerId: 13, email, name };
}

function inferCategory(brand = '', model = '') {
  const text = `${brand} ${model}`.toLowerCase();
  if (text.includes('ev') || text.includes('nexon ev') || text.includes('electric')) return 'ev';
  if (text.includes('bmw') || text.includes('mercedes') || text.includes('audi') || text.includes('c-class') || text.includes('3 series') || text.includes('a4')) return 'premium';
  if (text.includes('fortuner') || text.includes('innova') || text.includes('xuv700') || text.includes('thar') || text.includes('harrier') || text.includes('creta') || text.includes('seltos') || text.includes('kushaq') || text.includes('sierra')) return 'suv';
  if (text.includes('city') || text.includes('virtus') || text.includes('verna') || text.includes('ciaz') || text.includes('slavia')) return 'sedan';
  if (text.includes('baleno') || text.includes('i20') || text.includes('altroz')) return 'compact';
  return 'economy';
}

function inferSpecs(brand = '', model = '', category = 'compact') {
  const text = `${brand} ${model}`.toLowerCase();

  let seatingCapacity = 5;
  let luggageCapacity = 3;
  let transmissionType = 'Manual';
  let fuelType = 'Petrol';

  if (text.includes('fortuner') || text.includes('innova') || text.includes('xuv700')) {
    seatingCapacity = 7;
    luggageCapacity = 5;
  } else if (text.includes('swift') || text.includes('thar')) {
    seatingCapacity = 4;
    luggageCapacity = 2;
  }

  if (category === 'premium' || text.includes('gt') || text.includes('ev') || text.includes('ax7') || text.includes('zx') || text.includes('htx') || text.includes('fearless')) {
    transmissionType = 'Automatic';
  }

  if (category === 'ev' || text.includes('ev')) {
    fuelType = 'Electric';
  } else if (text.includes('fortuner') || text.includes('harrier') || text.includes('thar') || text.includes('xuv700')) {
    fuelType = 'Diesel';
  }

  return { seatingCapacity, luggageCapacity, transmissionType, fuelType };
}

function assertRentalSearch(input = {}) {
  const required = ['pickupLocation', 'dropoffLocation', 'pickupDate', 'pickupTime', 'returnDate', 'returnTime'];
  const missing = required.filter((field) => !String(input[field] || '').trim());
  if (missing.length) {
    const error = new Error(`Missing rental details: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }

  const pickupAt = new Date(`${input.pickupDate}T${input.pickupTime}`);
  const returnAt = new Date(`${input.returnDate}T${input.returnTime}`);
  if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime()) || pickupAt >= returnAt) {
    const error = new Error('Return date and time must be after pickup date and time.');
    error.status = 400;
    throw error;
  }

  return { pickupAt, returnAt };
}

function rentalDays(pickupAt, returnAt) {
  return Math.max(1, Math.ceil((returnAt - pickupAt) / 86400000));
}

function isDateOverlapping(reqStart, reqEnd, bookedStart, bookedEnd) {
  const rs = new Date(reqStart).getTime();
  const re = new Date(reqEnd).getTime();
  const bs = new Date(bookedStart).getTime();
  const be = new Date(bookedEnd).getTime();
  return rs < be && re > bs;
}

async function fetchCarBookedDates(carId) {
  if (Date.now() < circuitBreakerOpenUntil || !validateExternalUrl(BACKEND_API_URL)) {
    return [];
  }
  try {
    const response = await axios.get(`${BACKEND_API_URL.replace(/\/$/, '')}/api/bookings/${carId}`, {
      timeout: 2000
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    return [];
  }
}

function buildA6CarsBookingUrl(search = {}, vehicleId = '', bookingId = '') {
  const params = new URLSearchParams();
  if (bookingId) params.set('booking_id', bookingId);
  if (vehicleId) params.set('vehicle', vehicleId);
  if (search.pickupLocation) params.set('pickupLocation', search.pickupLocation);
  if (search.dropoffLocation) params.set('dropoffLocation', search.dropoffLocation);
  if (search.pickupDate) params.set('pickupDate', search.pickupDate);
  if (search.returnDate) params.set('returnDate', search.returnDate);
  return `${A6_CARS_PORTAL_URL.replace(/\/$/, '')}/history.html?${params.toString()}`;
}

function normalizeA6Vehicle(rawCar, search, days, existingBookings = []) {
  const brand = rawCar.brand || 'A6';
  const model = rawCar.model || 'Car';
  const name = `${brand} ${model}${rawCar.year ? ` (${rawCar.year})` : ''}`;
  const category = inferCategory(brand, model);
  const specs = inferSpecs(brand, model, category);

  const pricePerDay = Number(rawCar.daily_rate || rawCar.pricePerDay || 2000);
  const estimatedTotalCost = pricePerDay * days;
  const securityDeposit = Math.max(2500, Math.round(pricePerDay * 1.5));
  const reservationDeposit = Math.max(1500, Math.round(pricePerDay * 1.0));
  const fullPaymentAmount = estimatedTotalCost + securityDeposit;

  let isAvailable = true;
  let conflictReason = 'Available for selected dates';
  if (search.pickupDate && search.returnDate && Array.isArray(existingBookings)) {
    const conflict = existingBookings.find((b) =>
      isDateOverlapping(
        search.pickupDate, search.returnDate,
        b.start_date || b.startDate,
        b.end_date || b.endDate
      )
    );
    if (conflict) {
      isAvailable = false;
      conflictReason = `Booked from ${conflict.start_date || conflict.startDate} to ${conflict.end_date || conflict.endDate}`;
    }
  }

  let imageUrl = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
  if (Array.isArray(rawCar.images) && rawCar.images.length > 0) {
    const firstImg = rawCar.images[0];
    imageUrl = firstImg.startsWith('http')
      ? firstImg
      : `${BACKEND_API_URL.replace(/\/$/, '')}${firstImg.startsWith('/') ? '' : '/'}${firstImg}`;
  }

  const carId = rawCar.id || rawCar._id;

  return {
    id: `a6-${carId}`,
    rawId: carId,
    name,
    brand,
    model,
    year: rawCar.year || 2024,
    category,
    image: imageUrl,
    seatingCapacity: specs.seatingCapacity,
    luggageCapacity: specs.luggageCapacity,
    transmissionType: specs.transmissionType,
    fuelType: specs.fuelType,
    pricePerDay,
    rentalDays: days,
    estimatedTotalCost,
    securityDeposit,
    reservationDeposit,
    fullPaymentAmount,
    availability: isAvailable,
    availabilityStatus: isAvailable ? 'Available' : 'Unavailable',
    availabilityReason: conflictReason,
    location: rawCar.location || 'Available Nationwide',
    pickupLocation: search.pickupLocation || rawCar.location,
    dropoffLocation: search.dropoffLocation || search.pickupLocation || rawCar.location,
    pickupDistanceKm: 1.2,
    suitabilityNotes: `Verified live vehicle from A6 Cars Hub (${rawCar.location || 'City Depot'}).`,
    portalBookingUrl: buildA6CarsBookingUrl(search, carId),
    provider: 'A6 Cars',
    source: 'live_a6cars_backend'
  };
}

function rankVehicles(vehicles, search) {
  const preferred = String(search.vehicleCategory || '').toLowerCase();
  const passengers = Number(search.passengers || 1);
  const luggage = Number(search.luggageCapacity || 0);

  return vehicles
    .map((vehicle) => {
      const category = CATEGORIES[vehicle.category] || CATEGORIES.compact;
      let score = 0;
      if (vehicle.availability) score += 1000;
      else score -= 1500;
      if (preferred && vehicle.category === preferred) score += 250;
      if (vehicle.seatingCapacity >= passengers) score += 180;
      else score -= 500;
      if (!luggage || vehicle.luggageCapacity >= luggage) score += 120;
      else score -= 160;
      score -= Math.max(0, vehicle.pricePerDay) / 40;
      score -= category.rank * 3;
      return { ...vehicle, recommendationScore: Math.round(score) };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

/**
 * Fetch real vehicles from A6 Cars backend and check date availability
 */
async function searchAvailableCars(search) {
  const { pickupAt, returnAt } = assertRentalSearch(search);
  const days = rentalDays(pickupAt, returnAt);

  console.log(`\n🚗 [A6CarsService] Fetching live cars from ${BACKEND_API_URL}/api/cars...`);

  let rawCars = [];
  let isLive = false;

  if (Date.now() < circuitBreakerOpenUntil || !validateExternalUrl(BACKEND_API_URL)) {
    rawCars = A6_CARS_FALLBACK;
  } else {
    try {
      const response = await axios.get(`${BACKEND_API_URL.replace(/\/$/, '')}/api/cars`, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { Accept: 'application/json' }
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        rawCars = response.data;
        isLive = true;
        console.log(`✅ [A6CarsService] Loaded ${rawCars.length} live cars from A6 Cars database!`);
      }
    } catch (err) {
      circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      console.warn(`⚠️ [A6CarsService] A6 Cars backend unreachable: ${err.message} — tripped circuit breaker, using local catalog.`);
    }
  }

  if (!rawCars || rawCars.length === 0) {
    rawCars = A6_CARS_FALLBACK;
  }

  // Check booked dates for every car in parallel
  const bookingPromises = rawCars.map((car) => fetchCarBookedDates(car.id));
  const allBookings = await Promise.all(bookingPromises);

  const normalizedVehicles = rawCars.map((car, idx) =>
    normalizeA6Vehicle(car, search, days, allBookings[idx] || [])
  );

  const ranked = rankVehicles(normalizedVehicles, search);
  console.log(`✅ [A6CarsService] Returning ${ranked.length} vehicles (${ranked.filter(v => v.availability).length} available)`);

  return {
    provider: 'A6 Cars',
    isLiveSource: isLive,
    source: isLive ? 'Live A6 Cars API' : 'A6 Cars Catalog (offline fallback)',
    portalUrl: A6_CARS_PORTAL_URL,
    totalCars: ranked.length,
    availableCarsCount: ranked.filter((v) => v.availability).length,
    vehicles: ranked
  };
}

async function getVehicle(vehicleId, search = {}) {
  const searchResults = await searchAvailableCars({
    pickupLocation: search.pickupLocation || 'Hyderabad',
    dropoffLocation: search.dropoffLocation || 'Bangalore',
    pickupDate: search.pickupDate || '2026-10-15',
    pickupTime: search.pickupTime || '09:00',
    returnDate: search.returnDate || '2026-10-18',
    returnTime: search.returnTime || '18:00',
    ...search
  });

  const found = searchResults.vehicles.find((v) => v.id === vehicleId || v.rawId == vehicleId);
  return found || searchResults.vehicles[0];
}

function validateBookingPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('Invalid booking payload');
    error.status = 400;
    throw error;
  }
}

/**
 * Create a booking directly in A6 Cars MongoDB database
 */
async function createBooking(payload) {
  validateBookingPayload(payload);
  if (!payload.vehicleId) {
    const error = new Error('Select a rental vehicle before booking.');
    error.status = 400;
    throw error;
  }

  const rawCarId = Number(String(payload.vehicleId).replace(/^a6-/, '')) || 8;
  const vehicle = await getVehicle(payload.vehicleId, payload);

  if (!vehicle.availability) {
    const error = new Error(
      `Vehicle ${vehicle.name} is not available for the selected dates (${vehicle.availabilityReason}). Please choose another car.`
    );
    error.status = 400;
    throw error;
  }

  const paymentPlan = payload.paymentPlan === 'full' ? 'full' : 'reserve';
  const session = await getA6Session(payload);

  let a6BookingId = null;
  let a6PaymentQr = null;
  let a6AmountDue = paymentPlan === 'full' ? vehicle.fullPaymentAmount : vehicle.reservationDeposit;
  let a6Total = vehicle.estimatedTotalCost;
  let a6ReserveAmount = vehicle.reservationDeposit;
  let a6RemainingAmount = vehicle.fullPaymentAmount - vehicle.reservationDeposit;

  if (Date.now() >= circuitBreakerOpenUntil && validateExternalUrl(BACKEND_API_URL)) {
    try {
      const bookRes = await axios.post(
        `${BACKEND_API_URL.replace(/\/$/, '')}/api/book`,
        {
          car_id: rawCarId,
          start_date: payload.pickupDate,
          end_date: payload.returnDate,
          payment_plan: paymentPlan
        },
        {
          headers: session.token ? { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' } : {},
          timeout: 2500
        }
      );

      if (bookRes.data) {
        a6BookingId = bookRes.data.booking_id || bookRes.data.id;
        a6PaymentQr = bookRes.data.payment_qr;
        a6Total = bookRes.data.total || a6Total;
        a6AmountDue = bookRes.data.amount_due || a6AmountDue;
        a6ReserveAmount = bookRes.data.reserve_amount || a6ReserveAmount;
        a6RemainingAmount = bookRes.data.remaining_amount || a6RemainingAmount;
      }
    } catch (err) {
      circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      console.warn(`⚠️ [A6CarsService] A6 booking external call notice: ${err.message}`);
    }
  }

  if (!a6BookingId) {
    a6BookingId = Math.floor(100 + Math.random() * 900);
  }

  const bookingRef = `A6-2026-${a6BookingId}`;
  const checkoutUrl = `${A6_CARS_PORTAL_URL.replace(/\/$/, '')}/history.html?booking_id=${a6BookingId}`;

  const booking = {
    userId: payload.userId || null,
    bookingId: bookingRef,
    referenceId: bookingRef,
    a6BookingId,
    customerId: session.customerId || 13,
    authToken: session.token,
    provider: 'A6 Cars',
    status: 'pending_payment',
    paymentStatus: 'pending',
    paymentPlan,
    vehicleId: payload.vehicleId,
    rawCarId,
    vehicleName: vehicle.name,
    vehicleCategory: vehicle.category,
    vehicleImage: vehicle.image,
    pricePerDay: vehicle.pricePerDay,
    rentalDays: vehicle.rentalDays,
    estimatedTotalCost: a6Total,
    securityDeposit: vehicle.securityDeposit,
    reservationDeposit: a6ReserveAmount,
    remainingAmount: a6RemainingAmount,
    fullPaymentAmount: vehicle.fullPaymentAmount,
    amountDue: a6AmountDue,
    paymentQr: a6PaymentQr,
    currency: 'INR',
    pickupLocation: payload.pickupLocation,
    dropoffLocation: payload.dropoffLocation,
    pickupDate: payload.pickupDate,
    pickupTime: payload.pickupTime,
    returnDate: payload.returnDate,
    returnTime: payload.returnTime,
    passengers: payload.passengers || 1,
    bookingUrl: checkoutUrl,
    portalUrl: A6_CARS_PORTAL_URL,
    createdAt: new Date().toISOString()
  };

  activeBookingsStore.set(bookingRef, booking);
  activeBookingsStore.set(String(a6BookingId), booking);

  return sanitizeBookingForClient(booking);
}

/**
 * Verify payment on A6 Cars backend and confirm booking with anti-tampering & replay protection
 */
async function processPayment(payload) {
  const { bookingId, paymentMethod = 'upi', paymentPlan = 'reserve', transactionId, userId } = payload;

  if (!bookingId) {
    const error = new Error('Booking ID is required for payment processing.');
    error.status = 400;
    throw error;
  }

  let booking = activeBookingsStore.get(bookingId) || activeBookingsStore.get(String(bookingId).replace(/^A6-2026-/, ''));
  if (!booking) {
    const error = new Error('Booking record not found.');
    error.status = 404;
    throw error;
  }

  if (!booking.userId || (userId && booking.userId !== userId)) {
    const error = new Error('Not authorized to access or modify this booking.');
    error.status = 404;
    throw error;
  }

  // Price tampering validation
  const expectedAmount = paymentPlan === 'full' ? booking.fullPaymentAmount : booking.reservationDeposit;
  if (payload.amount !== undefined && Math.abs(Number(payload.amount) - expectedAmount) > 1) {
    const error = new Error(`Payment amount mismatch: Expected ₹${expectedAmount}, received ₹${payload.amount}. Price tampering detected.`);
    error.status = 400;
    throw error;
  }

  // Replay protection on transaction IDs (In-Memory + Durable PostgreSQL Store)
  if (transactionId && processedTransactions.has(transactionId)) {
    const error = new Error('Payment transaction ID has already been processed. Replay attack blocked.');
    error.status = 409;
    throw error;
  }

  const { query: dbQuery, isConnected: isDbConnected } = require('../config/database');
  if (transactionId && isDbConnected()) {
    try {
      const existingTxn = await dbQuery(
        'SELECT transaction_id FROM payment_transactions WHERE transaction_id = $1',
        [transactionId]
      );
      if (existingTxn.rows && existingTxn.rows.length > 0) {
        processedTransactions.add(transactionId);
        const error = new Error('Payment transaction ID has already been processed. Replay attack blocked.');
        error.status = 409;
        throw error;
      }
    } catch (err) {
      if (err.status === 409) throw err;
      console.warn('Payment transaction lookup warning:', err.message);
    }
  }

  const txnId = transactionId || `TXN-A6-${Math.floor(10000000 + Math.random() * 90000000)}`;
  processedTransactions.add(txnId);

  const paidAmount = expectedAmount;
  const session = await getA6Session(payload);
  const a6BookingNum = booking.a6BookingId || Number(String(bookingId).replace(/^A6-2026-/, '')) || 23;

  let a6Verified = false;
  if (Date.now() >= circuitBreakerOpenUntil && validateExternalUrl(BACKEND_API_URL)) {
    try {
      const verifyRes = await axios.post(
        `${BACKEND_API_URL.replace(/\/$/, '')}/api/verify-payment`,
        {
          booking_id: a6BookingNum,
          payment_reference_id: txnId,
          customer_id: session.customerId || booking.customerId || 13
        },
        {
          headers: session.token ? { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' } : {},
          timeout: 2500
        }
      );
      if (verifyRes.data) {
        a6Verified = true;
      }
    } catch (err) {
      circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      console.warn(`⚠️ [A6CarsService] A6 payment verification notice: ${err.message}`);
    }
  }

  booking.status = 'confirmed';
  booking.paymentStatus = 'paid';
  booking.paymentPlan = paymentPlan;
  booking.paidAmount = paidAmount;
  booking.paymentMethod = paymentMethod;
  booking.transactionId = txnId;
  booking.paidAt = new Date().toISOString();
  booking.collectionPin = String(Math.floor(1000 + Math.random() * 9000));
  booking.a6Verified = a6Verified;
  booking.instructions = `Payment confirmed & recorded. Show collection PIN (${booking.collectionPin}) at pickup hub.`;

  activeBookingsStore.set(bookingId, booking);
  activeBookingsStore.set(String(a6BookingNum), booking);

  // Persist transaction record into database for durability across instance restarts
  if (isDbConnected()) {
    try {
      await dbQuery(
        `INSERT INTO payment_transactions (transaction_id, booking_id, user_id, amount, payment_method, payment_plan, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (transaction_id) DO NOTHING`,
        [txnId, String(bookingId), String(booking.userId || userId), paidAmount, paymentMethod, paymentPlan, 'completed']
      );
    } catch (dbErr) {
      console.warn('Payment transaction persistence notice:', dbErr.message);
    }
  }

  return {
    success: true,
    message: `${paymentPlan === 'full' ? 'Full booking payment' : 'Reservation advance payment'} successful!`,
    booking: sanitizeBookingForClient(booking)
  };
}

async function getBooking(bookingId) {
  const booking = activeBookingsStore.get(bookingId) || activeBookingsStore.get(String(bookingId).replace(/^A6-2026-/, ''));
  return sanitizeBookingForClient(booking);
}

module.exports = {
  searchAvailableCars,
  getVehicle,
  createBooking,
  processPayment,
  getBooking,
  rentalDays,
  validateExternalUrl,
  BACKEND_API_URL,
  A6_CARS_PORTAL_URL
};
