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
 * Explicit verification-state handler for attraction entry fees (Section 5 Master Prompt).
 * Returns one of: VERIFIED_OFFICIAL, PROVIDER_RETRIEVED, USER_PROVIDED, ESTIMATED, UNKNOWN.
 * A non-zero fee must NEVER be marked verified without authoritative evidence.
 */
function determineEntryFeeVerificationState(stop = {}) {
  if (stop.userProvidedFee !== undefined && stop.userProvidedFee !== null) {
    return {
      status: 'USER_PROVIDED',
      dataStatus: 'user_provided',
      fee: Number(stop.userProvidedFee),
      isConfirmed: true,
      isOfficialVerified: false,
      isLiveVerified: false,
      source: 'user_provided'
    };
  }
  if (stop.isOfficialVerifiedFee || stop.entryFeeVerifiedOfficial) {
    return {
      status: 'VERIFIED_OFFICIAL',
      dataStatus: 'verified_official',
      fee: Number(stop.entryFee || 0),
      isConfirmed: true,
      isOfficialVerified: true,
      isLiveVerified: false,
      source: stop.entryFeeSource || 'official_tourism_portal'
    };
  }
  if (stop.isFreeAdmissionVerified && (stop.entryFee === 0 || stop.entryFee === null || stop.entryFee === undefined)) {
    return {
      status: 'VERIFIED_OFFICIAL',
      dataStatus: 'verified_official',
      fee: 0,
      isConfirmed: true,
      isOfficialVerified: true,
      isLiveVerified: false,
      source: 'verified_public_free_admission'
    };
  }
  if (stop.isLiveVerified && stop.entryFee !== null && stop.entryFee !== undefined) {
    return {
      status: 'PROVIDER_RETRIEVED',
      dataStatus: 'provider_retrieved',
      fee: Number(stop.entryFee),
      isConfirmed: true,
      isOfficialVerified: false,
      isLiveVerified: true,
      source: 'places_provider_api'
    };
  }
  if (stop.entryFee !== null && stop.entryFee !== undefined && !isNaN(Number(stop.entryFee))) {
    return {
      status: 'ESTIMATED',
      dataStatus: 'estimated',
      fee: Number(stop.entryFee),
      isConfirmed: false,
      isOfficialVerified: false,
      isLiveVerified: false,
      source: 'catalog_or_historical_estimate'
    };
  }
  return {
    status: 'UNKNOWN',
    dataStatus: 'unknown',
    fee: null,
    isConfirmed: false,
    isOfficialVerified: false,
    isLiveVerified: false,
    source: null
  };
}

/**
 * Calculates itemized, mathematically verifiable trip cost.
 */
