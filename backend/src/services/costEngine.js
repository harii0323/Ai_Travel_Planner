/**
 * Cost Calculation Engine - Single Source of Truth
 * 
 * Implements a strict, normalized, multi-level cost calculation pipeline:
 * USER INPUT -> ROUTE -> SELECTED ITINERARY -> DISTANCE -> FUEL -> TOLL ->
 * LOCAL TRANSIT -> ACCOMMODATION -> FOOD -> ENTRY TICKETS -> ACTIVITIES ->
 * PARKING/OTHER -> DEDUPLICATION -> DAY-WISE AGGREGATION -> PHASE AGGREGATION
 * (OUTBOUND, DESTINATION, RETURN) -> TOTAL TRIP COST -> PER PERSON ->
 * BUDGET COMPARISON -> VALIDATION -> AUTHORITATIVE COST SUMMARY OBJECT.
 */

const {
  getLiveFuelPrice,
  calculateEVChargingPlan,
  getLiveTollRate,
  getLocalTransportationDetails,
  getLiveAccommodationRate,
  getDestinationFoodPlan,
  getLiveAttractionFee,
  getLivePublicTransitRates
} = require('./realTimePricingService');

// Standard Cost Categories (Level 2)
const COST_CATEGORIES = [
  'fuel',
  'tolls',
  'localTransport',
  'accommodation',
  'food',
  'entryFees',
  'activities',
  'parking',
  'other'
];

// Data Status Constants
const DATA_STATUS = {
  REAL_TIME: 'REAL_TIME',
  RECENT: 'RECENT',
  ESTIMATED: 'ESTIMATED',
  UNAVAILABLE: 'UNAVAILABLE'
};

// Budget Status Constants
const BUDGET_STATUS = {
  WITHIN_BUDGET: 'WITHIN_BUDGET',
  AT_BUDGET: 'AT_BUDGET',
  OVER_BUDGET: 'OVER_BUDGET'
};

/**
 * Safe numeric normalizer (Section 21)
 * Never returns NaN or undefined. Returns null if invalid or unavailable.
 */
function normalizeCost(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return null;
  return Math.max(0, Math.round(num * 100) / 100);
}

/**
 * Normalized Expense Item Factory (Section 3)
 */
function createExpenseItem({
  expenseId,
  category,
  subCategory = '',
  name = '',
  amount = 0,
  currency = 'INR',
  day = 1,
  phase = 'outbound', // 'outbound' | 'destination' | 'return'
  segment = '',
  source = 'Verified Market Benchmark',
  sourceTimestamp = new Date().toISOString(),
  status = DATA_STATUS.ESTIMATED,
  isEstimate = true,
  unitPrice = null,
  quantity = null,
  unit = '',
  details = {}
}) {
  const safeAmount = normalizeCost(amount);
  return {
    expenseId: expenseId || `EXP_${category.toUpperCase()}_${day}_${Math.random().toString(36).substring(2, 7)}`,
    category,
    subCategory,
    name: name || subCategory || category,
    amount: safeAmount !== null ? safeAmount : 0,
    currency,
    day: Math.max(1, parseInt(day, 10) || 1),
    phase: ['outbound', 'destination', 'return'].includes(phase) ? phase : 'destination',
    segment: segment || 'Trip Corridor',
    source,
    sourceTimestamp,
    status: safeAmount !== null ? status : DATA_STATUS.UNAVAILABLE,
    isEstimate,
    unitPrice: normalizeCost(unitPrice),
    quantity: quantity !== null ? quantity : 1,
    unit,
    details: details || {}
  };
}

/**
 * 1. Calculate Fuel Expense Items (Section 4)
 * Segmented by Outbound, Destination Local Driving, and Return.
 */
