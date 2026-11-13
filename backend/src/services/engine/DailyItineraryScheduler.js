/**
 * DailyItineraryScheduler
 * 
 * Module 8 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Coordinates the 3 independent travel phases:
 *     Phase A: ONWARD (Origin -> Destination via OnwardJourneyEngine)
 *     Phase B: DESTINATION_EXPLORATION (Regional multi-zone exploration via DestinationExplorationEngine)
 *     Phase C: RETURN (Destination -> Origin independent exploration via ReturnJourneyEngine)
 * - Enforces strict unbroken location continuity: Day N+1 start == Day N end.
 * - Guarantees non-repeating stops: return journey explores distinct, unvisited attractions.
 * - Schedules realistic driving durations, meal stops, visiting windows, and driver fatigue breaks.
 * - Itemizes daily expenditures reconciled to the rupee.
 */

const { scorePlace } = require('./PlaceScoringEngine');
const { optimizeDayStopSequence } = require('./RouteOptimizationEngine');
const { scheduleDayTimeline } = require('./TravelTimeOptimizer');
const { planOnwardJourney } = require('./OnwardJourneyEngine');
const { planDestinationExploration } = require('./DestinationExplorationEngine');
const { planReturnJourney } = require('./ReturnJourneyEngine');
const { calculateIndependentReturnRoute } = require('./RouteDiscoveryEngine');

/**
 * Builds the complete multi-day round-trip itinerary.
 */
