/**
 * TravelTimeOptimizer
 * 
 * Module 7 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Computes traffic-aware travel durations between consecutive itinerary waypoints.
 * - Dynamically adjusts road speeds for expressways, rural highways, city centers, and hill ghats.
 * - Schedules chronologically unbroken timelines with arrival, visit duration, and departure times.
 * - Integrates timely meal halts (breakfast, lunch, dinner) and driver fatigue rest breaks.
 */

const { calculateHaversineDistanceKm } = require('./RouteDiscoveryEngine');
const { parseTimeToMinutes, formatMinutesTo12 } = require('./TravelContextBuilder');
const { resolveMatrixCell } = require('../RoadRoutingProvider');

// Base speed profiles by road and geographical terrain
const SPEED_PROFILES = {
  expressway: 75, // km/h (4-lane NH 44, NH 48, etc.)
  stateHighway: 55, // km/h (SH corridors)
  hillGhat: 34, // km/h (Western Ghats, Nilgiri, Himalayas, Eastern Ghats)
  urbanCity: 25 // km/h (Intra-city traffic)
};

/**
 * Calculates estimated driving minutes between two points with terrain and peak traffic adjustments.
 */
function calculateSegmentDrivingMinutes(fromCoord, toCoord, currentMinutes = 480, roadType = 'expressway') {
  const directKm = calculateHaversineDistanceKm(fromCoord, toCoord);
  if (directKm <= 0.5) return { distanceKm: 0, durationMinutes: 5 };

  // Road curvature factor
  const curvature = roadType === 'hillGhat' ? 1.35 : roadType === 'urbanCity' ? 1.25 : 1.20;
  const actualRoadKm = directKm * curvature;

  const baseSpeed = SPEED_PROFILES[roadType] || 65;

  // Peak traffic multiplier
  let trafficFactor = 1.0;
  const isMorningRush = currentMinutes >= 8 * 60 + 30 && currentMinutes <= 10 * 60 + 30;
  const isEveningRush = currentMinutes >= 17 * 60 + 30 && currentMinutes <= 20 * 60;
  if (isMorningRush || isEveningRush) {
    trafficFactor = roadType === 'urbanCity' ? 1.35 : 1.15;
  }

  const effectiveSpeed = baseSpeed / trafficFactor;
  const drivingMinutes = Math.round((actualRoadKm / effectiveSpeed) * 60);

  return {
    distanceKm: Math.round(actualRoadKm * 10) / 10,
    durationMinutes: Math.max(5, drivingMinutes)
  };
}

/**
 * Builds chronological timeline for a single day's stops including meals and rest breaks.
 */