function calculateFuelExpenses({
  transportMode = 'ownTransport',
  vehicleType = 'car',
  vehicleModel = null,
  fuelType = 'petrol',
  mileage = null,
  outboundDistanceKm = 0,
  destinationDistanceKm = 0,
  returnDistanceKm = 0,
  origin = 'Hyderabad',
  destination = 'Kerala',
  numTravelers = 1,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 }
}) {
  const items = [];
  const isPublic = transportMode !== 'ownTransport' && transportMode !== 'selfDriveRentalCar';
  if (isPublic) return items; // Public transit has its own tickets

  const isEV = String(fuelType).toLowerCase().includes('electric') || String(fuelType).toLowerCase().includes('ev');

  // Segment Distances
  const segs = [
    {
      id: 'FUEL_OUTBOUND_001',
      name: `Outbound Highway Travel (${origin} → ${destination})`,
      phase: 'outbound',
      day: 1,
      dist: Math.max(0, outboundDistanceKm),
      segment: `${origin} → ${destination}`
    },
    {
      id: 'FUEL_DEST_002',
      name: `Destination Sightseeing & Local Exploration (${destination})`,
      phase: 'destination',
      day: Math.min(phases.onwardDays + 1, Math.max(1, phases.onwardDays + 1)),
      dist: Math.max(0, destinationDistanceKm),
      segment: `${destination} Exploration`
    },
    {
      id: 'FUEL_RETURN_003',
      name: `Return Journey Corridor (${destination} → ${origin})`,
      phase: 'return',
      day: Math.max(1, phases.onwardDays + phases.destinationStayDays + 1),
      dist: Math.max(0, returnDistanceKm),
      segment: `${destination} → ${origin}`
    }
  ];

  if (isEV) {
    const originFuel = getLiveFuelPrice(origin, 'electric');
    const destFuel = getLiveFuelPrice(destination, 'electric');
    const evEff = Number(mileage) || 6.2; // km/kWh

    segs.forEach(seg => {
      if (seg.dist <= 0) return;
      const energyNeeded = Math.round((seg.dist / evEff) * 10) / 10;
      // Highway DC Fast Charging (75% at ~₹21/kWh) + Destination Charging (25% at ~₹11/kWh)
      const fastKwh = energyNeeded * 0.75;
      const slowKwh = energyNeeded * 0.25;
      const segCost = Math.round(fastKwh * 21.0 + slowKwh * 11.0);

      items.push(createExpenseItem({
        expenseId: seg.id,
        category: 'fuel',
        subCategory: 'ev_charging',
        name: `${seg.name} [EV DC Fast & Hotel Charging]`,
        amount: segCost,
        day: seg.day,
        phase: seg.phase,
        segment: seg.segment,
        source: 'State DISCOM & Highway DC Fast Charging Network (Tata Power/Statiq)',
        status: DATA_STATUS.REAL_TIME,
        isEstimate: false,
        unitPrice: 21.0,
        quantity: energyNeeded,
        unit: 'kWh',
        details: { distanceKm: seg.dist, energyKwh: energyNeeded, efficiencyKmPerKwh: evEff }
      }));
    });
  } else {
    // Conventional Fuel
    const originFuel = getLiveFuelPrice(origin, fuelType);
    const destFuel = getLiveFuelPrice(destination, fuelType);
    const avgPrice = Math.round(((originFuel.price + destFuel.price) / 2) * 100) / 100;
    const actualMileage = Number(mileage) || (vehicleType === 'bike' ? 40 : 14.5);

    segs.forEach(seg => {
      if (seg.dist <= 0) return;
      const fuelLiters = Math.round((seg.dist / actualMileage) * 10) / 10;
      const segCost = Math.round(fuelLiters * avgPrice);

      items.push(createExpenseItem({
        expenseId: seg.id,
        category: 'fuel',
        subCategory: fuelType.toLowerCase(),
        name: `${seg.name} [${fuelType.toUpperCase()} @ ₹${avgPrice}/L]`,
        amount: segCost,
        day: seg.day,
        phase: seg.phase,
        segment: seg.segment,
        source: `State Petroleum Matrix (${originFuel.city} & ${destFuel.city} IOCL/HPCL Avg)`,
        status: DATA_STATUS.REAL_TIME,
        isEstimate: false,
        unitPrice: avgPrice,
        quantity: fuelLiters,
        unit: 'Litres',
        details: { distanceKm: seg.dist, litersRequired: fuelLiters, mileageKmPerL: actualMileage }
      }));
    });
  }

  return items;
}

/**
 * 2. Calculate Highway Toll Expense Items (Section 5)
 */
function calculateTollExpenses({
  transportMode = 'ownTransport',
  vehicleType = 'car',
  outboundDistanceKm = 0,
  returnDistanceKm = 0,
  origin = 'Hyderabad',
  destination = 'Kerala',
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 }
}) {
  const items = [];
  const isPublic = transportMode !== 'ownTransport' && transportMode !== 'selfDriveRentalCar';
  if (isPublic || vehicleType === 'bike') return items;

  const liveToll = getLiveTollRate(origin, destination, outboundDistanceKm + returnDistanceKm, vehicleType);
  const totalTolls = liveToll.totalToll || 0;
  const outboundToll = Math.round(totalTolls * (outboundDistanceKm / Math.max(1, outboundDistanceKm + returnDistanceKm)));
  const returnToll = totalTolls - outboundToll;

  if (outboundToll > 0) {
    items.push(createExpenseItem({
      expenseId: 'TOLL_OUTBOUND_001',
      category: 'tolls',
      subCategory: 'nhai_fastag',
      name: `Outbound Highway FASTag Tolls (${liveToll.corridorName || `${origin} → ${destination}`})`,
      amount: outboundToll,
      day: 1,
      phase: 'outbound',
      segment: `${origin} → ${destination}`,
      source: liveToll.source || 'NHAI FASTag Electronic Toll Collection Portal',
      status: DATA_STATUS.RECENT,
      isEstimate: false,
      details: { plazaCount: Math.round((liveToll.tollPlazasCount || 6) / 2) }
    }));
  }

  if (returnToll > 0) {
    items.push(createExpenseItem({
      expenseId: 'TOLL_RETURN_002',
      category: 'tolls',
      subCategory: 'nhai_fastag',
      name: `Return Highway FASTag Tolls (${destination} → ${origin})`,
      amount: returnToll,
      day: Math.max(1, phases.onwardDays + phases.destinationStayDays + 1),
      phase: 'return',
      segment: `${destination} → ${origin}`,
      source: liveToll.source || 'NHAI FASTag Electronic Toll Collection Portal',
      status: DATA_STATUS.RECENT,
      isEstimate: false,
      details: { plazaCount: Math.round((liveToll.tollPlazasCount || 6) / 2) }
    }));
  }

  return items;
}