function calculateTripBudget({
  userProfile = {},
  routeInfo = {},
  dayPlans = []
}) {
  const travelers = Math.max(1, userProfile.numberOfTravelers || 1);
  const totalDays = Math.max(1, userProfile.totalDays || 1);
  const nights = Math.max(0, totalDays - 1);

  // User budget: Never fabricate default ₹25,000 if not specified by user!
  const rawBudget = userProfile.totalBudget !== undefined ? userProfile.totalBudget : (userProfile.budget !== undefined ? userProfile.budget : null);
  const userBudget = (rawBudget !== null && !isNaN(Number(rawBudget)) && Number(rawBudget) > 0) ? Number(rawBudget) : null;

  // Total driving distance: Never silently fabricate 500 km default!
  const dayPlanDist = (dayPlans || []).reduce((sum, d) => sum + (Number(d.totalDayDistanceKm) || 0), 0);
  const totalDistanceKm = dayPlanDist > 0
    ? dayPlanDist
    : (routeInfo.totalDistanceKm !== undefined && routeInfo.totalDistanceKm !== null ? Number(routeInfo.totalDistanceKm) : null);

  const unknownExpenseCategories = [];

  // 1. Fuel / Transportation Cost
  let fuelCost = null;
  let fuelDataStatus = 'unknown';
  let fuelUnit = 'Transportation Transit';
  let fuelCalculationMethod = null;
  let fuelProvenance = null;
  const isPersonalVehicle = userProfile.transportDetails?.isPersonalVehicle !== false &&
    userProfile.transportMode !== 'bus' &&
    userProfile.transportMode !== 'train' &&
    userProfile.transportMode !== 'flight';

  const rawFuelType = userProfile.vehicleDetails?.fuelType || userProfile.fuelType;
  const hasUserFuelType = Boolean(rawFuelType && String(rawFuelType).trim().length > 0);
  let fuelType = hasUserFuelType ? String(rawFuelType).toLowerCase().trim() : null;
  if (fuelType === 'ev') fuelType = 'electric';

  const rawUserFuelPrice = userProfile.vehicleDetails?.fuelPrice || userProfile.fuelPrice;
  const hasUserFuelPrice = rawUserFuelPrice !== undefined && rawUserFuelPrice !== null && !isNaN(Number(rawUserFuelPrice)) && Number(rawUserFuelPrice) > 0;
  const userSuppliedFuelPrice = hasUserFuelPrice ? Number(rawUserFuelPrice) : null;
  const effectiveFuelPrice = userSuppliedFuelPrice || (fuelType && FUEL_BENCHMARKS[fuelType] ? FUEL_BENCHMARKS[fuelType] : FUEL_BENCHMARKS.petrol);

  const userMileage = userProfile.vehicleDetails?.mileage || userProfile.vehicleMileage || userProfile.mileage;
  const hasUserMileage = userMileage !== undefined && userMileage !== null && !isNaN(Number(userMileage)) && Number(userMileage) > 0;
  const mileage = hasUserMileage ? Number(userMileage) : 15;

  const fuelAssumptions = [];

  if (totalDistanceKm === null) {
    fuelCost = null;
    fuelDataStatus = 'unknown';
    unknownExpenseCategories.push('fuel_and_transport');
    fuelAssumptions.push('Route distance is unavailable; fuel cost cannot be calculated.');
  } else if (isPersonalVehicle) {
    if (!hasUserFuelType) {
      unknownExpenseCategories.push('fuel_type');
      fuelAssumptions.push('Fuel type not specified by user; disclosed petrol benchmark used for estimation.');
    }
    if (!hasUserMileage) {
      unknownExpenseCategories.push('vehicle_mileage');
      fuelAssumptions.push('Vehicle mileage not specified by user; benchmark 15 km/L economy assumed.');
    }

    if (fuelType === 'electric') {
      const kwhUsed = Math.round((totalDistanceKm * 0.16) * 10) / 10;
      fuelCost = Math.round(kwhUsed * effectiveFuelPrice);
      fuelUnit = `${kwhUsed} kWh at ₹${effectiveFuelPrice}/kWh`;
      fuelCalculationMethod = 'distance_times_kwh_per_km_times_electricity_price';
      fuelProvenance = hasUserFuelPrice ? 'user_electricity_tariff' : 'electric_vehicle_consumption_benchmark';
      fuelDataStatus = hasUserFuelPrice ? 'user_provided' : 'estimated';
      fuelAssumptions.push(`EV electricity rate: ₹${effectiveFuelPrice}/kWh, 16 kWh/100km consumption rate.`);
    } else if (fuelType === 'cng') {
      const kgUsed = Math.round((totalDistanceKm / mileage) * 10) / 10;
      fuelCost = Math.round(kgUsed * effectiveFuelPrice);
      fuelUnit = `${kgUsed} kg CNG at ₹${effectiveFuelPrice}/kg`;
      fuelCalculationMethod = 'distance_divided_by_mileage_times_cng_price';
      fuelProvenance = hasUserFuelPrice ? 'user_cng_rate' : 'cng_consumption_benchmark';
      fuelDataStatus = hasUserFuelPrice ? 'user_provided' : 'estimated';
      fuelAssumptions.push(`CNG rate: ₹${effectiveFuelPrice}/kg, economy ${mileage} km/kg.`);
    } else {
      const effType = fuelType || 'petrol';
      const litersUsed = Math.round((totalDistanceKm / mileage) * 10) / 10;
      fuelCost = Math.round(litersUsed * effectiveFuelPrice);
      fuelUnit = `${litersUsed} Liters at ₹${effectiveFuelPrice}/L`;
      fuelCalculationMethod = 'distance_divided_by_mileage_times_fuel_price';
      fuelProvenance = hasUserFuelPrice
        ? 'user_fuel_price'
        : (hasUserMileage ? 'user_mileage_and_fuel_benchmark' : 'benchmark_mileage_and_fuel');
      fuelDataStatus = hasUserFuelPrice ? 'user_provided' : 'estimated';
      fuelAssumptions.push(`Fuel rate: ₹${effectiveFuelPrice}/L for ${effType.toUpperCase()} (${hasUserFuelPrice ? 'User-provided price' : 'Benchmark rate, no live retrieval'}).`);
    }
  } else {
    // Public transport fares
    const perPersonTransit = Math.round(totalDistanceKm * 1.25);
    fuelCost = perPersonTransit * travelers;
    fuelUnit = `Public transit tickets (${travelers} travelers)`;
    fuelCalculationMethod = 'distance_times_transit_rate_times_travelers';
    fuelProvenance = 'public_transit_benchmark';
    fuelDataStatus = 'estimated';
    fuelAssumptions.push(`Public transport transit model: ~₹1.25/km/person across scheduled corridor.`);
  }

  // 2. Highway Tolls
  let tollCost = null;
  let tollDataStatus = 'unknown';
  const tollAssumptions = [];
  if (totalDistanceKm === null) {
    tollCost = null;
    tollDataStatus = 'unknown';
    unknownExpenseCategories.push('highway_tolls');
    tollAssumptions.push('Route distance unavailable; toll expenses cannot be calculated.');
  } else if (isPersonalVehicle && userProfile.vehicleDetails?.vehicleType !== 'bike') {
    if (routeInfo.totalTolls !== undefined && routeInfo.totalTolls !== null) {
      tollCost = Math.round(Number(routeInfo.totalTolls));
      tollDataStatus = 'provider_retrieved';
      tollAssumptions.push(`Highway toll plazas identified along route corridor.`);
    } else {
      tollCost = Math.round(totalDistanceKm * 1.15); // Average NHAI 4-lane rate
      tollDataStatus = 'estimated';
      tollAssumptions.push(`Highway toll benchmark: ~₹1.15/km along NHAI express corridors (Benchmark estimate).`);
    }
  } else {
    tollCost = 0;
    tollDataStatus = 'exact_zero';
    tollAssumptions.push('No tolls applicable for bikes or public transit.');
  }

  // 3. Accommodation Cost (Based on room capacity and night count)
  const accType = userProfile.accommodationPreference || (userProfile.travelCompanionType === 'solo' ? 'hostel' : 'budgetHotel');
  const accConfig = ACCOMMODATION_BENCHMARKS[accType] || ACCOMMODATION_BENCHMARKS.budgetHotel;
  const roomsNeeded = Math.ceil(travelers / (accConfig.capacity || 2));
  const accommodationCost = nights * roomsNeeded * accConfig.ratePerRoom;

  // 4. Food & Dining Cost
  const mealRate = MEAL_BENCHMARKS[userProfile.travelPace === 'relaxed' ? 'premium' : 'standard'] || MEAL_BENCHMARKS.standard;
  const dailyFoodPerPerson = mealRate.breakfast + mealRate.lunch + mealRate.dinner;
  const foodCost = totalDays * travelers * dailyFoodPerPerson;

  // 5. Entry Tickets & Activity Fees (5-Tier Verification State)
  let verifiedFeesSubtotal = 0;
  let estimatedFeesSubtotal = 0;
  let verifiedFeesCount = 0;
  let estimatedFeesCount = 0;
  let unknownFeesCount = 0;

  dayPlans.forEach(d => {
    (d.stops || []).forEach(s => {
      const state = determineEntryFeeVerificationState(s);
      s.entryFeeVerificationState = state.status;
      if (state.status === 'VERIFIED_OFFICIAL' || state.status === 'PROVIDER_RETRIEVED' || state.status === 'USER_PROVIDED') {
        verifiedFeesSubtotal += (state.fee || 0) * travelers;
        verifiedFeesCount++;
      } else if (state.status === 'ESTIMATED') {
        estimatedFeesSubtotal += (state.fee || 0) * travelers;
        estimatedFeesCount++;
      } else {
        unknownFeesCount++;
      }
    });
  });

  const totalAttractionTickets = verifiedFeesSubtotal + estimatedFeesSubtotal;
  if (unknownFeesCount > 0) {
    unknownExpenseCategories.push('attraction_entry_fees');
  }

  // 6. Local Transport & Parking Buffer
  const parkingAndBuffer = totalDays * 100 + (isPersonalVehicle ? 200 : 0);

  // Assumptions list
  const assumptions = [
    ...fuelAssumptions,
    ...tollAssumptions,
    `Accommodation rate: ₹${accConfig.ratePerRoom}/night per room for ${accConfig.label} (Benchmark rate, no live booking rate)`,
    `Dining expense: ₹${dailyFoodPerPerson}/person/day (${userProfile.travelPace || 'standard'} pace model)`
  ];
  if (unknownFeesCount > 0) {
    assumptions.push(`${unknownFeesCount} attraction stop(s) have unknown/unconfirmed entry fees; not treated as free admission.`);
  }

  // Subtotals and Grand Total Reconciliation
  const confirmedSubtotal = verifiedFeesSubtotal;
  const safeFuelCost = fuelCost !== null ? fuelCost : 0;
  const safeTollCost = tollCost !== null ? tollCost : 0;
  const estimatedSubtotal = Math.round(safeFuelCost + safeTollCost + accommodationCost + foodCost + estimatedFeesSubtotal + parkingAndBuffer);
  const totalEstimatedCost = confirmedSubtotal + estimatedSubtotal;
  const perPersonCost = Math.round(totalEstimatedCost / travelers);

  // Uncertainty band for unknown fees (assumed ₹150–₹300 per unknown attraction)
  const unknownBufferMax = unknownFeesCount * 300 * travelers;
  const finalEstimatedTripRange = {
    min: Math.round(totalEstimatedCost * 0.95),
    max: Math.round((totalEstimatedCost + unknownBufferMax) * 1.10),
    mostLikely: totalEstimatedCost
  };

  // Budget Status & Constraint Evaluation
  let isOverBudget = null;
  let budgetGap = null;
  let budgetVariance = null;
  let budgetUtilizationPercent = null;
  let budgetStatus = 'INSUFFICIENT_DATA';

  const budgetDecisionUncertainty = unknownExpenseCategories.length > 0 || (userBudget !== null && totalEstimatedCost + unknownBufferMax > userBudget);

  if (userBudget === null) {
    budgetStatus = 'INSUFFICIENT_DATA';
    isOverBudget = null;
    budgetGap = null;
    budgetVariance = null;
    budgetUtilizationPercent = null;
  } else {
    isOverBudget = totalEstimatedCost > userBudget;
    budgetGap = Math.max(0, totalEstimatedCost - userBudget);
    budgetVariance = totalEstimatedCost - userBudget;
    budgetUtilizationPercent = Math.round((totalEstimatedCost / userBudget) * 100);

    if (totalEstimatedCost > userBudget * 1.25) {
      budgetStatus = 'SIGNIFICANTLY_OVER_BUDGET';
    } else if (isOverBudget) {
      budgetStatus = 'OVER_BUDGET';
    } else if (budgetDecisionUncertainty && totalEstimatedCost + unknownBufferMax > userBudget) {
      budgetStatus = 'UNCERTAIN_BUDGET';
    } else {
      budgetStatus = 'WITHIN_BUDGET';
    }
  }

  // Optimization Trade-offs if over budget
  const tradeOffRecommendations = [];
  if (isOverBudget && userBudget !== null) {
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

    if (totalAttractionTickets > 0 && totalAttractionTickets > userBudget * 0.15) {
      tradeOffRecommendations.push({
        area: 'Activities',
        savings: Math.round(totalAttractionTickets * 0.5),
        suggestion: `Prioritize free scenic viewpoints and cultural walks over high-cost commercial safari or adventure tickets (save ~₹${Math.round(totalAttractionTickets * 0.5).toLocaleString('en-IN')}).`
      });
    }

    if (safeTollCost > 0) {
      tradeOffRecommendations.push({
        area: 'Route & Fuel',
        savings: Math.round(safeTollCost * 0.3),
        suggestion: 'Maintain steady highway cruise speeds (75-80 km/h) to maximize vehicle fuel economy.'
      });
    }
  }

  let activityStatus = 'estimated';
  if (verifiedFeesCount > 0 && estimatedFeesCount === 0 && unknownFeesCount === 0) {
    activityStatus = 'verified_official';
  } else if (unknownFeesCount > 0) {
    activityStatus = 'unknown';
  }

  return {
    totalEstimatedCost,
    confirmedSubtotal,
    estimatedSubtotal,
    unknownExpenseCategories,
    finalEstimatedTripRange,
    budgetDecisionUncertainty,
    perPersonCost,
    perPersonEstimate: perPersonCost,
    originalBudget: userBudget,
    userBudget,
    budgetVariance,
    budgetStatus,
    isOverBudget,
    budgetGap,
    budgetUtilizationPercent,
    costBreakdown: {
      fuel: {
        amount: fuelCost,
        currency: 'INR',
        unit: fuelUnit,
        fuelType: hasUserFuelType ? fuelType : 'unknown',
        isFuelTypeEstimated: !hasUserFuelType,
        fuelPrice: effectiveFuelPrice,
        fuelPriceStatus: hasUserFuelPrice ? 'user_provided' : 'estimated_benchmark',
        mileage: hasUserMileage ? mileage : null,
        isMileageEstimated: !hasUserMileage,
        mileageStatus: hasUserMileage ? 'user_provided' : 'estimated_benchmark',
        dataSource: hasUserFuelPrice ? 'user_specified_rate' : (isPersonalVehicle ? 'fuel_consumption_formula' : 'public_transit_rate_model'),
        dataStatus: fuelDataStatus,
        isLiveVerified: false,
        isBenchmark: !hasUserFuelPrice,
        isUserProvided: hasUserFuelPrice,
        isEstimated: fuelDataStatus === 'estimated',
        calculationMethod: fuelCalculationMethod,
        provenance: fuelProvenance,
        assumptions: fuelAssumptions,
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: fuelCost !== null ? 0.85 : 0
      },
      tolls: {
        amount: tollCost,
        currency: 'INR',
        unit: 'Highway Corridor Tolls',
        dataSource: 'nhai_expressway_rate_benchmark',
        dataStatus: tollDataStatus,
        isLiveVerified: false,
        isEstimated: tollDataStatus === 'estimated',
        isBenchmark: true,
        calculationMethod: 'nhai_corridor_benchmark_rate',
        provenance: 'nhai_corridor_benchmark',
        assumptions: tollAssumptions,
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: tollCost !== null ? 0.80 : 0
      },
      accommodation: {
        amount: accommodationCost,
        currency: 'INR',
        unit: `${nights} nights × ${roomsNeeded} rooms (${accConfig.label})`,
        dataSource: 'destination_hotel_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        isBenchmark: true,
        calculationMethod: 'nights_times_rooms_times_rate_per_room',
        provenance: 'destination_hotel_benchmark',
        assumptions: [`₹${accConfig.ratePerRoom}/night per room`, `${roomsNeeded} rooms for ${travelers} travelers (${accConfig.capacity} persons/room)`],
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: 0.80
      },
      food: {
        amount: foodCost,
        currency: 'INR',
        unit: `₹${dailyFoodPerPerson}/person/day`,
        dataSource: 'regional_dining_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        isBenchmark: true,
        calculationMethod: 'travelers_times_days_times_daily_meal_rate',
        provenance: 'regional_dining_benchmark',
        assumptions: [`₹${dailyFoodPerPerson}/person/day (${userProfile.travelPace || 'standard'} pace model)`],
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: 0.85
      },
      meals: {
        amount: foodCost,
        currency: 'INR',
        unit: `₹${dailyFoodPerPerson}/person/day`,
        dataSource: 'regional_dining_benchmark',
        dataStatus: 'estimated',
        isLiveVerified: false,
        isEstimated: true,
        isBenchmark: true,
        calculationMethod: 'travelers_times_days_times_daily_meal_rate',
        provenance: 'regional_dining_benchmark',
        assumptions: [`₹${dailyFoodPerPerson}/person/day (${userProfile.travelPace || 'standard'} pace model)`],
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: 0.85
      },
      activities: {
        amount: totalAttractionTickets,
        currency: 'INR',
        unit: 'Attraction Admission & Entry Tickets',
        dataSource: verifiedFeesCount > 0 ? 'attraction_admission_catalog' : 'catalog_estimates',
        dataStatus: activityStatus,
        isLiveVerified: activityStatus === 'verified_official',
        isEstimated: estimatedFeesCount > 0 || unknownFeesCount > 0,
        calculationMethod: 'sum_of_stop_entry_fees_times_travelers',
        provenance: 'places_catalog_rates',
        assumptions: unknownFeesCount > 0
          ? [`${unknownFeesCount} stop(s) have unconfirmed admission fees; not treated as free admission`]
          : (estimatedFeesCount > 0 ? [`${estimatedFeesCount} stop(s) use catalog benchmark fee estimates`] : ['All admission fees verified from official source']),
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: unknownFeesCount === 0 ? 0.90 : 0.60
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
        retrievalTimestamp: null,
        retrievedAt: null,
        applicableDate: null,
        confidence: 0.75
      }
    },
    assumptions,
    tradeOffRecommendations
  };
}

module.exports = {
  calculateTripBudget,
  determineEntryFeeVerificationState,
  FUEL_BENCHMARKS,
  ACCOMMODATION_BENCHMARKS,
  MEAL_BENCHMARKS
};

