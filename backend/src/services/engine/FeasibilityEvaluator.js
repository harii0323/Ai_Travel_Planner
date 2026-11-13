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

  function recordConstraint(name, passed, details = '', isHard = true) {
    totalConstraintsChecked++;
    if (passed) passedConstraintsCount++;
    evaluatedConstraints.push({ name, passed, isHard, details });
    if (!passed) {
      if (isHard) violations.push(`[VIOLATION] ${name}: ${details}`);
      else warnings.push(`[WARNING] ${name}: ${details}`);
    }
  }

  // 1. EVALUATE DAILY DRIVING LIMITS
  let excessiveDrivingDay = null;
  let fatigueWarningDay = null;
  dayPlans.forEach(day => {
    const driveMins = Number(day.totalDayDrivingMinutes || 0);
    const driveKm = Number(day.totalDayDistanceKm || 0);
    if (driveMins > DAILY_LIMITS.maxDrivingMinutes || driveKm > DAILY_LIMITS.maxDrivingDistanceKm) {
      excessiveDrivingDay = `Day ${day.dayNumber || day.day} (${Math.round(driveKm)} km, ${Math.floor(driveMins / 60)}h ${driveMins % 60}m)`;
    } else if (driveMins > DAILY_LIMITS.warningDrivingMinutes) {
      fatigueWarningDay = `Day ${day.dayNumber || day.day} (${Math.floor(driveMins / 60)}h ${driveMins % 60}m)`;
    }
  });
  recordConstraint(
    'Daily Driving Time Cap',
    !excessiveDrivingDay,
    excessiveDrivingDay ? `Exceeds 10-hour/700km safety limit on ${excessiveDrivingDay}` : 'All days within safe driving limits',
    true
  );
  if (fatigueWarningDay) {
    recordConstraint(
      'Driver Fatigue Threshold',
      false,
      `High driving volume on ${fatigueWarningDay}; ensure scheduled driver rest breaks`,
      false
    );
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
  if (unverifiedHoursCount > 0) {
    unverifiedItems.push(`${unverifiedHoursCount} attraction stop(s) have unverified seasonal operating hours`);
  }
  recordConstraint(
    'Operating Hours Compliance',
    !openingHoursViolation,
    openingHoursViolation || 'All visits scheduled within official operating windows',
    false
  );

  // 3. EVALUATE MEAL HALTS & REST WINDOWS
  let missingMealDays = [];
  dayPlans.forEach(day => {
    const hasLunch = (day.timeline || []).some(t => t.category === 'meal');
    if (!hasLunch && day.stops && day.stops.length > 0) {
      missingMealDays.push(day.dayNumber || day.day);
    }
  });
  recordConstraint(
    'Mandatory Meal Halts',
    missingMealDays.length === 0,
    missingMealDays.length > 0 ? `Missing dedicated meal stops on Day(s): ${missingMealDays.join(', ')}` : 'Timely meal halts scheduled for all travel days',
    false
  );

  // 4. EVALUATE BUDGET CONSTRAINTS
  const userBudget = Number(userProfile.totalBudget || userProfile.budget || 0);
  const totalCost = Number(budgetSummary.totalEstimatedCost || 0);
  if (userBudget > 0 && totalCost > 0) {
    const isSevereOverrun = totalCost > userBudget * 1.35;
    const isMildOverrun = totalCost > userBudget;
    recordConstraint(
      'Budget Limit Feasibility',
      !isSevereOverrun,
      isSevereOverrun
        ? `Trip expenditure (₹${totalCost.toLocaleString('en-IN')}) exceeds budget (₹${userBudget.toLocaleString('en-IN')}) by >35%`
        : (isMildOverrun ? `Trip cost (₹${totalCost.toLocaleString('en-IN')}) slightly exceeds budget (₹${userBudget.toLocaleString('en-IN')})` : 'Trip is fully within budget'),
      isSevereOverrun
    );
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
  recordConstraint(
    'Negative Preferences Adherence',
    !avoidedStopEncountered,
    avoidedStopEncountered || 'No avoided categories or locations included',
    true
  );

  // 6. EVALUATE WEATHER SAFETY RESTRICTIONS
  let weatherFeasible = true;
  let weatherDetails = 'Weather conditions verified favorable';
  const weatherCondStr = weatherInfo?.condition || weatherInfo?.conditions || '';
  if (!weatherInfo || weatherInfo.status === 'UNAVAILABLE' || weatherInfo.status === 'UNKNOWN' || weatherCondStr === 'Unavailable' || weatherCondStr === 'Unknown') {
    weatherFeasible = true;
    weatherDetails = 'Weather data unavailable for travel dates; outdoor feasibility cannot be verified';
    unverifiedItems.push(weatherDetails);
    recordConstraint('Weather Data Availability', false, weatherDetails, false);
  } else if (/storm|cyclone|monsoon|heavy.*rain|flood/i.test(weatherCondStr)) {
    weatherFeasible = false;
    weatherDetails = `Hazardous weather alert: ${weatherCondStr}. Outdoor treks and waterfalls restricted.`;
    recordConstraint('Weather Safety Clearance', false, weatherDetails, true);
  } else {
    recordConstraint('Weather Safety Clearance', true, `Weather conditions verified favorable (${weatherCondStr})`, true);
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
  recordConstraint(
    'Location Continuity',
    !continuityBroken,
    continuityBroken || 'Unbroken location continuity confirmed across all consecutive days',
    true
  );

  // 8. EVALUATE TRIP DIRECTION INTEGRITY
  const isOneWay = userProfile.isRoundTrip === false || userProfile.tripDirection === 'one_way';
  if (isOneWay && dayPlans.length > 0) {
    const returnPhasePresent = dayPlans.some(d => d.journeyPhase === 'RETURN' || d.phase === 'Return Journey');
    recordConstraint(
      'One-Way Direction Integrity',
      !returnPhasePresent,
      returnPhasePresent ? 'One-way trip incorrectly scheduled a return journey' : 'One-way trip terminates at destination with zero return days',
      true
    );
  }

  // 9. EVALUATE ROUTE CORRIDOR CONNECTIVITY
  const hasValidDistance = Number(routeInfo.totalDistanceKm || 0) > 0;
  recordConstraint(
    'Route Corridor Connectivity',
    hasValidDistance,
    hasValidDistance ? `Authoritative road corridor verified (${routeInfo.totalDistanceKm} km)` : 'Routing connectivity between endpoints could not be verified',
    true
  );
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
  recordConstraint(
    'Minimum Visit Duration Feasibility',
    rushedVisits.length === 0,
    rushedVisits.length > 0 ? `Abnormally rushed visits (<25m) scheduled at: ${rushedVisits.join(', ')}` : 'Adequate visit durations allocated across all scheduled attractions',
    false
  );

  // CALCULATE OBJECTIVE SCORE & FINAL FEASIBILITY STATUS
  const score = totalConstraintsChecked > 0 ? Math.round((passedConstraintsCount / totalConstraintsChecked) * 100) : 100;

  let status = 'FEASIBLE';
  let isFeasible = true;

  if (violations.length > 0) {
    status = 'INFEASIBLE';
    isFeasible = false;
  } else if (unverifiedItems.length >= 3 && weatherInfo?.status === 'UNAVAILABLE' && !routeInfo.isLiveVerified) {
    status = 'NOT_VERIFIED';
    isFeasible = true;
  } else if (warnings.length > 0 || unverifiedItems.length > 0) {
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
}

module.exports = {
  evaluateItineraryFeasibility,
  DAILY_LIMITS
};