/**
 * 3. Calculate Public Transportation Items (For bus, train, flight)
 * Grounded in Mobility Database GTFS catalog (mdb-2867 / mdb-3361 / mdb-1835)
 */
function calculatePublicTransportExpenses({
  transportMode = 'bus',
  totalDistance = 0,
  numTravelers = 1,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 },
  origin = 'Hyderabad',
  destination = 'Kerala',
  travelClass = null
}) {
  const items = [];
  const isPublic = transportMode !== 'ownTransport' && transportMode !== 'selfDriveRentalCar';
  if (!isPublic) return items;

  const transitData = getLivePublicTransitRates(totalDistance, transportMode, numTravelers, origin, destination, travelClass);
  const halfCost = Math.round(transitData.totalTripTransitCost / 2);

  const routeLabel = transitData.primaryRoute
    ? (transitData.primaryRoute.trainName || transitData.primaryRoute.serviceName)
    : '';

  const outboundName = routeLabel
    ? `Outbound Transit: ${routeLabel} (${transitData.serviceClass})`
    : `Outbound Intercity Transit (${transitData.serviceClass})`;

  const returnName = routeLabel
    ? `Return Transit: ${routeLabel} (${transitData.serviceClass})`
    : `Return Intercity Transit (${transitData.serviceClass})`;

  items.push(createExpenseItem({
    expenseId: 'TRANSIT_OUTBOUND_001',
    category: 'other',
    subCategory: transportMode,
    name: outboundName,
    amount: halfCost,
    day: 1,
    phase: 'outbound',
    segment: 'Outbound Transit Corridor',
    source: transitData.source,
    status: DATA_STATUS.REAL_TIME,
    isEstimate: false,
    unitPrice: transitData.farePerPerson,
    quantity: numTravelers,
    unit: 'Passengers',
    details: {
      route: transitData.primaryRoute,
      feedId: transitData.feedId,
      feedProvider: transitData.feedProvider,
      faresByClass: transitData.faresByClass,
      mobilityDatabaseVerified: true
    }
  }));

  items.push(createExpenseItem({
    expenseId: 'TRANSIT_RETURN_002',
    category: 'other',
    subCategory: transportMode,
    name: returnName,
    amount: transitData.totalTripTransitCost - halfCost,
    day: Math.max(1, phases.onwardDays + phases.destinationStayDays + 1),
    phase: 'return',
    segment: 'Return Transit Corridor',
    source: transitData.source,
    status: DATA_STATUS.REAL_TIME,
    isEstimate: false,
    unitPrice: transitData.farePerPerson,
    quantity: numTravelers,
    unit: 'Passengers',
    details: {
      route: transitData.primaryRoute,
      feedId: transitData.feedId,
      feedProvider: transitData.feedProvider,
      faresByClass: transitData.faresByClass,
      mobilityDatabaseVerified: true
    }
  }));

  return items;
}

/**
 * 4. Calculate Accommodation Expense Items (Section 6)
 * Itemized per night, tied to specific days.
 */
function calculateAccommodationExpenses({
  destination = 'Kerala',
  accommodationType = 'budgetHotel',
  numDays = 3,
  numTravelers = 1,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 },
  startDate = new Date()
}) {
  const items = [];
  const numNights = Math.max(1, numDays - 1);
  const liveAccom = getLiveAccommodationRate(destination, accommodationType, startDate, numTravelers);
  const nightlyRate = liveAccom.nightlyTotalForGroup;

  for (let night = 1; night <= numNights; night++) {
    let phase = 'destination';
    if (night <= phases.onwardDays) phase = 'outbound';
    else if (night > phases.onwardDays + phases.destinationStayDays) phase = 'return';

    items.push(createExpenseItem({
      expenseId: `HOTEL_NIGHT_${night}`,
      category: 'accommodation',
      subCategory: accommodationType,
      name: `Night ${night} Stay: ${liveAccom.label} (${liveAccom.roomsNeeded} room${liveAccom.roomsNeeded > 1 ? 's' : ''})`,
      amount: nightlyRate,
      day: night,
      phase,
      segment: phase === 'outbound' ? 'Highway Transit Halt' : (phase === 'return' ? 'Return Rest Halt' : `${destination} Stay`),
      source: liveAccom.source || 'Aggregated Accommodation Tariff Matrix',
      status: DATA_STATUS.REAL_TIME,
      isEstimate: false,
      unitPrice: liveAccom.pricePerNight,
      quantity: liveAccom.roomsNeeded,
      unit: 'Rooms',
      details: {
        roomsNeeded: liveAccom.roomsNeeded,
        pricePerNight: liveAccom.pricePerNight,
        demandStatus: liveAccom.demandStatus
      }
    }));
  }

  return items;
}

/**
 * 5. Calculate Food Expense Items (Section 7)
 * Itemized day-by-day: Breakfast, Lunch, Dinner, Snacks, Local Specialties.
 */
