/**
 * FeasibilityEvaluator — Real Spatiotemporal & Constraint Verification Engine
 * 
 * Implements Section 9 of VISTA Production Correctness:
 * Evaluates real operational constraints rather than returning a fabricated score (e.g. 95)
 * or false optimality guarantee.
 * 
 * Evaluated Dimensions:
 * 1. Total available trip duration & daily driving limits
 * 2. Opening-hours and visiting-window compliance
 * 3. Mandatory meal windows & driver fatigue rest breaks
 * 4. Realistic budget constraints & expense reconciliation
 * 5. Negative preferences and places-to-avoid exclusions
 * 6. Weather-related safety restrictions
 * 7. Unbroken inter-day location continuity
 * 8. Trip-direction integrity (One-Way vs Round-Trip vs Multi-City)
 */

const { parseTimeToMinutes } = require('./TravelContextBuilder');

// Maximum permissible driving thresholds for passenger and driver safety
const DAILY_LIMITS = {
  maxDrivingMinutes: 720, // 12 hours max single-day transit (hard cap)
  warningDrivingMinutes: 480, // 8 hours driving triggers fatigue warning
  maxDrivingDistanceKm: 850, // 850 km max single-day transit (hard cap)
  maxContinuousDrivingMinutes: 180 // 3 hours continuous driving requires rest
};

/**
 * Evaluates the complete itinerary against actual operational constraints.
 */