function scheduleDayTimeline({
  dayNumber,
  date,
  startLocationName,
  startCoord,
  endLocationName,
  endCoord,
  stops = [],
  departureTimeStr = '07:30 AM',
  destinationCity = '',
  phaseLabel = '',
  isOnwardFinalArrival = false,
  isReturnFinalArrival = false,
  isReturnDay = false,
  travelerCount = 1,
  transitionMatrix = null,
  locationIndexMap = null
}) {
  const timeline = [];
  const isCorridorDay = phaseLabel === 'Onward Journey' || phaseLabel === 'Return Journey';
  let currentMinutes = parseTimeToMinutes(departureTimeStr);
  let currentCoord = startCoord;
  let totalDrivingMinutes = 0;
  let totalDrivingKm = 0;
  let totalActivityMinutes = 0;
  let accumulatedDrivingMinutesSinceBreak = 0;

  let hadBreakfast = currentMinutes > 9 * 60 + 30; // Already ate if departing late
  let hadLunch = false;
  let hadEveningTea = false;

  // 1. Initial Departure Entry
  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 15)}`,
    place: `Depart from ${startLocationName}`,
    category: 'travel',
    travelTime: '0 mins (0 km)',
    visitDuration: '15 mins',
    cost: '₹0',
    reason: isReturnDay
      ? `Commence comfortable return journey toward ${endLocationName}.`
      : `Morning departure toward scheduled attractions.`
  });
  currentMinutes += 15;

  // If departing very early (e.g. before 06:30 AM), plan a highway breakfast stop around 08:00 AM
  const needsEarlyBreakfastHalt = currentMinutes < 8 * 60;

  // Helper to insert breakfast
  const insertBreakfast = (hubName) => {
    if (hadBreakfast) return;
    const bDuration = 40;
    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + bDuration)}`,
      place: `Highway Breakfast Halt (Suggested Service Area Rest Halt - ${hubName || destinationCity || 'Corridor'})`,
      category: 'meal',
      travelTime: '0 mins',
      visitDuration: `${bDuration} mins`,
      cost: `₹${120 * travelerCount}`,
      isCostEstimated: true,
      calculationMethod: 'meal_benchmark_per_person',
      dataStatus: 'estimated',
      reason: 'Suggested service area breakfast stop and hot beverage to energize the morning.'
    });
    currentMinutes += bDuration;
    hadBreakfast = true;
  };

  const insertLunch = (hubName) => {
    if (hadLunch) return;
    const lDuration = 55;
    const lunchLocation = hubName || (isCorridorDay ? `${startLocationName} Corridor` : destinationCity || 'Sightseeing Corridor');
    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + lDuration)}`,
      place: `Regional Lunch Break (Suggested Service Area Halt - ${lunchLocation})`,
      category: 'meal',
      travelTime: '10 mins',
      visitDuration: `${lDuration} mins`,
      cost: `₹${200 * travelerCount}`,
      isCostEstimated: true,
      calculationMethod: 'meal_benchmark_per_person',
      dataStatus: 'estimated',
      reason: 'Suggested regional dining halt and relaxation before afternoon activities.'
    });
    currentMinutes += lDuration;
    hadLunch = true;
    accumulatedDrivingMinutesSinceBreak = 0;
  };

  // Iterate over stops
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const stopCoord = stop.coordinates || currentCoord;

    // Determine terrain
    const isHill = String(stop.category).includes('mountain') || String(stop.name).includes('Ghat') || String(destinationCity).toLowerCase().includes('manali') || String(destinationCity).toLowerCase().includes('munnar');
    const segDist = calculateHaversineDistanceKm(currentCoord, stopCoord);
    const roadType = isHill ? 'hillGhat' : (isCorridorDay || segDist > 45) ? 'expressway' : (segDist > 15 ? 'stateHighway' : 'urbanCity');

    // Calculate transit to this stop using authoritative transition matrix when available
    let transitDistKm = null;
    let effectiveTransitMinutes = null;
    let transitionDataSource = 'modeled_speed_curve_fallback';
    let transitionDataStatus = 'estimated';
    let isTransitionVerified = false;

    if (transitionMatrix) {
      const fromPoint = i === 0
        ? (startCoord ? { name: startLocationName, lat: startCoord.lat, lng: startCoord.lng } : startLocationName)
        : stops[i - 1];
      const toPoint = stop;
      const cell = resolveMatrixCell(transitionMatrix, fromPoint, toPoint, { allowFallbackEstimate: false });
      if (cell && cell.distanceKm !== null && cell.durationMinutes !== null && cell.dataStatus !== 'unavailable') {
        transitDistKm = cell.distanceKm;
        effectiveTransitMinutes = cell.durationMinutes;
        transitionDataSource = cell.dataSource || transitionDataSource;
        transitionDataStatus = cell.dataStatus || transitionDataStatus;
        isTransitionVerified = Boolean(cell.isLiveVerified);
      } else if (cell && (cell.dataStatus === 'unavailable' || cell.distanceKm === null)) {
        transitionDataSource = cell.dataSource || 'failed_provider_route';
        transitionDataStatus = 'unavailable';
        isTransitionVerified = false;
        transitDistKm = null;
        effectiveTransitMinutes = null;
      }
    }

    if (effectiveTransitMinutes === null && transitionDataStatus !== 'unavailable') {
      const detourKm = Number(stop.distanceFromRouteKm || 5);
      const detourMinutes = isCorridorDay ? Math.min(25, Math.max(8, Math.round((detourKm / 45) * 60))) : 0;
      const transit = calculateSegmentDrivingMinutes(currentCoord, stopCoord, currentMinutes, roadType);
      transitDistKm = transit.distanceKm;
      effectiveTransitMinutes = isCorridorDay ? Math.max(30, transit.durationMinutes + detourMinutes) : transit.durationMinutes;
      transitionDataSource = 'modeled_speed_curve_fallback';
      transitionDataStatus = 'estimated';
      isTransitionVerified = false;
    }

    if (effectiveTransitMinutes !== null) {
      totalDrivingKm += (transitDistKm || 0);
      totalDrivingMinutes += effectiveTransitMinutes;
      accumulatedDrivingMinutesSinceBreak += effectiveTransitMinutes;

      // Driver fatigue break on long continuous highway drives (>180 mins continuous transit without stop)
      if (effectiveTransitMinutes >= 180 && !hadLunch) {
        currentMinutes += 20;
        timeline.push({
          time: `${formatMinutesTo12(currentMinutes - 20)} – ${formatMinutesTo12(currentMinutes)}`,
          place: 'Highway Driver Rest Halt & Refreshment Break (Suggested Service Area Halt)',
          category: 'travel',
          travelTime: `${Math.round(effectiveTransitMinutes / 2)} mins highway transit`,
          visitDuration: '20 mins',
          cost: `₹${50 * travelerCount}`,
          isCostEstimated: true,
          calculationMethod: 'incidentals_benchmark',
          dataStatus: 'estimated',
          reason: 'Recommended 20-minute highway rest break to prevent driver fatigue after prolonged highway transit.'
        });
        accumulatedDrivingMinutesSinceBreak = 0;
      }

      currentMinutes += effectiveTransitMinutes;
    }

    // Breakfast halt (08:00 AM - 09:30 AM)
    if (!hadBreakfast && currentMinutes >= 8 * 60 && currentMinutes <= 10 * 60) {
      insertBreakfast(stop.city || startLocationName);
    }

    // Lunch halt (12:30 PM - 02:00 PM)
    if (!hadLunch && currentMinutes >= 12 * 60 + 30) {
      insertLunch(stop.city || (isCorridorDay ? startLocationName : destinationCity));
    }

    // Scheduled Tourist Attraction Activity: Visit duration priority hierarchy
    let visitDuration = 60;
    let durationSource = 'disclosed_category_estimate';
    let isDurationEstimated = true;
    if (stop.officialVisitDurationMinutes != null) {
      visitDuration = Number(stop.officialVisitDurationMinutes);
      durationSource = 'official_attraction_reported';
      isDurationEstimated = false;
    } else if (stop.verifiedDurationMinutes != null) {
      visitDuration = Number(stop.verifiedDurationMinutes);
      durationSource = 'verified_activity_catalog';
      isDurationEstimated = false;
    } else if (stop.estimatedVisitDurationMinutes != null) {
      visitDuration = Number(stop.estimatedVisitDurationMinutes);
      durationSource = 'disclosed_category_estimate';
      isDurationEstimated = true;
    } else if (stop.durationMinutes != null) {
      visitDuration = Number(stop.durationMinutes);
      durationSource = 'disclosed_category_estimate';
      isDurationEstimated = true;
    } else {
      visitDuration = 60;
      durationSource = 'disclosed_category_estimate';
      isDurationEstimated = true;
    }

    const stopArrivalStr = formatMinutesTo12(currentMinutes);
    const stopDepartureStr = formatMinutesTo12(currentMinutes + visitDuration);

    const rawFee = (stop.entryFee !== undefined && stop.entryFee !== null) ? Number(stop.entryFee) : null;
    const entryFeeVerified = Boolean(
      stop.isOfficialVerifiedFee ||
      stop.entryFeeVerifiedOfficial ||
      (stop.isFreeAdmissionVerified && rawFee === 0) ||
      (stop.isLiveVerified && rawFee !== null)
    );
    let costDisplay = 'Fee unconfirmed';
    if (rawFee !== null) {
      costDisplay = `₹${rawFee * travelerCount}`;
    }

    timeline.push({
      placeId: stop.placeId || null,
      name: stop.name,
      place: stop.name,
      coordinates: (stop.coordinates && (stop.coordinates.lat !== 0 || stop.coordinates.lng !== 0)) ? stop.coordinates : null,
      category: stop.category || 'sightseeing',
      taxonomyCategory: stop.taxonomyCategory || 'historical_cultural',
      time: `${stopArrivalStr} – ${stopDepartureStr}`,
      arrivalTime: stopArrivalStr,
      departureTime: stopDepartureStr,
      travelTime: transitionDataStatus === 'unavailable'
        ? 'Unavailable road transit'
        : `${effectiveTransitMinutes} mins (${transitDistKm} km road transit)`,
      distanceKm: transitDistKm,
      durationMinutes: effectiveTransitMinutes,
      visitDuration: `${visitDuration} mins`,
      visitDurationSource: durationSource,
      isDurationEstimated,
      cost: costDisplay,
      entryFee: rawFee,
      entryFeeVerified,
      rating: Number.isFinite(stop.rating) ? Number(stop.rating) : null,
      preferenceMatch: Number.isFinite(stop.preferenceMatch) ? Number(stop.preferenceMatch) : (Number.isFinite(stop.scoring?.preferenceMatch) ? Number(stop.scoring.preferenceMatch) : null),
      activities: stop.activities || [],
      dataSource: transitionDataSource,
      dataStatus: transitionDataStatus,
      isLiveVerified: isTransitionVerified,
      whySelected: stop.whySelected || stop.description || `Selected ${stop.category} landmark matching your travel preferences.`,
      reason: stop.description || stop.whySelected || `Selected ${stop.category} landmark matching your travel preferences.`
    });

    currentMinutes += visitDuration;
    totalActivityMinutes += visitDuration;
    currentCoord = stopCoord;
    accumulatedDrivingMinutesSinceBreak = 0; // Attraction visit resets driving fatigue

    // Check if Lunch halt should happen right after morning activities
    if (!hadLunch && currentMinutes >= 12 * 60 + 30 && currentMinutes <= 14 * 60 + 30) {
      insertLunch(stop.city || (isCorridorDay ? startLocationName : destinationCity));
    }
  }

  // If breakfast hasn't occurred yet and starting was early, insert it
  if (!hadBreakfast && currentMinutes <= 10 * 60) {
    insertBreakfast(startLocationName);
  }

  // If lunch hasn't occurred yet, advance to midday lunch window
  if (!hadLunch) {
    if (currentMinutes < 12 * 60) {
      currentMinutes = 12 * 60 + 30;
    }
    const defaultLunchCity = isCorridorDay ? (stops[0]?.city || startLocationName) : (destinationCity || endLocationName);
    insertLunch(defaultLunchCity);
  }

  // 3. Drive to End Location / Hotel Check-in
  let finalDistKm = 0;
  let finalDurationMins = 0;
  if (transitionMatrix) {
    const fromPoint = stops.length > 0
      ? stops[stops.length - 1]
      : (startCoord ? { name: startLocationName, lat: startCoord.lat, lng: startCoord.lng } : startLocationName);
    const toPoint = endCoord ? { name: endLocationName, lat: endCoord.lat, lng: endCoord.lng } : endLocationName;
    const cell = resolveMatrixCell(transitionMatrix, fromPoint, toPoint, { allowFallbackEstimate: false });
    if (cell && cell.distanceKm !== null && cell.durationMinutes !== null && cell.dataStatus !== 'unavailable') {
      finalDistKm = cell.distanceKm;
      finalDurationMins = cell.durationMinutes;
    }
  }

  if (finalDurationMins === 0) {
    const endDist = calculateHaversineDistanceKm(currentCoord, endCoord);
    const finalRoadType = (String(destinationCity).toLowerCase().includes('manali') || String(destinationCity).toLowerCase().includes('munnar')) ? 'hillGhat' : (isCorridorDay || endDist > 45) ? 'expressway' : (endDist > 15 ? 'stateHighway' : 'urbanCity');
    const finalTransit = calculateSegmentDrivingMinutes(currentCoord, endCoord, currentMinutes, finalRoadType);
    finalDistKm = finalTransit.distanceKm;
    finalDurationMins = finalTransit.durationMinutes;
  }

  totalDrivingKm += finalDistKm;
  totalDrivingMinutes += finalDurationMins;
  currentMinutes += finalDurationMins;

  // 4. Hotel Check-in & Evening Leisure (if arriving before 07:00 PM)
  if (currentMinutes < 19 * 60) {
    const eveningLeisureEnd = Math.min(19 * 60 + 30, Math.max(currentMinutes + 60, 18 * 60 + 30));
    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(eveningLeisureEnd)}`,
      place: `Hotel Check-in & Evening Leisure (${endLocationName})`,
      category: 'hotel',
      travelTime: `${finalDurationMins} mins (${finalDistKm} km transit)`,
      visitDuration: `${eveningLeisureEnd - currentMinutes} mins`,
      cost: '₹0',
      reason: `Check in to hotel, freshen up, and enjoy relaxed evening downtime in ${endLocationName}.`
    });
    currentMinutes = Math.max(eveningLeisureEnd, 19 * 60 + 30);
  }

  // 5. Dinner & Overnight Rest
  let hotelPlaceLabel = `Dinner & Overnight Stay at ${endLocationName}`;
  if (phaseLabel === 'Onward Journey') {
    if (!isOnwardFinalArrival) {
      hotelPlaceLabel = `Dinner & Intermediate Overnight Stay at budgetHotel (${endLocationName})`;
    } else {
      hotelPlaceLabel = `Dinner & Overnight Stay - Final Destination Arrival (${endLocationName})`;
    }
  } else if (phaseLabel === 'Return Journey' && isReturnFinalArrival) {
    hotelPlaceLabel = `Dinner & Return Arrival Home (${endLocationName})`;
  }

  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 75)}`,
    place: hotelPlaceLabel,
    category: 'hotel',
    travelTime: `${finalDurationMins} mins (${finalDistKm} km transit)`,
    visitDuration: 'Overnight Rest',
    cost: `₹${250 * travelerCount} (Dinner) + Hotel Room`,
    reason: `Arrival at day's destination hub (${endLocationName}). Settle in for dinner and overnight rest.`
  });
  currentMinutes += 75;

  return {
    timeline,
    totalDrivingKm: Math.round(totalDrivingKm * 10) / 10,
    totalDrivingMinutes,
    totalActivityMinutes,
    departureTime: departureTimeStr,
    arrivalTime: formatMinutesTo12(currentMinutes)
  };
}

module.exports = {
  calculateSegmentDrivingMinutes,
  scheduleDayTimeline,
  SPEED_PROFILES
};