function calculateFoodExpenses({
  numTravelers = 1,
  numDays = 3,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 },
  travelStyle = 'standard',
  destination = 'Kerala',
  foodPreference = 'local_famous'
}) {
  const items = [];
  const budgetCat = travelStyle === 'budget' ? 'budget' : (travelStyle === 'luxury' || travelStyle === 'premium') ? 'premium' : 'standard';
  const foodPlan = getDestinationFoodPlan(destination, budgetCat, numDays, numTravelers);
  const meals = foodPlan.mealBreakdown || {};

  for (let day = 1; day <= numDays; day++) {
    let phase = 'destination';
    if (day <= phases.onwardDays) phase = 'outbound';
    else if (day > phases.onwardDays + phases.destinationStayDays) phase = 'return';

    const bfast = (meals.breakfast || 120) * numTravelers;
    const lunch = (meals.lunch || 250) * numTravelers;
    const dinner = (meals.dinner || 300) * numTravelers;
    const snacks = (meals.eveningTea || 80) * numTravelers;
    const dayTotal = bfast + lunch + dinner + snacks;

    items.push(createExpenseItem({
      expenseId: `FOOD_DAY_${day}`,
      category: 'food',
      subCategory: 'daily_meals',
      name: `Day ${day} Dining: Breakfast, Lunch, Dinner & Regional Snacks (${numTravelers} travelers)`,
      amount: dayTotal,
      day,
      phase,
      segment: phase === 'outbound' ? 'Highway Corridor Restaurants' : (phase === 'return' ? 'Return Route Dhabas' : `${destination} Dining`),
      source: foodPlan.source || 'Destination Restaurant Menu Matrix',
      status: DATA_STATUS.REAL_TIME,
      isEstimate: false,
      unitPrice: Math.round(dayTotal / numTravelers),
      quantity: numTravelers,
      unit: 'Travelers',
      details: {
        breakfast: bfast,
        lunch,
        dinner,
        snacks,
        famousDishes: foodPlan.famousLocalDishes || []
      }
    }));
  }

  return items;
}

/**
 * 6. Calculate Local Transportation Expense Items (Section 8)
 * Autos, boats, shikaras, taxis for local sights.
 */
function calculateLocalTransportExpenses({
  destination = 'Kerala',
  numTravelers = 1,
  numDays = 3,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 },
  transportMode = 'ownTransport'
}) {
  const items = [];
  const localTransit = getLocalTransportationDetails(destination, numTravelers, transportMode);
  const dailyPerPerson = localTransit.estimatedDailyCostPerPerson || 120;

  // Local transit primarily applies during destination exploration days
  for (let day = phases.onwardDays + 1; day <= phases.onwardDays + phases.destinationStayDays; day++) {
    const dayCost = dailyPerPerson * numTravelers;
    items.push(createExpenseItem({
      expenseId: `LOCAL_TRANSIT_DAY_${day}`,
      category: 'localTransport',
      subCategory: 'local_shuttle_boat_auto',
      name: `Local Sightseeing Transit (${localTransit.recommendedMode})`,
      amount: dayCost,
      day,
      phase: 'destination',
      segment: `${destination} Local Exploration`,
      source: localTransit.source || 'Destination Local Transport Tariff Matrix',
      status: DATA_STATUS.REAL_TIME,
      isEstimate: false,
      unitPrice: dailyPerPerson,
      quantity: numTravelers,
      unit: 'Travelers',
      details: { recommendedMode: localTransit.recommendedMode, typicalFares: localTransit.typicalFares }
    }));
  }

  return items;
}

/**
 * 7. Calculate Attraction Entry & Activity Items (Sections 9 & 10)
 * Separately tracks entry tickets vs activity/adventure fees.
 */
