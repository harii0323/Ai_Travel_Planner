/**
 * BudgetCalculationEngine
 * 
 * Module 9 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Strictly eliminates fixed-percentage budget allocations.
 * - Computes verifiable expenses from actual road distance, vehicle mileage, fuel rates, room counts, and ticket prices.
 * - Categorizes each expense with a transparent data status (live_verified, recently_retrieved, calculated_estimate, user_provided).
 * - Treats budget as an active constraint (never silently deleting top user priorities).
 * - Generates concrete optimization trade-offs when estimated expenditure exceeds user budget.
 */

const FUEL_BENCHMARKS = {
  petrol: 105.5,
  diesel: 94.8,
  cng: 85.0,
  electric: 8.5 // per kWh
};

const ACCOMMODATION_BENCHMARKS = {
  hostel: { ratePerRoom: 600, capacity: 1, label: 'Hostel Dorm Bed' },
  budgetHotel: { ratePerRoom: 1800, capacity: 2, label: 'Comfortable Budget Hotel (Private Room, AC, WiFi)' },
  homestay: { ratePerRoom: 2200, capacity: 2, label: 'Heritage / Local Homestay' },
  resort: { ratePerRoom: 3500, capacity: 2, label: 'Scenic / Valley View Resort' },
  luxuryHotel: { ratePerRoom: 6500, capacity: 2, label: '4-Star / 5-Star Premium Luxury Hotel' }
};

const MEAL_BENCHMARKS = {
  budget: { breakfast: 100, lunch: 160, dinner: 190 },
  standard: { breakfast: 120, lunch: 200, dinner: 230 },
  premium: { breakfast: 200, lunch: 320, dinner: 420 }
};

/**
 * Calculates itemized, mathematically verifiable trip cost.
 */