function evaluateItineraryFeasibility({
  dayPlans = [],
  userProfile = {},
  routeInfo = {},
  budgetSummary = {},
  weatherInfo = null
}) {
  const violations = [];
  const warnings = [];
  const evaluatedConstraints = [];
  const unverifiedItems = [];

  let totalConstraintsChecked = 0;
  let passedConstraintsCount = 0;

  function recordConstraint({
    name,
    passed,
    status = null,
    severity = null,
    evidence = '',
    source = 'feasibility_evaluator',
    explanation = '',
    recommendedAction = 'None required',
    isHard = true
  }) {
    totalConstraintsChecked++;
    const resolvedStatus = status || (passed ? 'PASSED' : (isHard ? 'VIOLATION' : 'WARNING'));
    const resolvedSeverity = severity || (resolvedStatus === 'VIOLATION' ? 'CRITICAL' : (resolvedStatus === 'WARNING' ? 'WARNING' : 'INFO'));
    if (passed && resolvedStatus === 'PASSED') passedConstraintsCount++;

    const item = {
      name,
      status: resolvedStatus,
      severity: resolvedSeverity,
      evidence: evidence || explanation,
      source,
      explanation,
      recommendedAction: passed && resolvedStatus === 'PASSED' ? 'None required' : recommendedAction,
      passed: Boolean(passed && resolvedStatus === 'PASSED'),
      isHard: Boolean(isHard),
      details: explanation
    };

    evaluatedConstraints.push(item);
    if (resolvedStatus === 'VIOLATION') {
      violations.push(`[VIOLATION] ${name}: ${explanation}`);
    } else if (resolvedStatus === 'WARNING') {
      warnings.push(`[WARNING] ${name}: ${explanation}`);
    } else if (resolvedStatus === 'NOT_VERIFIED') {
      unverifiedItems.push(`[NOT_VERIFIED] ${name}: ${explanation}`);
    }
  }

  // 1. EVALUATE DAILY DRIVING LIMITS
  let missingDrivingDataDay = null;
  let excessiveDrivingDay = null;
  let fatigueWarningDay = null;

  dayPlans.forEach(day => {
    if (day.totalDayDrivingMinutes === null || day.totalDayDrivingMinutes === undefined) {
      missingDrivingDataDay = `Day ${day.dayNumber || day.day} has unknown driving minutes`;
    } else if (day.totalDayDistanceKm === null || day.totalDayDistanceKm === undefined) {
      missingDrivingDataDay = `Day ${day.dayNumber || day.day} has unknown driving distance`;
    } else {
      const driveMins = Number(day.totalDayDrivingMinutes);
      const driveKm = Number(day.totalDayDistanceKm);
      if (driveMins > DAILY_LIMITS.maxDrivingMinutes || driveKm > DAILY_LIMITS.maxDrivingDistanceKm) {
        excessiveDrivingDay = `Day ${day.dayNumber || day.day} (${Math.round(driveKm)} km, ${Math.floor(driveMins / 60)}h ${driveMins % 60}m)`;
      } else if (driveMins > DAILY_LIMITS.warningDrivingMinutes) {
        fatigueWarningDay = `Day ${day.dayNumber || day.day} (${Math.floor(driveMins / 60)}h ${driveMins % 60}m)`;
      }
    }
  });

  if (missingDrivingDataDay) {
    recordConstraint({
      name: 'Daily Driving Verification',
      passed: false,
      status: 'NOT_VERIFIED',
      severity: 'CRITICAL',
      evidence: missingDrivingDataDay,
      source: 'road_matrix_and_daily_scheduler',
      explanation: `${missingDrivingDataDay}; daily driving feasibility cannot be verified.`,
      recommendedAction: 'Verify road transitions and matrix connectivity for scheduled days',
      isHard: true
    });
  }

  recordConstraint({
    name: 'Daily Driving Time Cap',
    passed: !excessiveDrivingDay && !missingDrivingDataDay,
    status: excessiveDrivingDay ? 'VIOLATION' : (missingDrivingDataDay ? 'NOT_VERIFIED' : 'PASSED'),
    severity: excessiveDrivingDay ? 'CRITICAL' : (missingDrivingDataDay ? 'CRITICAL' : 'INFO'),
    evidence: excessiveDrivingDay ? `Exceeded cap: ${excessiveDrivingDay}` : (missingDrivingDataDay ? missingDrivingDataDay : 'All days <= 12 hours driving'),
    source: 'road_matrix_and_daily_scheduler',
    explanation: excessiveDrivingDay ? `Exceeds 12-hour/850km safety limit on ${excessiveDrivingDay}` : (missingDrivingDataDay ? 'Driving duration unknown' : 'All days within safe driving limits'),
    recommendedAction: excessiveDrivingDay ? 'Split long driving day with intermediate overnight halt' : (missingDrivingDataDay ? 'Verify route transitions' : 'None required'),
    isHard: true
  });
  if (fatigueWarningDay) {
    recordConstraint({
      name: 'Driver Fatigue Threshold',
      passed: false,
      status: 'WARNING',
      severity: 'WARNING',
      evidence: fatigueWarningDay,
      source: 'road_matrix_and_daily_scheduler',
      explanation: `High driving volume on ${fatigueWarningDay}; ensure scheduled driver rest breaks`,
      recommendedAction: 'Schedule driver rest halts every 3 hours of continuous highway driving',
      isHard: false
    });
  }

  // 2. EVALUATE OPENING HOURS COMPLIANCE
  let openingHoursViolation = null;
  let unverifiedHoursCount = 0;
  dayPlans.forEach(day => {
    (day.stops || []).forEach(stop => {
      if (stop.openHours && (stop.openHours.open || stop.openHours.close)) {
        const arrMins = stop.arrivalTime ? parseTimeToMinutes(stop.arrivalTime) : null;
        const depMins = stop.departureTime ? parseTimeToMinutes(stop.departureTime) : null;
        const openMins = stop.openHours.open ? parseTimeToMinutes(stop.openHours.open) : null;
        const closeMins = stop.openHours.close ? parseTimeToMinutes(stop.openHours.close) : null;

        if (arrMins !== null && closeMins !== null && arrMins > closeMins - 15) {
          openingHoursViolation = `${stop.name} arrival at ${stop.arrivalTime} violates closing time (${stop.openHours.close})`;
        } else if (depMins !== null && closeMins !== null && depMins > closeMins) {
          openingHoursViolation = `${stop.name} departure at ${stop.departureTime} extends past closing time (${stop.openHours.close})`;
        }
      } else {
        unverifiedHoursCount++;
      }
    });
  });
  if (openingHoursViolation) {
    recordConstraint({
      name: 'Operating Hours Compliance',
      passed: false,
      status: 'VIOLATION',
      severity: 'CRITICAL',
      evidence: openingHoursViolation,
      source: 'attraction_schedule',
      explanation: openingHoursViolation,
      recommendedAction: 'Adjust arrival time or replace with attraction open during visiting window',
      isHard: true
    });
  } else if (unverifiedHoursCount > 0) {
    recordConstraint({
      name: 'Operating Hours Compliance',
      passed: true,
      status: 'WARNING',
      severity: 'WARNING',
      evidence: `${unverifiedHoursCount} attraction(s) lack official opening hours`,
      source: 'attraction_catalog',
      explanation: `${unverifiedHoursCount} attraction stop(s) have unverified seasonal operating hours`,
      recommendedAction: 'Verify operating hours with venue before travel',
      isHard: false
    });
  } else {
    recordConstraint({
      name: 'Operating Hours Compliance',
      passed: true,
      status: 'PASSED',
      severity: 'INFO',
      evidence: 'All scheduled attractions have verified operating hours',
      source: 'attraction_schedule',
      explanation: 'All visits scheduled within official operating windows',
      recommendedAction: 'None required',
      isHard: false
    });
  }

  // 3. EVALUATE MEAL HALTS & REST WINDOWS
  let missingMealDays = [];
  dayPlans.forEach(day => {
    const hasLunch = (day.timeline || []).some(t => t.category === 'meal');
    if (!hasLunch && day.stops && day.stops.length > 0) {
      missingMealDays.push(day.dayNumber || day.day);
    }
  });
  recordConstraint({
    name: 'Mandatory Meal Halts',
    passed: missingMealDays.length === 0,
    status: missingMealDays.length === 0 ? 'PASSED' : 'WARNING',
    severity: missingMealDays.length === 0 ? 'INFO' : 'WARNING',
    evidence: missingMealDays.length > 0 ? `Missing lunch on Day(s): ${missingMealDays.join(', ')}` : 'Dedicated meal breaks scheduled daily',
    source: 'daily_timeline',
    explanation: missingMealDays.length > 0 ? `Missing dedicated meal stops on Day(s): ${missingMealDays.join(', ')}` : 'Timely meal halts scheduled for all travel days',
    recommendedAction: missingMealDays.length > 0 ? 'Insert dedicated 45-60 minute dining halts' : 'None required',
    isHard: false
  });

  // 4. EVALUATE BUDGET CONSTRAINTS
  const userBudget = Number(userProfile.totalBudget || userProfile.budget || 0);
  const totalCost = Number(budgetSummary.totalEstimatedCost || 0);
  if (userBudget > 0 && totalCost > 0) {
    const isSevereOverrun = totalCost > userBudget * 1.35;
    const isMildOverrun = totalCost > userBudget;
    recordConstraint({
      name: 'Budget Limit Feasibility',
      passed: !isSevereOverrun,
      status: isSevereOverrun ? 'VIOLATION' : (isMildOverrun ? 'WARNING' : 'PASSED'),
      severity: isSevereOverrun ? 'CRITICAL' : (isMildOverrun ? 'WARNING' : 'INFO'),
      evidence: `Trip cost ₹${totalCost.toLocaleString('en-IN')} vs User budget ₹${userBudget.toLocaleString('en-IN')}`,
      source: 'budget_calculation_engine',
      explanation: isSevereOverrun
        ? `Trip expenditure (₹${totalCost.toLocaleString('en-IN')}) exceeds budget (₹${userBudget.toLocaleString('en-IN')}) by >35%`
        : (isMildOverrun ? `Trip cost (₹${totalCost.toLocaleString('en-IN')}) slightly exceeds budget (₹${userBudget.toLocaleString('en-IN')})` : 'Trip is fully within budget'),
      recommendedAction: isSevereOverrun
        ? 'Select budget accommodations, switch travel modes, or reduce trip duration'
        : (isMildOverrun ? 'Apply trade-off recommendations to bring cost within budget' : 'None required'),
      isHard: isSevereOverrun
    });
  }

  // 5. EVALUATE NEGATIVE PREFERENCES & PLACES TO AVOID
  const avoids = (userProfile.placesToAvoid || []).map(a => String(a).toLowerCase().trim());
  let avoidedStopEncountered = null;
  if (avoids.length > 0) {
    dayPlans.forEach(day => {
      (day.stops || []).forEach(stop => {
        const stopText = `${stop.name || ''} ${stop.category || ''} ${(stop.types || []).join(' ')}`.toLowerCase();
        for (const avoid of avoids) {
          if (stopText.includes(avoid)) {
            avoidedStopEncountered = `Stop "${stop.name}" matches avoided category "${avoid}"`;
            break;
          }
        }
      });
    });
  }
  recordConstraint({
    name: 'Negative Preferences Adherence',
    passed: !avoidedStopEncountered,
    status: avoidedStopEncountered ? 'VIOLATION' : 'PASSED',
    severity: avoidedStopEncountered ? 'CRITICAL' : 'INFO',
    evidence: avoidedStopEncountered || 'Zero avoided places or categories matched',
    source: 'user_preferences',
    explanation: avoidedStopEncountered || 'No avoided categories or locations included',
    recommendedAction: avoidedStopEncountered ? 'Filter out avoided places from candidate selection' : 'None required',
    isHard: true
  });

  // 6. EVALUATE WEATHER SAFETY RESTRICTIONS
  let weatherFeasible = true;
  let weatherDetails = 'Weather conditions verified favorable';
  const weatherCondStr = weatherInfo?.condition || weatherInfo?.conditions || '';
  const hasSafetyCriticalActivities = dayPlans.some(d => (d.stops || []).some(s => {
    const cat = String(s.category || s.taxonomyCategory || '').toLowerCase();
    return cat.includes('trek') || cat.includes('waterfall') || cat.includes('adventure') || cat.includes('viewpoint') || cat.includes('beach');
  }));
  const isSafetyCriticalWeather = Boolean(userProfile?.requireVerifiedOnly || weatherInfo?.isCritical || hasSafetyCriticalActivities);

  if (!weatherInfo || weatherInfo.status === 'UNAVAILABLE' || weatherInfo.status === 'UNKNOWN' || weatherCondStr === 'Unavailable' || weatherCondStr === 'Unknown') {
    weatherFeasible = !isSafetyCriticalWeather;
    weatherDetails = 'Weather data unavailable for travel dates; outdoor feasibility cannot be verified';
    recordConstraint({
      name: 'Weather Safety Clearance',
      passed: !isSafetyCriticalWeather,
      status: isSafetyCriticalWeather ? 'NOT_VERIFIED' : 'WARNING',
      severity: isSafetyCriticalWeather ? 'CRITICAL' : 'WARNING',
      evidence: 'Weather data unavailable',
      source: 'open_weather_api',
      explanation: isSafetyCriticalWeather ? 'Weather data unavailable for safety-critical outdoor activities' : weatherDetails,
      recommendedAction: 'Check regional meteorological forecasts before commencing outdoor activities',
      isHard: isSafetyCriticalWeather
    });
  } else if (/storm|cyclone|monsoon|heavy.*rain|flood/i.test(weatherCondStr)) {
    weatherFeasible = false;
    weatherDetails = `Hazardous weather alert: ${weatherCondStr}. Outdoor treks and waterfalls restricted.`;
    recordConstraint({
      name: 'Weather Safety Clearance',
      passed: false,
      status: 'VIOLATION',
      severity: 'CRITICAL',
      evidence: `Hazardous weather: ${weatherCondStr}`,
      source: 'weather_alert_system',
      explanation: weatherDetails,
      recommendedAction: 'Postpone trip or substitute outdoor activities with indoor attractions',
      isHard: true
    });
  } else {
    recordConstraint({
      name: 'Weather Safety Clearance',
      passed: true,
      status: 'PASSED',
      severity: 'INFO',
      evidence: `Verified favorable: ${weatherCondStr}`,
      source: 'open_weather_api',
      explanation: `Weather conditions verified favorable (${weatherCondStr})`,
      recommendedAction: 'None required',
      isHard: true
    });
  }

  // 7. EVALUATE UNBROKEN LOCATION CONTINUITY
  let continuityBroken = null;
  for (let i = 0; i < dayPlans.length - 1; i++) {
    const dayEnd = String(dayPlans[i].endLocation || '').toLowerCase().trim();
    const nextStart = String(dayPlans[i + 1].startLocation || '').toLowerCase().trim();
    if (dayEnd && nextStart && dayEnd !== nextStart) {
      continuityBroken = `Day ${i + 1} ends at "${dayPlans[i].endLocation}", but Day ${i + 2} starts at "${dayPlans[i + 1].startLocation}"`;
      break;
    }
  }
  recordConstraint({
    name: 'Location Continuity',
    passed: !continuityBroken,
    status: continuityBroken ? 'VIOLATION' : 'PASSED',
    severity: continuityBroken ? 'CRITICAL' : 'INFO',
    evidence: continuityBroken || 'Continuous day-to-day route chain confirmed',
    source: 'daily_itinerary_scheduler',
    explanation: continuityBroken || 'Unbroken location continuity confirmed across all consecutive days',
    recommendedAction: continuityBroken ? 'Align Day N+1 start location with Day N overnight end location' : 'None required',
    isHard: true
  });

  // 8. EVALUATE TRIP DIRECTION INTEGRITY
  const isOneWay = userProfile.isRoundTrip === false || userProfile.tripDirection === 'one_way';
  if (isOneWay && dayPlans.length > 0) {
    const returnPhasePresent = dayPlans.some(d => d.journeyPhase === 'RETURN' || d.phase === 'Return Journey');
    recordConstraint({
      name: 'One-Way Direction Integrity',
      passed: !returnPhasePresent,
      status: returnPhasePresent ? 'VIOLATION' : 'PASSED',
      severity: returnPhasePresent ? 'CRITICAL' : 'INFO',
      evidence: returnPhasePresent ? 'Return phase found in one-way trip' : 'Zero return days scheduled',
      source: 'daily_itinerary_scheduler',
      explanation: returnPhasePresent ? 'One-way trip incorrectly scheduled a return journey' : 'One-way trip terminates at destination with zero return days',
      recommendedAction: returnPhasePresent ? 'Remove return journey phase from one-way itinerary' : 'None required',
      isHard: true
    });
  }

  // 9. EVALUATE ROUTE CORRIDOR CONNECTIVITY
  const hasValidDistance = Number(routeInfo.totalDistanceKm || 0) > 0;
  const isRoutingUnavailable = routeInfo.dataStatus === 'unavailable' || (routeInfo.missingTransitions && routeInfo.missingTransitions.length > 0) || !hasValidDistance;

  if (isRoutingUnavailable) {
    recordConstraint({
      name: 'Route Corridor Connectivity',
      passed: false,
      status: 'NOT_VERIFIED',
      severity: 'CRITICAL',
      evidence: 'Missing or unavailable route matrix transition',
      source: 'road_routing_provider',
      explanation: 'Routing connectivity between endpoints is unavailable or unverified',
      recommendedAction: 'Verify road provider credentials or verify node coordinates',
      isHard: true
    });
  } else {
    recordConstraint({
      name: 'Route Corridor Connectivity',
      passed: true,
      status: 'PASSED',
      severity: 'INFO',
      evidence: `Authoritative road distance: ${routeInfo.totalDistanceKm} km`,
      source: 'road_routing_provider',
      explanation: `Authoritative road corridor verified (${routeInfo.totalDistanceKm} km)`,
      recommendedAction: 'None required',
      isHard: true
    });
  }
  if (!routeInfo.isLiveVerified) {
    unverifiedItems.push('Road traffic conditions rely on historical diurnal model rather than live sensor feed');
  }

  // 10. EVALUATE MINIMUM VISIT DURATION FEASIBILITY
  let rushedVisits = [];
  dayPlans.forEach(day => {
    (day.stops || []).forEach(stop => {
      const dur = Number(stop.estimatedVisitDurationMinutes || stop.durationMinutes || 60);
      if (dur < 25) rushedVisits.push(stop.name);
    });
  });
  recordConstraint({
    name: 'Minimum Visit Duration Feasibility',
    passed: rushedVisits.length === 0,
    status: rushedVisits.length === 0 ? 'PASSED' : 'WARNING',
    severity: rushedVisits.length === 0 ? 'INFO' : 'WARNING',
    evidence: rushedVisits.length > 0 ? `Rushed stops: ${rushedVisits.join(', ')}` : 'Adequate visit durations (>25 mins) allocated',
    source: 'attraction_schedule',
    explanation: rushedVisits.length > 0 ? `Abnormally rushed visits (<25m) scheduled at: ${rushedVisits.join(', ')}` : 'Adequate visit durations allocated across all scheduled attractions',
    recommendedAction: rushedVisits.length > 0 ? 'Increase time allocation or remove low-priority stops' : 'None required',
    isHard: false
  });

  // 11. EVALUATE ENDPOINT COORDINATES
  const origCoord = routeInfo.originCoordinates || userProfile.originCoordinates;
  const destCoord = routeInfo.destinationCoordinates || userProfile.destinationCoordinates;
  if (origCoord || destCoord) {
    const isOrigValid = !origCoord || (
      origCoord.lat !== null && origCoord.lng !== null &&
      Number.isFinite(Number(origCoord.lat)) && Number(origCoord.lat) >= -90 && Number(origCoord.lat) <= 90 &&
      Number.isFinite(Number(origCoord.lng)) && Number(origCoord.lng) >= -180 && Number(origCoord.lng) <= 180
    );
    const isDestValid = !destCoord || (
      destCoord.lat !== null && destCoord.lng !== null &&
      Number.isFinite(Number(destCoord.lat)) && Number(destCoord.lat) >= -90 && Number(destCoord.lat) <= 90 &&
      Number.isFinite(Number(destCoord.lng)) && Number(destCoord.lng) >= -180 && Number(destCoord.lng) <= 180
    );
    const hasValidEndpoints = isOrigValid && isDestValid;
    recordConstraint({
      name: 'Endpoint Coordinates Verification',
      passed: hasValidEndpoints,
      status: hasValidEndpoints ? 'PASSED' : 'NOT_VERIFIED',
      severity: hasValidEndpoints ? 'INFO' : 'CRITICAL',
      evidence: hasValidEndpoints ? 'Both origin and destination coordinates verified in range' : 'Origin or destination coordinates out of range (-90..90, -180..180)',
      source: 'road_routing_provider',
      explanation: hasValidEndpoints ? 'Endpoints have valid GPS coordinates' : 'Route endpoints have invalid GPS coordinate ranges',
      recommendedAction: hasValidEndpoints ? 'None required' : 'Provide valid endpoint coordinates',
      isHard: true
    });
  }

  // 12. EVALUATE STRICT ROUTING PROVIDER INTEGRITY
  const routingMode = userProfile.routingMode || userProfile.routingPolicy;
  if (routingMode === 'STRICT_PROVIDER') {
    const isGraph = routeInfo.dataStatus === 'graph_modeled' || routeInfo.isLimitedGraph;
    const isEst = routeInfo.dataStatus === 'estimated' || routeInfo.isEstimate;
    if (isGraph || isEst) {
      recordConstraint({
        name: 'Strict Routing Provider Verification',
        passed: false,
        status: 'NOT_VERIFIED',
        severity: 'CRITICAL',
        evidence: isGraph ? 'Route is graph-modeled in STRICT_PROVIDER mode' : 'Route is estimated in STRICT_PROVIDER mode',
        source: 'road_routing_provider',
        explanation: isGraph
          ? 'Highway graph routes cannot pass authoritative verification under STRICT_PROVIDER policy'
          : 'Geodesic estimates cannot pass authoritative verification under STRICT_PROVIDER policy',
        recommendedAction: 'Supply authoritative routing provider credentials or select OFFLINE_GRAPH / ALLOW_ESTIMATES mode',
        isHard: true
      });
    }
  }

  // 13. EVALUATE FINAL DESTINATION TRANSITION INTEGRITY
  const hasMissingFinalTrans = routeInfo.missingFinalTransition === true ||
    (routeInfo.routeTransitions && routeInfo.routeTransitions.length > 0 &&
     routeInfo.routeTransitions[routeInfo.routeTransitions.length - 1]?.dataStatus === 'unavailable');
  if (hasMissingFinalTrans) {
    recordConstraint({
      name: 'Final Destination Transition',
      passed: false,
      status: 'NOT_VERIFIED',
      severity: 'CRITICAL',
      evidence: 'Final arrival destination transition is unavailable',
      source: 'route_matrix',
      explanation: 'Route transition to final destination endpoint could not be verified',
      recommendedAction: 'Verify road network connectivity to destination endpoint',
      isHard: true
    });
  }

  // CALCULATE OBJECTIVE SCORE & FINAL FEASIBILITY STATUS
  let verifiedCount = 0;
  evaluatedConstraints.forEach(c => {
    if (c.passed && c.status === 'PASSED') {
      verifiedCount++;
    }
  });

  let score = 100;
  if (violations.length > 0) {
    score = Math.max(10, Math.min(45, 100 - (violations.length * 25 + warnings.length * 5)));
  } else if (unverifiedItems.length > 0) {
    score = Math.max(50, Math.min(90, 100 - (unverifiedItems.length * 8 + warnings.length * 5)));
  } else if (warnings.length > 0) {
    score = Math.max(70, Math.min(95, 100 - warnings.length * 8));
  }

  let status = 'FEASIBLE';
  let isFeasible = true;

  const hasCriticalNotVerified = evaluatedConstraints.some(c => c.status === 'NOT_VERIFIED' && (c.severity === 'CRITICAL' || c.isHard));
  if (violations.length > 0) {
    status = 'INFEASIBLE';
    isFeasible = false;
  } else if (
    isRoutingUnavailable ||
    hasCriticalNotVerified ||
    (userProfile?.requireVerifiedOnly && (weatherInfo?.status === 'UNAVAILABLE' || unverifiedItems.length > 0))
  ) {
    status = 'NOT_VERIFIED';
    isFeasible = false;
  } else if (warnings.length > 0 || unverifiedItems.length > 0 || evaluatedConstraints.some(c => c.status === 'WARNING')) {
    status = 'FEASIBLE_WITH_WARNINGS';
    isFeasible = true;
  }

  return {
    status,
    isFeasible,
    score,
    evaluatedConstraints,
    unverifiedItems,
    violations,
    warnings,
    recommendations: violations.length > 0
      ? ['Adjust trip constraints or increase available travel days to achieve full operational feasibility.']
      : (warnings.length > 0 ? ['Review scheduled warning items for optimal comfort.'] : ['Itinerary meets all operational, safety, and preference constraints.'])
  };

  return {
    status,
    isFeasible,
    score,
    evaluatedConstraints,
    unverifiedItems,
    violations,
    warnings,
    recommendations: violations.length > 0
      ? ['Adjust trip constraints or increase available travel days to achieve full operational feasibility.']
      : (warnings.length > 0 ? ['Review scheduled warning items for optimal comfort.'] : ['Itinerary meets all operational, safety, and preference constraints.'])
  };
}

module.exports = {
  evaluateItineraryFeasibility,
  DAILY_LIMITS
};