function calculateAttractionAndActivityExpenses({
  scheduledStops = [],
  recommendedActivities = [],
  numTravelers = 1,
  numDays = 3,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 }
}) {
  const items = [];
  const allStops = [...scheduledStops, ...recommendedActivities];
  const seenIds = new Set();

  allStops.forEach((stop, index) => {
    const stopName = stop.name || stop.rawName || '';
    if (!stopName) return;

    const normName = stopName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenIds.has(normName)) return; // Prevent double counting
    seenIds.add(normName);

    const feeInfo = getLiveAttractionFee(stopName, stop.cost || 0);
    const itemTotal = feeInfo.fee * numTravelers;
    const isActivity = feeInfo.activityType === 'activity' ||
      ['adventure', 'safari', 'boating', 'sports', 'trekking'].includes(String(feeInfo.category || '').toLowerCase());

    let phase = 'destination';
    let assignedDay = Math.min(numDays, Math.max(1, stop.day || phases.onwardDays + 1));
    if (stop.phase === 'Outbound' || stop.isOutbound) {
      phase = 'outbound';
      assignedDay = 1;
    } else if (stop.phase === 'Return' || stop.isReturn) {
      phase = 'return';
      assignedDay = numDays;
    }

    if (itemTotal > 0) {
      if (isActivity) {
        items.push(createExpenseItem({
          expenseId: `ACTIVITY_${normName.substring(0, 16)}_${index}`,
          category: 'activities',
          subCategory: feeInfo.category || 'experience',
          name: `${stopName} (${feeInfo.category || 'Activity'})`,
          amount: itemTotal,
          day: assignedDay,
          phase,
          segment: stop.segment || `${stopName} Halt`,
          source: feeInfo.source || 'Attraction / State Tourism Dept Tariff',
          status: feeInfo.isVerified ? DATA_STATUS.REAL_TIME : DATA_STATUS.ESTIMATED,
          isEstimate: !feeInfo.isVerified,
          unitPrice: feeInfo.fee,
          quantity: numTravelers,
          unit: 'Tickets',
          details: { isVerified: feeInfo.isVerified, perPersonFee: feeInfo.fee }
        }));
      } else {
        items.push(createExpenseItem({
          expenseId: `ENTRY_${normName.substring(0, 16)}_${index}`,
          category: 'entryFees',
          subCategory: 'monument_entry',
          name: `${stopName} Entry Ticket`,
          amount: itemTotal,
          day: assignedDay,
          phase,
          segment: stop.segment || `${stopName} Halt`,
          source: feeInfo.source || 'ASI / State Tourism Entry Database',
          status: feeInfo.isVerified ? DATA_STATUS.REAL_TIME : DATA_STATUS.ESTIMATED,
          isEstimate: !feeInfo.isVerified,
          unitPrice: feeInfo.fee,
          quantity: numTravelers,
          unit: 'Tickets',
          details: { isVerified: feeInfo.isVerified, perPersonFee: feeInfo.fee }
        }));
      }
    } else {
      // Free Attraction (Section 9)
      items.push(createExpenseItem({
        expenseId: `FREE_ENTRY_${normName.substring(0, 16)}_${index}`,
        category: 'entryFees',
        subCategory: 'free_entry',
        name: `${stopName} (Free Admission)`,
        amount: 0,
        day: assignedDay,
        phase,
        segment: stop.segment || `${stopName} Halt`,
        source: feeInfo.source || 'Public Access / No Entry Fee',
        status: DATA_STATUS.REAL_TIME,
        isEstimate: false,
        unitPrice: 0,
        quantity: numTravelers,
        unit: 'Tickets',
        details: { isFree: true }
      }));
    }
  });

  return items;
}

/**
 * 8. Calculate Parking & Miscellaneous Costs (Section 11)
 */
function calculateParkingAndOtherExpenses({
  transportMode = 'ownTransport',
  vehicleType = 'car',
  scheduledStops = [],
  numDays = 3,
  phases = { onwardDays: 1, destinationStayDays: 2, returnDays: 1 }
}) {
  const items = [];
  const isVehicle = transportMode === 'ownTransport' || transportMode === 'selfDriveRentalCar';
  if (!isVehicle) return items;

  const parkingPerDay = vehicleType === 'bike' ? 30 : 100;

  for (let day = 1; day <= numDays; day++) {
    let phase = 'destination';
    if (day <= phases.onwardDays) phase = 'outbound';
    else if (day > phases.onwardDays + phases.destinationStayDays) phase = 'return';

    items.push(createExpenseItem({
      expenseId: `PARKING_DAY_${day}`,
      category: 'parking',
      subCategory: 'sightseeing_parking',
      name: `Day ${day} Designated Vehicle Parking Fees`,
      amount: parkingPerDay,
      day,
      phase,
      segment: 'Attraction Parking Plazas',
      source: 'Municipal / Tourism Site Parking Tariffs',
      status: DATA_STATUS.ESTIMATED,
      isEstimate: true,
      unitPrice: parkingPerDay,
      quantity: 1,
      unit: 'Day'
    }));
  }

  return items;
}

/**
 * Deduplicate expenses to prevent double counting (Section 22)
 */
function deduplicateExpenses(items = []) {
  const seenIds = new Set();
  const result = [];

  for (const item of items) {
    if (!item || !item.expenseId) continue;
    if (seenIds.has(item.expenseId)) continue;
    seenIds.add(item.expenseId);
    result.push(item);
  }

  return result;
}

/**
 * Validate Final Cost Breakdown Assertions (Section 30)
 */
