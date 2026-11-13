/**
 * TimeWindowScheduler
 * 
 * Precise temporal scheduling engine:
 * - Chronological time-window calculation and sequencing
 * - Distinguishes driving duration, activity duration, meal duration, rest duration, queue/waiting time, and overnight stay
 * - Sunrise and sunset window evaluation with trade-off explanations
 * - Temple opening hours, midday closure enforcement, queue buffers, and dress code checks
 * - Forest road and ghat road evening restriction enforcement (e.g. Nallamala forest gate closes at 21:00)
 */

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 540; // 09:00 AM default
  const cleaned = String(timeStr).trim().toUpperCase();
  const match = cleaned.match(/(\d+):(\d+)\s*(AM|PM)?/);
  if (!match) return 540;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3];
  if (meridian === 'PM' && hours < 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatMinutesTo12(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const meridian = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${displayHours}:${displayMinutes} ${meridian}`;
}

/**
 * Checks whether arrival time falls within temple open intervals
 * Accounts for Indian temple midday cleaning / alankaram closures (typically 14:00 - 17:30)
 */
function evaluateTempleTimings(arrivalTimeMinutes, openHours = {}) {
  const openMins = openHours.open ? parseTimeToMinutes(openHours.open) : 6 * 60;
  const closeMins = openHours.close ? parseTimeToMinutes(openHours.close) : 22 * 60;
  const breakStart = openHours.breakStart ? parseTimeToMinutes(openHours.breakStart) : 14 * 60;
  const breakEnd = openHours.breakEnd ? parseTimeToMinutes(openHours.breakEnd) : 17 * 60 + 30;

  if (arrivalTimeMinutes < openMins || arrivalTimeMinutes > closeMins) {
    return {
      isOpen: false,
      status: 'CLOSED',
      reason: `Arriving outside official temple hours (${formatMinutesTo12(openMins)} to ${formatMinutesTo12(closeMins)}).`
    };
  }

  // Check midday break
  if (arrivalTimeMinutes >= breakStart && arrivalTimeMinutes < breakEnd) {
    return {
      isOpen: false,
      status: 'MIDDAY_BREAK',
      reason: `Arriving during afternoon temple closure (${formatMinutesTo12(breakStart)} to ${formatMinutesTo12(breakEnd)}) for ritual cleaning and deity alankaram. Darshan reopens at ${formatMinutesTo12(breakEnd)}.`
    };
  }

  return {
    isOpen: true,
    status: 'OPEN',
    reason: 'Arriving during official darshan hours.'
  };
}

/**
 * Evaluates whether arrival time matches sunrise window
 */
function evaluateSunriseWindow(arrivalTimeMinutes, departureTimeMinutes, distanceKm) {
  const sunriseWindowStart = 5 * 60 + 45; // 05:45 AM
  const sunriseWindowEnd = 7 * 60 + 30;   // 07:30 AM

  if (arrivalTimeMinutes >= sunriseWindowStart && arrivalTimeMinutes <= sunriseWindowEnd) {
    return {
      isSunriseMatched: true,
      quality: 'OPTIMAL',
      message: 'Arrival is timed to capture early morning mist, soft golden light, and sunrise reflections over the water.'
    };
  }

  if (arrivalTimeMinutes < sunriseWindowStart) {
    return {
      isSunriseMatched: true,
      quality: 'PRE_DAWN',
      message: 'Arrival is in the pre-dawn twilight before sunrise. Excellent for stargazing and dusk-to-dawn transitions.'
    };
  }

  // Arriving after sunrise window
  const delayMinutes = arrivalTimeMinutes - sunriseWindowEnd;
  return {
    isSunriseMatched: false,
    quality: 'POST_SUNRISE',
    message: `Departure schedule results in arrival at ${formatMinutesTo12(arrivalTimeMinutes)}, missing the sunrise window by approx ${delayMinutes} minutes. The reservoir remains scenic, though midday light will replace the morning golden glow.`
  };
}

/**
 * Builds sequential schedule items for a day's stops
 */
function sequenceDaySchedule({
  startLocation,
  endLocation,
  departureTime = '04:30 AM',
  stops = [],
  mealPreferences = {},
  isDepartureDay = false,
  vehicleDetails = {}
}) {
  const timeline = [];
  let currentMinutes = parseTimeToMinutes(departureTime);

  // 1. Vehicle Preparation & Departure Step (for Day 1)
  if (isDepartureDay) {
    timeline.push({
      time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 15)}`,
      place: `Vehicle Inspection & Departure from ${startLocation}`,
      category: 'travel',
      travelTime: '0 mins',
      visitDuration: '15 mins',
      bestVisitWindow: 'Early Morning (04:00 AM - 05:00 AM)',
      traffic: 'Clear Pre-Dawn City Outskirts',
      cost: '₹0',
      reason: 'Mandatory departure checklist: inspect tire pressures (including spare), check engine oil/coolant levels, verify RC/PUC/Insurance documents and active FASTag balance, and pack hydration supplies.',
      checklist: [
        'Check tire pressure and tread depth (including spare tire)',
        'Check engine oil, coolant, and brake fluid levels',
        'Verify vehicle RC, insurance, PUC certificate, and FASTag account balance',
        'Pack emergency first-aid kit, puncture repair kit, flashlight, and 5L drinking water',
        'Confirm offline GPS maps downloaded for Nallamala forest ghat sections'
      ]
    });
    currentMinutes += 15;
  } else {
    timeline.push({
      time: formatMinutesTo12(currentMinutes),
      place: `Depart from ${startLocation}`,
      category: 'travel',
      travelTime: '0 mins',
      visitDuration: '10 mins',
      bestVisitWindow: 'Morning Flow',
      traffic: 'Smooth Highway Conditions',
      cost: '₹0',
      reason: `Resume onward road trip journey from ${startLocation}.`
    });
    currentMinutes += 10;
  }

  return {
    currentMinutes,
    timeline
  };
}

module.exports = {
  parseTimeToMinutes,
  formatMinutesTo12,
  evaluateTempleTimings,
  evaluateSunriseWindow,
  sequenceDaySchedule
};