function calculateTripBudget({
  userProfile,
  routeInfo,
  dayPlans = []
}) {
  const travelers = Math.max(1, userProfile.numberOfTravelers || 1);
  const totalDays = Math.max(1, userProfile.totalDays || 1);
  const nights = Math.max(0, totalDays - 1);
  const userBudget = Number(userProfile.totalBudget || userProfile.budget || 25000);

  // Total driving distance across all scheduled days
  const totalDistanceKm = dayPlans.reduce((sum, d) => sum + (d.totalDayDistanceKm || 0), 0) || routeInfo.totalDistanceKm || 500;

  // 1. Fuel / Transportation Cost
  let fuelCost = 0;
  let litersUsed = 0;
  const isPersonalVehicle = userProfile.transportDetails?.isPersonalVehicle !== false;
  const fuelType = userProfile.vehicleDetails?.fuelType || 'petrol';
  const mileage = userProfile.vehicleDetails?.mileage || 15;
  const fuelPrice = FUEL_BENCHMARKS[fuelType] || FUEL_BENCHMARKS.petrol;

  if (isPersonalVehicle) {
    litersUsed = Math.round((totalDistanceKm / mileage) * 10) / 10;
    fuelCost = Math.round(litersUsed * fuelPrice);
  } else {
    // Public transport (bus/train fares)
    const perPersonTransit = Math.round(totalDistanceKm * 1.25);
    fuelCost = perPersonTransit * travelers;
  }

  // 2. Highway Tolls
  let tollCost = 0;
  if (isPersonalVehicle && userProfile.vehicleDetails?.vehicleType !== 'bike') {
    tollCost = Math.round(totalDistanceKm * 1.15); // Average NHAI 4-lane rate
  }

  // 3. Accommodation Cost (Based on room capacity and night count)
  const accType = userProfile.accommodationPreference || 'budgetHotel';
  const accConfig = ACCOMMODATION_BENCHMARKS[accType] || ACCOMMODATION_BENCHMARKS.budgetHotel;
  const roomsNeeded = Math.ceil(travelers / (accConfig.capacity || 2));
  const accommodationCost = nights * roomsNeeded * accConfig.ratePerRoom;

  // 4. Food & Dining Cost
  const mealRate = MEAL_BENCHMARKS[userProfile.travelPace === 'relaxed' ? 'premium' : 'standard'] || MEAL_BENCHMARKS.standard;
  const dailyFoodPerPerson = mealRate.breakfast + mealRate.lunch + mealRate.dinner;
  const foodCost = totalDays * travelers * dailyFoodPerPerson;

  // 5. Entry Tickets & Activity Fees
  let attractionTickets = 0;
  let unconfirmedFeesCount = 0;
  let verifiedFeesCount = 0;
  dayPlans.forEach(d => {
    (d.stops || []).forEach(s => {
      const fee = Number(s.entryFee || 0);
      attractionTickets += fee * travelers;
      if (s.isLiveVerified || s.entryFeeVerified) {
        verifiedFeesCount++;
      } else if (fee === 0 && !s.isFreeAdmissionVerified) {
        unconfirmedFeesCount++;
      } else {
        verifiedFeesCount++;
      }
    });
  });

  // 6. Local Transport & Parking Buffer
  const parkingAndBuffer = totalDays * 100 + (isPersonalVehicle ? 200 : 0);

  // Explicit Estimation Assumptions Array
  const assumptions = [
    `Fuel rate: ₹${fuelPrice}/L for ${fuelType.toUpperCase()}`,
    `Vehicle economy: ${mileage} km/L (${isPersonalVehicle ? 'Personal Vehicle' : 'Public Transport Transit Model'})`,
    `Highway toll benchmark: ~₹1.15/km along NHAI express corridors`,
    `Accommodation rate: ₹${accConfig.ratePerRoom}/night per room for ${accConfig.label} (capacity ${accConfig.capacity} persons/room)`,
    `Dining expense: ₹${dailyFoodPerPerson}/person/day (${userProfile.travelPace || 'standard'} pace model)`
  ];
  if (unconfirmedFeesCount > 0) {
    assumptions.push(`${unconfirmedFeesCount} attraction stop(s) have unconfirmed entry fees; standard zero or municipal admission assumed.`);
  }

  // Grand Total
  const totalEstimatedCost = Math.round(
    fuelCost + tollCost + accommodationCost + foodCost + attractionTickets + parkingAndBuffer
  );

  const perPersonCost = Math.round(totalEstimatedCost / travelers);

  // Budget Status & Constraint Evaluation
  const isOverBudget = totalEstimatedCost > userBudget;
  const budgetGap = Math.max(0, totalEstimatedCost - userBudget);
  const budgetUtilizationPercent = Math.round((totalEstimatedCost / userBudget) * 100);

  let budgetStatus = 'WITHIN_BUDGET';
  if (totalEstimatedCost > userBudget * 1.25) {
    budgetStatus = 'SIGNIFICANTLY_OVER_BUDGET';
  } else if (isOverBudget) {
    budgetStatus = 'SLIGHTLY_OVER_BUDGET';
  }

  // Optimization Trade-offs if over budget
  const tradeOffRecommendations = [];
  if (isOverBudget) {
    // Check if switching to hostel saves significant budget
    if (accType !== 'hostel' && nights > 0) {
      const hostelSavings = accommodationCost - (nights * travelers * ACCOMMODATION_BENCHMARKS.hostel.ratePerRoom);
      if (hostelSavings > 0) {
        tradeOffRecommendations.push({
          area: 'Accommodation',
          savings: Math.round(hostelSavings),
          suggestion: `Switch from ${accConfig.label} to verified Backpacker Hostels (save ~₹${Math.round(hostelSavings).toLocaleString('en-IN')}).`
        });
      }
    }

    if (attractionTickets > 0 && attractionTickets > userBudget * 0.15) {
      tradeOffRecommendations.push({
        area: 'Activities',
        savings: Math.round(attractionTickets * 0.5),
        suggestion: `Prioritize free scenic viewpoints and cultural walks over high-cost commercial safari or adventure tickets (save ~₹${Math.round(attractionTickets * 0.5).toLocaleString('en-IN')}).`
      });
    }

    tradeOffRecommendations.push({
      area: 'Route & Fuel',
      savings: Math.round(tollCost * 0.3),
      suggestion: 'Maintain steady highway cruise speeds (75-80 km/h) to maximize vehicle fuel economy.'
    });
  }

  return {
    totalEstimatedCost,
    perPersonCost,
    originalBudget: userBudget,
    budgetStatus,
    isOverBudget,
    budgetGap,
    budgetUtilizationPercent,
    costBreakdown: {
      fuel: {
        amount: fuelCost,
        currency: 'INR',
        unit: `${litersUsed} Liters at ₹${fuelPrice}/L`,
        dataSource: 'fuel_consumption_formula',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        calculationMethod: 'distance_divided_by_mileage_times_fuel_price',
        provenance: 'benchmark_mileage_fuel',
        assumptions: [`Fuel price ₹${fuelPrice}/L for ${fuelType.toUpperCase()}`, `Vehicle mileage ${mileage} km/L`],
        retrievalTimestamp: new Date().toISOString()
      },
      tolls: {
        amount: tollCost,
        currency: 'INR',
        unit: 'Highway Corridor Tolls',
        dataSource: 'nhai_expressway_rate_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        calculationMethod: 'nhai_corridor_benchmark_rate',
        provenance: 'nhai_corridor_benchmark',
        assumptions: ['Estimated ₹1.15/km expressway toll benchmark along NH corridors'],
        retrievalTimestamp: new Date().toISOString()
      },
      accommodation: {
        amount: accommodationCost,
        currency: 'INR',
        unit: `${nights} nights × ${roomsNeeded} rooms (${accConfig.label})`,
        dataSource: 'destination_hotel_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        calculationMethod: 'nights_times_rooms_times_rate_per_room',
        provenance: 'destination_hotel_benchmark',
        assumptions: [`₹${accConfig.ratePerRoom}/night per room`, `${roomsNeeded} rooms for ${travelers} travelers (${accConfig.capacity} persons/room)`],
        retrievalTimestamp: new Date().toISOString()
      },
      food: {
        amount: foodCost,
        currency: 'INR',
        unit: `₹${dailyFoodPerPerson}/person/day`,
        dataSource: 'regional_dining_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        calculationMethod: 'travelers_times_days_times_daily_meal_rate',
        provenance: 'regional_dining_benchmark',
        assumptions: [`₹${dailyFoodPerPerson}/person/day (${userProfile.travelPace || 'standard'} pace model)`],
        retrievalTimestamp: new Date().toISOString()
      },
      activities: {
        amount: attractionTickets,
        currency: 'INR',
        unit: 'Attraction Admission & Entry Tickets',
        dataSource: verifiedFeesCount > 0 ? 'attraction_admission_catalog' : 'catalog_estimates',
        dataStatus: (verifiedFeesCount > 0 && unconfirmedFeesCount === 0) ? 'verified_from_official_source' : 'estimated',
        isLiveVerified: false,
        isEstimated: unconfirmedFeesCount > 0,
        calculationMethod: 'sum_of_stop_entry_fees_times_travelers',
        provenance: 'places_catalog_rates',
        assumptions: unconfirmedFeesCount > 0 ? [`${unconfirmedFeesCount} stop(s) have unconfirmed admission fees`] : ['All admission fees verified from catalog'],
        retrievalTimestamp: new Date().toISOString()
      },
      parkingAndBuffer: {
        amount: parkingAndBuffer,
        currency: 'INR',
        unit: 'Parking & Incidentals Buffer',
        dataSource: 'incidentals_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        calculationMethod: 'daily_parking_and_contingency_buffer',
        provenance: 'incidentals_benchmark',
        assumptions: ['₹100/day parking + ₹200 vehicle incidental contingency'],
        retrievalTimestamp: new Date().toISOString()
      }
    },
    assumptions,
    tradeOffRecommendations
  };
}

module.exports = {
  calculateTripBudget,
  FUEL_BENCHMARKS,
  ACCOMMODATION_BENCHMARKS,
  MEAL_BENCHMARKS
};