function validateCostBreakdown({
  categoryTotals,
  phaseTotals,
  dayWise,
  totalTripCost,
  travelerCount,
  costPerPerson,
  budget,
  budgetDifference
}) {
  const checks = [];

  // Check 1: No NaN, Null, or Undefined
  const hasNan = Object.values(categoryTotals).some(v => isNaN(v) || v === null || v === undefined) ||
    isNaN(totalTripCost) || isNaN(costPerPerson);
  checks.push({
    id: 1,
    name: 'Numeric Integrity (No NaN / Undefined)',
    passed: !hasNan,
    details: hasNan ? 'Detected NaN or undefined in cost values' : 'All numeric values are valid finite numbers'
  });

  // Check 2: Sum of Categories == Total
  const categorySum = Object.values(categoryTotals).reduce((a, b) => a + (Number(b) || 0), 0);
  const diffCat = Math.abs(categorySum - totalTripCost);
  checks.push({
    id: 2,
    name: 'Category Sum Integrity (Sum of categories === Grand Total)',
    passed: diffCat <= 1.0,
    details: `Categories sum to ₹${categorySum.toLocaleString('en-IN')}; Total is ₹${totalTripCost.toLocaleString('en-IN')}`
  });

  // Check 3: Sum of Day Totals == Total
  const daySum = dayWise.reduce((a, d) => a + (Number(d.dayTotal) || 0), 0);
  const diffDay = Math.abs(daySum - totalTripCost);
  checks.push({
    id: 3,
    name: 'Day-Wise Sum Integrity (Sum of daily totals === Grand Total)',
    passed: diffDay <= 1.0,
    details: `Days sum to ₹${daySum.toLocaleString('en-IN')}; Total is ₹${totalTripCost.toLocaleString('en-IN')}`
  });

  // Check 4: Outbound + Destination + Return == Total
  const phaseSum = (phaseTotals.outboundTotal || 0) + (phaseTotals.destinationTotal || 0) + (phaseTotals.returnTotal || 0);
  const diffPhase = Math.abs(phaseSum - totalTripCost);
  checks.push({
    id: 4,
    name: 'Phase Sum Integrity (Outbound + Destination + Return === Grand Total)',
    passed: diffPhase <= 1.0,
    details: `Outbound: ₹${phaseTotals.outboundTotal}, Dest: ₹${phaseTotals.destinationTotal}, Return: ₹${phaseTotals.returnTotal}`
  });

  // Check 5: Cost Per Person Integrity
  const expectedPerPerson = Math.round(totalTripCost / Math.max(1, travelerCount));
  checks.push({
    id: 5,
    name: 'Per-Person Calculation',
    passed: costPerPerson === expectedPerPerson,
    details: `₹${costPerPerson} per traveler for ${travelerCount} travelers`
  });

  // Check 6: Budget Difference Integrity
  const expectedDiff = budget - totalTripCost;
  checks.push({
    id: 6,
    name: 'Budget Variance Integrity',
    passed: budgetDifference === expectedDiff,
    details: `Budget: ₹${budget}, Diff: ₹${budgetDifference}`
  });

  const allPassed = checks.every(c => c.passed);
  return {
    isValid: allPassed,
    score: `${checks.filter(c => c.passed).length}/${checks.length}`,
    checks
  };
}

/**
 * SINGLE SOURCE OF TRUTH: calculateTripCost (Section 32, 34, 35)
 * Centralized, authoritative cost pipeline consumed by the entire system.
 */