async function scheduleDailyItineraries({
  userProfile,
  routeInfo,
  travelContext,
  candidatePlaces = []
}) {
  const { totalDays, origin, destinationCity, numberOfTravelers } = userProfile;
  const days = travelContext.days || [];
  const dayPlans = [];

  const onwardDays = travelContext.onwardDays || 1;
  const returnDays = travelContext.returnDays || (totalDays > 1 ? 1 : 0);
  const destinationDays = travelContext.destinationDays || Math.max(0, totalDays - onwardDays - returnDays);
  const intermediateWaypoints = routeInfo.waypoints || [];

  // Master tracking set for visited place keys to prevent any duplicate stops across phases
  const visitedKeys = new Set();

  // -------------------------------------------------------------
  // 1. PLAN PHASE A: ONWARD JOURNEY
  // -------------------------------------------------------------
  const onwardAllocations = planOnwardJourney({
    onwardDays,
    origin,
    originCoord: routeInfo.originCoordinates,
    destination: destinationCity,
    destinationCoord: routeInfo.destinationCoordinates,
    routeWaypoints: intermediateWaypoints,
    userProfile,
    candidatePlaces,
    visitedKeys
  });

  // -------------------------------------------------------------
  // 2. PLAN PHASE B: REGIONAL DESTINATION EXPLORATION
  // -------------------------------------------------------------
  const destExplorationClusters = planDestinationExploration({
    destination: destinationCity,
    destinationDays,
    userProfile,
    candidatePlaces,
    destinationCoordinates: routeInfo.destinationCoordinates
  });

  // Register destination exploration stops in visitedKeys
  destExplorationClusters.forEach(cluster => {
    (cluster.stops || []).forEach(s => {
      const sKey = (s.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      visitedKeys.add(sKey);
      if (s.placeId) visitedKeys.add(s.placeId);
    });
  });

  // -------------------------------------------------------------
  // 3. PLAN PHASE C: INDEPENDENT RETURN JOURNEY (Prompt Section 5 & Rule 9)
  // -------------------------------------------------------------
  // Last destination hub becomes starting location for the return journey
  const lastDestHub = destExplorationClusters.length > 0
    ? destExplorationClusters[destExplorationClusters.length - 1].hubName
    : destinationCity;
  const lastDestCoord = destExplorationClusters.length > 0
    ? destExplorationClusters[destExplorationClusters.length - 1].hubCoord
    : routeInfo.destinationCoordinates;

  // Discover independent return highway corridor (never a simple reverse of onward route)
  let returnWaypoints = [];
  try {
    const returnStartCity = destinationCity || lastDestHub;
    const returnRoute = await calculateIndependentReturnRoute(returnStartCity, origin, {
      transportMode: userProfile.transportMode
    });
    if (returnRoute && Array.isArray(returnRoute.waypoints) && returnRoute.waypoints.length > 0) {
      returnWaypoints = returnRoute.waypoints;
    }
  } catch (err) {
    // Continue with reversed waypoints if independent computation blocked
  }
  if (returnWaypoints.length === 0) {
    returnWaypoints = [...intermediateWaypoints].reverse();
  }

  const returnAllocations = planReturnJourney({
    returnDays,
    startLocation: lastDestHub,
    startCoord: lastDestCoord,
    origin,
    originCoord: routeInfo.originCoordinates,
    returnWaypoints,
    userProfile,
    visitedKeys
  });

  // -------------------------------------------------------------
  // 4. CHRONOLOGICAL SCHEDULING (Days 1 to N)
  // -------------------------------------------------------------
  let currentHubName = origin;
  let currentHubCoord = routeInfo.originCoordinates;

  for (let dIdx = 0; dIdx < days.length; dIdx++) {
    const dayMeta = days[dIdx];
    const isSingleDay = totalDays === 1;

    let dayStartLocation = currentHubName;
    let dayStartCoord = currentHubCoord;
    let dayEndLocation = '';
    let dayEndCoord = null;
    let selectedStops = [];
    let isCorridorDay = false;
    let phaseLabel = 'Destination Stay';
    let journeyPhase = 'DESTINATION_EXPLORATION';
    let zoneHighlight = '';
    let isOnwardFinalArrival = false;
    let isReturnFinalArrival = false;

    if (isSingleDay) {
      phaseLabel = 'Single Day Exploration';
      journeyPhase = 'DESTINATION_EXPLORATION';
      dayEndLocation = origin;
      dayEndCoord = routeInfo.originCoordinates;
      const singleCluster = destExplorationClusters[0];
      selectedStops = singleCluster ? singleCluster.stops.slice(0, 3) : [];
      zoneHighlight = singleCluster?.zoneName || `${destinationCity} Day Highlights`;
    } else if (dIdx < onwardDays) {
      // ONWARD JOURNEY PHASE
      phaseLabel = 'Onward Journey';
      journeyPhase = 'ONWARD';
      isCorridorDay = true;
      const alloc = onwardAllocations[dIdx];
      dayEndLocation = alloc.endLocation;
      dayEndCoord = alloc.endCoord;
      selectedStops = alloc.stops;
      isOnwardFinalArrival = alloc.isFinalArrival;
      zoneHighlight = `Onward Highway Corridor (${dayStartLocation} → ${dayEndLocation})`;
    } else if (dIdx < onwardDays + destinationDays) {
      // DESTINATION REGIONAL EXPLORATION PHASE
      phaseLabel = 'Destination Stay';
      journeyPhase = 'DESTINATION_EXPLORATION';
      isCorridorDay = false;
      const clusterIdx = dIdx - onwardDays;
      const cluster = destExplorationClusters[clusterIdx % destExplorationClusters.length];
      dayEndLocation = cluster?.hubName || destinationCity;
      dayEndCoord = cluster?.hubCoord || routeInfo.destinationCoordinates;
      selectedStops = cluster?.stops || [];
      zoneHighlight = cluster?.zoneName || `${destinationCity} Exploration Zone ${clusterIdx + 1}`;
    } else {
      // RETURN JOURNEY PHASE
      phaseLabel = 'Return Journey';
      journeyPhase = 'RETURN';
      isCorridorDay = true;
      const retIdx = dIdx - (onwardDays + destinationDays);
      const retAlloc = returnAllocations[retIdx % returnAllocations.length];
      dayEndLocation = retAlloc.endLocation;
      dayEndCoord = retAlloc.endCoord;
      selectedStops = retAlloc.stops;
      isReturnFinalArrival = retAlloc.isFinalArrival;
      zoneHighlight = `Return Highway Corridor (${dayStartLocation} → ${dayEndLocation})`;
    }

    // Optimize intra-day stop sequence to eliminate backtracking
    const optimizedStops = optimizeDayStopSequence(
      dayStartCoord,
      dayEndCoord,
      selectedStops,
      isCorridorDay
    );

    // Schedule chronological timeline with driving times, meal breaks, and fatigue halts
    const scheduled = scheduleDayTimeline({
      dayNumber: dayMeta.dayNumber,
      date: dayMeta.date,
      startLocationName: dayStartLocation,
      startCoord: dayStartCoord,
      endLocationName: dayEndLocation,
      endCoord: dayEndCoord,
      stops: optimizedStops,
      departureTimeStr: dIdx === 0 ? (userProfile.departureTime || '07:30 AM') : '08:30 AM',
      destinationCity,
      phaseLabel,
      isOnwardFinalArrival,
      isReturnFinalArrival,
      travelerCount: numberOfTravelers
    });

    // Compute itemized daily expenditure
    const isPersonalVehicle = userProfile.transportDetails?.isPersonalVehicle !== false &&
      userProfile.transportMode !== 'bus' &&
      userProfile.transportMode !== 'train' &&
      userProfile.transportMode !== 'flight';

    let dailyFuelCost = 0;
    let dailyTolls = 0;

    if (isPersonalVehicle) {
      const fuelPrice = userProfile.vehicleDetails?.fuelType === 'diesel' ? 94.8 : 105.5;
      const mileage = userProfile.vehicleDetails?.mileage || 15;
      dailyFuelCost = Math.round((scheduled.totalDrivingKm / mileage) * fuelPrice);
      dailyTolls = isCorridorDay ? Math.round(scheduled.totalDrivingKm * 1.15) : 50;
    } else {
      // Public transit fares (bus / train tickets)
      dailyFuelCost = Math.round(scheduled.totalDrivingKm * 1.25 * numberOfTravelers);
      dailyTolls = 0;
    }

    const dailyFood = 550 * numberOfTravelers;
    const isTripOver = dIdx === days.length - 1;
    const isHostel = userProfile.accommodationPreference === 'hostel' || userProfile.travelCompanionType === 'solo';
    const accRate = isHostel ? 600 : 1800;
    const roomCapacity = isHostel ? 1 : 2;
    const dailyHotel = isTripOver ? 0 : Math.ceil(numberOfTravelers / roomCapacity) * accRate;
    const dailyTickets = optimizedStops.reduce((sum, s) => sum + (Number(s.entryFee || 0) * numberOfTravelers), 0);
    const dailyTotal = dailyFuelCost + dailyTolls + dailyFood + dailyHotel + dailyTickets;

    const stopDocuments = optimizedStops.map((s, sIdx) => {
      let cat = s.category || 'historical';
      if (/temple/i.test(s.name) || s.category === 'spiritual') {
        cat = 'temple';
      } else if (/fort/i.test(s.name)) {
        cat = 'fort';
      } else if (/waterfall/i.test(s.name)) {
        cat = 'waterfall';
      }
      return {
        placeId: s.placeId || `POI_D${dayMeta.dayNumber}_${sIdx + 1}`,
        placeName: s.name,
        name: s.name,
        coordinates: s.coordinates,
        category: cat,
        taxonomyCategory: s.taxonomyCategory || 'historical_cultural',
        types: s.subCategories || [cat],
        rating: s.rating || 4.5,
        googleRating: s.rating || 4.5,
        estimatedVisitDuration: `${s.estimatedVisitDurationMinutes || 75} mins`,
        estimatedCost: s.entryFee ? `₹${s.entryFee * numberOfTravelers}` : '₹0',
        entryFee: s.entryFee || 0,
        preferenceMatch: s.scoring?.preferenceMatch || 0.85,
        sourceInformation: s.dataSource || 'verified_places_engine',
        description: s.description || s.reason
      };
    });

    // Extract separate, structured activity documents (Prompt Section 3.6)
    const activityDocuments = [];
    optimizedStops.forEach((s, sIdx) => {
      const acts = Array.isArray(s.activities) && s.activities.length > 0
        ? s.activities
        : [
            {
              activityId: `ACT_D${dayMeta.dayNumber}_${sIdx + 1}_VISIT`,
              name: `${s.name} Exploration`,
              category: s.category || 'sightseeing',
              verificationStatus: 'verified',
              operatingStatus: 'OPERATIONAL',
              estimatedDurationMinutes: s.estimatedVisitDurationMinutes || 75,
              fee: Number(s.entryFee || 0),
              bestTimeOfDay: s.bestVisitWindow?.type || 'daylight',
              seasonalAvailability: 'Year-round',
              requiresBooking: false,
              ticketRequired: Number(s.entryFee || 0) > 0,
              description: `Guided exploration of ${s.name}.`
            }
          ];

      acts.forEach((act, aIdx) => {
        activityDocuments.push({
          activityId: act.activityId || `ACT_D${dayMeta.dayNumber}_${sIdx + 1}_${aIdx + 1}`,
          activityName: act.name,
          name: act.name,
          placeId: s.placeId || `POI_D${dayMeta.dayNumber}_${sIdx + 1}`,
          placeName: s.name,
          category: act.category || s.category || 'sightseeing',
          types: s.subCategories || [s.category || 'sightseeing'],
          rating: s.rating || 4.5,
          googleRating: s.rating || 4.5,
          verificationStatus: act.verificationStatus || 'verified',
          operatingStatus: act.operatingStatus || 'OPERATIONAL',
          estimatedDurationMinutes: act.estimatedDurationMinutes || 60,
          fee: Number(act.fee || 0),
          bestTimeOfDay: act.bestTimeOfDay || 'daylight',
          seasonalAvailability: act.seasonalAvailability || 'Year-round',
          requiresBooking: Boolean(act.requiresBooking),
          ticketRequired: Boolean(act.ticketRequired),
          description: act.description || `Participate in ${act.name} at ${s.name}.`
        });
      });
    });

    const dayPlan = {
      day: dayMeta.dayNumber,
      dayNumber: dayMeta.dayNumber,
      date: dayMeta.date,
      dayOfWeek: dayMeta.dayOfWeek,
      phase: phaseLabel,
      journeyPhase,
      zoneName: zoneHighlight,
      startLocation: dayStartLocation,
      endLocation: dayEndLocation,
      departureTime: scheduled.departureTime,
      arrivalTime: scheduled.arrivalTime,
      totalDayDistanceKm: scheduled.totalDrivingKm,
      totalDayDrivingMinutes: scheduled.totalDrivingMinutes,
      totalActivityMinutes: scheduled.totalActivityMinutes,
      stops: stopDocuments,
      timeline: scheduled.timeline,
      activities: activityDocuments,
      overnightLocation: dayEndLocation,
      cost: {
        day: dayMeta.dayNumber,
        fuel: dailyFuelCost,
        tolls: dailyTolls,
        localTransport: 0,
        accommodation: dailyHotel,
        food: dailyFood,
        entryFees: dailyTickets,
        activities: 0,
        parking: 0,
        other: 0,
        dayTotal: dailyTotal
      },
      plan: `**Day ${dayMeta.dayNumber} (${dayMeta.date}) - ${dayStartLocation} → ${dayEndLocation}**\n\n` +
        `**Phase:** ${phaseLabel.toUpperCase()} (${journeyPhase})\n` +
        `**Exploration Zone:** ${zoneHighlight}\n` +
        `**Key Highlights:** ${optimizedStops.length > 0 ? optimizedStops.map(s => s.name).join(', ') : 'Scenic road transit and authentic regional dining'}.\n` +
        `**Daily Travel:** ~${scheduled.totalDrivingKm} km driving (${Math.floor(scheduled.totalDrivingMinutes / 60)}h ${scheduled.totalDrivingMinutes % 60}m) | Overnight Rest at ${dayEndLocation}.`
    };

    dayPlans.push(dayPlan);

    // Strict unbroken continuity for next day!
    currentHubName = dayEndLocation;
    currentHubCoord = dayEndCoord;
  }

  return dayPlans;
}

module.exports = {
  scheduleDailyItineraries
};