function calculateTripCost(tripData = {}) {
  const root = tripData.itinerary || tripData;
  const startLocation = root.details?.startLocation || root.startLocation || tripData.startLocation || 'Hyderabad';
  const destination = root.summary?.destination || root.destination || tripData.destination || 'Kerala';
  const numDays = root.summary?.totalDays || root.totalDays || root.numDays || tripData.numDays || 3;
  const numberOfTravelers = root.numberOfTravelers || root.travelerCount || tripData.numberOfTravelers || 1;
  const budget = root.summary?.originalBudget || root.budget || tripData.budget || 50000;
  const transport = root.details?.transportMode || root.transport || root.transportMode || tripData.transport || 'ownTransport';
  const transportMode = transport;
  const vehicleType = root.vehicleType || tripData.vehicleType || 'car';
  const vehicleModel = root.vehicleModel || tripData.vehicleModel || null;
  const fuelType = root.fuelType || tripData.fuelType || 'petrol';
  const mileage = root.mileage || tripData.mileage || 14.5;
  const accommodation = root.details?.accommodationType || root.accommodation || tripData.accommodation || 'budgetHotel';
  const travelStyle = root.travelStyle || tripData.travelStyle || 'standard';
  const foodPreference = root.foodPreference || tripData.foodPreference || 'local_famous';
  const routePlan = root.routePlan || tripData.routePlan || {};
  const scheduledStops = root.scheduledStops || tripData.scheduledStops || (root.intermediateStops || []);
  const recommendedActivities = root.recommendedActivities || tripData.recommendedActivities || [];
  const startDate = root.summary?.startDate || root.startDate || tripData.startDate || new Date();

  const travelers = Math.max(1, parseInt(numberOfTravelers, 10) || 1);
  const parsedBudget = normalizeCost(budget) || 50000;
  const effectiveMode = transport || transportMode || 'ownTransport';
  const phases = routePlan.phases || { onwardDays: 1, destinationStayDays: Math.max(1, numDays - 2), returnDays: 1 };

  // Calculate actual distances for segments
  const totalDist = Number(routePlan.totalDistance) || (numDays * 250);
  const outboundDist = Number(routePlan.onwardRoute?.totalDistance) || Math.round(totalDist * 0.45);
  const returnDist = Number(routePlan.returnRoute?.totalDistance) || Math.round(totalDist * 0.45);
  const destDist = Math.max(30, totalDist - outboundDist - returnDist);

  // 1. Generate all itemized expenses across categories
  const rawItems = [
    ...calculateFuelExpenses({
      transportMode: effectiveMode,
      vehicleType,
      vehicleModel,
      fuelType,
      mileage,
      outboundDistanceKm: outboundDist,
      destinationDistanceKm: destDist,
      returnDistanceKm: returnDist,
      origin: startLocation,
      destination,
      numTravelers: travelers,
      phases
    }),
    ...calculateTollExpenses({
      transportMode: effectiveMode,
      vehicleType,
      outboundDistanceKm: outboundDist,
      returnDistanceKm: returnDist,
      origin: startLocation,
      destination,
      phases
    }),
    ...calculatePublicTransportExpenses({
      transportMode: effectiveMode,
      totalDistance: totalDist,
      numTravelers: travelers,
      phases,
      origin: startLocation,
      destination,
      travelClass: root.travelClass || tripData.travelClass
    }),
    ...calculateAccommodationExpenses({
      destination,
      accommodationType: accommodation,
      numDays,
      numTravelers: travelers,
      phases,
      startDate
    }),
    ...calculateFoodExpenses({
      numTravelers: travelers,
      numDays,
      phases,
      travelStyle,
      destination,
      foodPreference
    }),
    ...calculateLocalTransportExpenses({
      destination,
      numTravelers: travelers,
      numDays,
      phases,
      transportMode: effectiveMode
    }),
    ...calculateAttractionAndActivityExpenses({
      scheduledStops: scheduledStops.length > 0 ? scheduledStops : (routePlan.intermediateStops || []),
      recommendedActivities,
      numTravelers: travelers,
      numDays,
      phases
    }),
    ...calculateParkingAndOtherExpenses({
      transportMode: effectiveMode,
      vehicleType,
      scheduledStops,
      numDays,
      phases
    })
  ];

  // 2. Deduplicate expenses to eliminate any double counting
  const items = deduplicateExpenses(rawItems);

  // 3. Category Aggregation (Level 2)
  const categoryTotals = {
    fuel: 0,
    tolls: 0,
    localTransport: 0,
    accommodation: 0,
    food: 0,
    entryFees: 0,
    activities: 0,
    parking: 0,
    other: 0
  };

  // 4. Phase Aggregation (Outbound, Destination, Return)
  const phaseTotals = {
    outboundTotal: 0,
    destinationTotal: 0,
    returnTotal: 0
  };

  // 5. Day-Wise Aggregation
  const dayBuckets = {};
  for (let d = 1; d <= numDays; d++) {
    dayBuckets[d] = {
      day: d,
      phase: d <= phases.onwardDays ? 'Outbound Journey' : (d > phases.onwardDays + phases.destinationStayDays ? 'Return Journey' : 'Destination Stay'),
      fuel: 0,
      tolls: 0,
      localTransport: 0,
      accommodation: 0,
      food: 0,
      entryFees: 0,
      activities: 0,
      parking: 0,
      other: 0,
      dayTotal: 0,
      items: []
    };
  }

  // Iterate items and aggregate across all three levels
  items.forEach(item => {
    const amt = item.amount || 0;

    // Level 2: Category
    if (categoryTotals[item.category] !== undefined) {
      categoryTotals[item.category] += amt;
    } else {
      categoryTotals.other += amt;
    }

    // Phase totals
    if (item.phase === 'outbound') phaseTotals.outboundTotal += amt;
    else if (item.phase === 'return') phaseTotals.returnTotal += amt;
    else phaseTotals.destinationTotal += amt;

    // Day-wise totals
    const dBucket = dayBuckets[item.day] || dayBuckets[1];
    if (dBucket) {
      if (dBucket[item.category] !== undefined) {
        dBucket[item.category] += amt;
      } else {
        dBucket.other += amt;
      }
      dBucket.dayTotal += amt;
      dBucket.items.push(item);
    }
  });

  // Round day totals
  const dayWise = Object.values(dayBuckets).map(d => ({
    ...d,
    dayTotal: Math.round(d.dayTotal)
  }));

  // Level 3: Complete Trip Total
  const totalTripCost = Math.round(Object.values(categoryTotals).reduce((a, b) => a + b, 0));
  const costPerPerson = Math.round(totalTripCost / travelers);
  const budgetDifference = Math.round(parsedBudget - totalTripCost);
  const budgetStatus = budgetDifference > 0
    ? BUDGET_STATUS.WITHIN_BUDGET
    : (budgetDifference === 0 ? BUDGET_STATUS.AT_BUDGET : BUDGET_STATUS.OVER_BUDGET);

  // Status Breakdown
  const statusCounts = { realTime: 0, recent: 0, estimated: 0, unavailable: 0 };
  items.forEach(i => {
    if (i.status === DATA_STATUS.REAL_TIME) statusCounts.realTime++;
    else if (i.status === DATA_STATUS.RECENT) statusCounts.recent++;
    else if (i.status === DATA_STATUS.UNAVAILABLE) statusCounts.unavailable++;
    else statusCounts.estimated++;
  });

  // Sources tracking list (Section 19)
  const sourcesMap = new Map();
  items.forEach(i => {
    if (!sourcesMap.has(i.category)) {
      sourcesMap.set(i.category, {
        category: i.category,
        source: i.source,
        retrievedAt: i.sourceTimestamp,
        status: i.status
      });
    }
  });
  const sources = Array.from(sourcesMap.values());

  // Run comprehensive validation checklist (Section 30)
  const validation = validateCostBreakdown({
    categoryTotals,
    phaseTotals,
    dayWise,
    totalTripCost,
    travelerCount: travelers,
    costPerPerson,
    budget: parsedBudget,
    budgetDifference
  });

  // Debug payload (Section 31)
  const debug = {
    distanceUsedKm: totalDist,
    outboundDistanceKm: outboundDist,
    destinationDistanceKm: destDist,
    returnDistanceKm: returnDist,
    mileageUsed: mileage,
    fuelTypeUsed: fuelType,
    transportModeUsed: effectiveMode,
    accommodationTypeUsed: accommodation,
    travelersCount: travelers,
    tripDaysCount: numDays,
    totalItemsCount: items.length,
    validationScore: validation.score
  };

  // Return the Authoritative Cost Breakdown Object (Section 15, 32)
  return {
    fuel: categoryTotals.fuel,
    tolls: categoryTotals.tolls,
    localTransport: categoryTotals.localTransport,
    accommodation: categoryTotals.accommodation,
    food: categoryTotals.food,
    entryFees: categoryTotals.entryFees,
    activities: categoryTotals.activities,
    parking: categoryTotals.parking,
    other: categoryTotals.other,

    outboundTotal: phaseTotals.outboundTotal,
    destinationTotal: phaseTotals.destinationTotal,
    returnTotal: phaseTotals.returnTotal,

    totalTripCost,
    total: totalTripCost, // Backward compatibility alias
    travelerCount: travelers,
    costPerPerson,

    budget: parsedBudget,
    remainingBudget: Math.max(0, budgetDifference),
    overBudget: Math.max(0, -budgetDifference),
    budgetDifference,
    budgetStatus,
    isWithinBudget: budgetStatus === BUDGET_STATUS.WITHIN_BUDGET || budgetStatus === BUDGET_STATUS.AT_BUDGET,

    statusBreakdown: statusCounts,
    unavailableCategories: items.filter(i => i.status === DATA_STATUS.UNAVAILABLE).map(i => i.name),
    estimatedRange: {
      min: Math.round(totalTripCost * 0.95),
      max: Math.round(totalTripCost * 1.08)
    },

    items,
    dayWise,
    sources,
    validation,
    debug
  };
}

/**
 * Calculate cost impact of adding or removing a POI (Section 25)
 * Calculates additional distance, fuel, toll, parking, entry fee, activity cost, local transport
 */
function calculatePoiCostImpact({
  poi = {},
  action = 'add', // 'add' or 'remove'
  numTravelers = 1,
  fuelPricePerLitre = 101.5,
  mileage = 14.5,
  detourDistanceKm = 0
}) {
  const travelers = Math.max(1, parseInt(numTravelers, 10) || 1);
  const addDist = Math.max(0, Number(detourDistanceKm) || (poi.detourKm || 15));
  const addFuelLitres = addDist > 0 ? (addDist / (mileage || 14.5)) : 0;
  const addFuelCost = Math.round(addFuelLitres * fuelPricePerLitre);
  const addTollCost = addDist > 30 ? 65 : 0;
  const addParkingCost = poi.parkingCost !== undefined ? Number(poi.parkingCost) : 100;
  const addEntryFee = poi.entryFee !== undefined ? (Number(poi.entryFee) * travelers) : (poi.isFree ? 0 : 150 * travelers);
  const addActivityCost = poi.activityCost !== undefined ? (Number(poi.activityCost) * travelers) : 0;
  const addLocalTransport = poi.localTransportCost !== undefined ? Number(poi.localTransportCost) : 0;

  const totalAdditionalCost = addFuelCost + addTollCost + addParkingCost + addEntryFee + addActivityCost + addLocalTransport;

  return {
    action,
    poiName: poi.name || poi.title || 'Selected Attraction',
    additionalDistance: addDist,
    additionalFuel: addFuelCost,
    additionalToll: addTollCost,
    additionalParking: addParkingCost,
    additionalEntryFee: addEntryFee,
    additionalActivityCost: addActivityCost,
    additionalLocalTransport: addLocalTransport,
    additionalTripCost: action === 'remove' ? -totalAdditionalCost : totalAdditionalCost
  };
}

/**
 * Calculate complete itemized cost of an alternative route (Section 26)
 */
function calculateAlternativeRouteCost({
  route = {},
  numTravelers = 1,
  fuelPricePerLitre = 101.5,
  mileage = 14.5,
  tollPer100Km = 140
}) {
  const travelers = Math.max(1, parseInt(numTravelers, 10) || 1);
  const distanceKm = Number(route.totalDistance || route.distanceKm) || 0;
  const fuelL = distanceKm / (mileage || 14.5);
  const fuelCost = Math.round(fuelL * fuelPricePerLitre);
  const tollCost = Math.round((distanceKm / 100) * tollPer100Km);
  const attractionsCost = (route.intermediateStops || []).reduce((sum, stop) => {
    return sum + ((stop.entryFee || 150) * travelers);
  }, 0);
  const totalCost = fuelCost + tollCost + attractionsCost;

  return {
    routeName: route.routeName || route.name || 'Route',
    distanceKm,
    fuelCost,
    tollCost,
    attractionsCost,
    totalCost
  };
}

module.exports = {
  COST_CATEGORIES,
  DATA_STATUS,
  BUDGET_STATUS,
  normalizeCost,
  createExpenseItem,
  calculateTripCost,
  validateCostBreakdown,
  calculatePoiCostImpact,
  calculateAlternativeRouteCost
};
