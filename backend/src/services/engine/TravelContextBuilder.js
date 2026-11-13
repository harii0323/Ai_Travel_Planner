/**
 * TravelContextBuilder
 * 
 * Module 2 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Builds calendar-bound day-by-day context with dates, days of week, and seasonal profiles.
 * - Determines dynamic trip phases (Onward Corridor Transit, Destination Exploration, Return Corridor Transit)
 *   calibrated to total distance and available days (NOT hardcoded to 2-day onward for every trip!).
 * - Establishes chronological visiting windows (sunrise, midday temple closure, daylight trek limits, sunset, curfews).
 * - Enforces mandatory meal and driver fatigue rest windows.
 */

const ROAD_RESTRICTIONS = [
  {
    corridorId: 'NALLAMALA_SRISAILAM_FOREST',
    name: 'Nallamala Tiger Reserve / Amrabad Ghat Road (Mannanur - Domalapenta - Srisailam)',
    gateClosedStartMinutes: 21 * 60, // 09:00 PM (21:00)
    gateClosedEndMinutes: 6 * 60,    // 06:00 AM (06:00)
    advisory: 'Forest gate closed for wildlife safety between 09:00 PM and 06:00 AM. Cross during daylight hours.'
  },
  {
    corridorId: 'BANDIPUR_MUDUMALAI_FOREST',
    name: 'Bandipur National Park NH 766 Forest Corridor',
    gateClosedStartMinutes: 21 * 60, // 09:00 PM
    gateClosedEndMinutes: 6 * 60,    // 06:00 AM
    advisory: 'Night traffic ban through Bandipur from 09:00 PM to 06:00 AM. Plan transit before dusk.'
  }
];

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 8 * 60;
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/);
  if (!match) return 8 * 60;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3];
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatMinutesTo12(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const modifier = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${modifier}`;
}

/**
 * Builds the chronological calendar days and phase allocations.
 */
function buildCalendarDays(startDate, totalDays, estimatedDistanceKm = 500) {
  const days = [];
  const safeDays = Math.max(1, Math.min(30, totalDays));

  // Determine onward, destination, and return day counts dynamically based on distance,
  // road network feasibility, and available trip duration (NO rigid fixed-ratio allocations):
  let onwardDays = 1;
  let returnDays = 1;

  if (safeDays === 1) {
    onwardDays = 1;
    returnDays = 0;
  } else if (safeDays === 2) {
    onwardDays = 1;
    returnDays = 1;
  } else if (safeDays <= 4) {
    if (estimatedDistanceKm > 700 && safeDays === 4) {
      onwardDays = 2;
      returnDays = 1;
    } else {
      onwardDays = 1;
      returnDays = 1;
    }
  } else if (safeDays === 5) {
    // For long journeys (>700 km, e.g. Hyderabad -> Munnar ~1050 km), safety mandates 2 onward days & 2 return days.
    // For moderate/close journeys (<=700 km, e.g. Srisailam, Hampi, Goa, Araku), allocate 1 onward, 1 return, and 3 stay days.
    if (estimatedDistanceKm > 700) {
      onwardDays = 2;
      returnDays = 2;
    } else {
      onwardDays = 1;
      returnDays = 1;
    }
  } else if (safeDays >= 6) {
    // 6+ day trips: Can comfortably accommodate intermediate overnight hubs for long routes (>700 km)
    if (estimatedDistanceKm > 700 && safeDays >= 7) {
      onwardDays = 2;
      returnDays = 2;
    } else if (estimatedDistanceKm > 700 && safeDays === 6) {
      onwardDays = 2;
      returnDays = 1;
    } else {
      onwardDays = 1;
      returnDays = 1;
    }
  }

  const destinationDays = Math.max(0, safeDays - onwardDays - returnDays);

  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let idx = 0; idx < safeDays; idx++) {
    const curDate = new Date(startDate);
    curDate.setDate(curDate.getDate() + idx);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayOfWeek = dayOfWeekNames[curDate.getDay()];

    let phase = 'destination';
    if (safeDays === 1) {
      phase = 'single_day_trip';
    } else if (idx < onwardDays) {
      phase = 'onward_corridor';
    } else if (idx >= safeDays - returnDays) {
      phase = 'return_corridor';
    } else {
      phase = 'destination_stay';
    }

    days.push({
      dayNumber: idx + 1,
      date: dateStr,
      dayOfWeek,
      phase,
      isWeekend: curDate.getDay() === 0 || curDate.getDay() === 6
    });
  }

  return {
    days,
    onwardDays,
    destinationDays,
    returnDays,
    totalDays: safeDays
  };
}

/**
 * Evaluates whether a proposed transit segment violates forest night curfews.
 */
function checkCorridorCurfews(placeOrCorridorName, arrivalMinutes) {
  const lower = String(placeOrCorridorName || '').toLowerCase();
  for (const restr of ROAD_RESTRICTIONS) {
    if (lower.includes('srisailam') || lower.includes('nallamala') || lower.includes('amrabad')) {
      if (restr.corridorId === 'NALLAMALA_SRISAILAM_FOREST') {
        const isClosed = arrivalMinutes >= restr.gateClosedStartMinutes || arrivalMinutes < restr.gateClosedEndMinutes;
        return {
          hasRestriction: true,
          isViolated: isClosed,
          corridor: restr.name,
          advisory: restr.advisory
        };
      }
    }
    if (lower.includes('bandipur') || lower.includes('mudumalai')) {
      if (restr.corridorId === 'BANDIPUR_MUDUMALAI_FOREST') {
        const isClosed = arrivalMinutes >= restr.gateClosedStartMinutes || arrivalMinutes < restr.gateClosedEndMinutes;
        return {
          hasRestriction: true,
          isViolated: isClosed,
          corridor: restr.name,
          advisory: restr.advisory
        };
      }
    }
  }
  return { hasRestriction: false, isViolated: false };
}

/**
 * Checks whether an attraction arrival time fits legitimate operating hours.
 */
function evaluateOperatingHoursCompatibility(category, openHours, arrivalMinutes) {
  const cat = String(category || '').toLowerCase();

  // 1. Temples: Strictly respect midday closures (12:30 PM - 04:30 PM)
  if (cat.includes('spirit') || cat.includes('temple') || cat.includes('jyotirlinga') || cat.includes('shakti')) {
    const isMorning = arrivalMinutes >= 6 * 60 && arrivalMinutes <= 12 * 60 + 30;
    const isEvening = arrivalMinutes >= 16 * 60 + 30 && arrivalMinutes <= 21 * 60;
    const isMiddayBreak = arrivalMinutes > 12 * 60 + 30 && arrivalMinutes < 16 * 60 + 30;

    if (isMiddayBreak) {
      return {
        compatible: false,
        score: 0.15,
        reason: 'Arriving during temple midday break (12:30 PM - 04:30 PM). Main sanctum and darshan counters are closed.'
      };
    }
    return {
      compatible: true,
      score: 1.0,
      reason: isMorning ? 'Arriving during optimal morning darshan window.' : 'Arriving during serene evening aarti/darshan window.'
    };
  }

  // 2. Sunrise Viewpoints: Must be visited early
  if (cat.includes('sunrise') || (openHours?.bestVisitWindow?.type === 'sunrise')) {
    const isSunriseWindow = arrivalMinutes >= 5 * 60 + 30 && arrivalMinutes <= 7 * 60 + 30;
    if (isSunriseWindow) {
      return { compatible: true, score: 1.0, reason: 'Ideal early morning golden-hour lighting.' };
    }
    return {
      compatible: false,
      score: 0.40,
      reason: 'Arriving past sunrise window. Viewpoint remains accessible for scenic landscape views, but sunrise reflections will be missed.'
    };
  }

  // 3. Treks & Waterfalls: Must have daylight for safety (exit before 17:30)
  if (cat.includes('trek') || cat.includes('waterfall') || cat.includes('adventure')) {
    if (arrivalMinutes > 16 * 60) {
      return {
        compatible: false,
        score: 0.20,
        reason: 'Arriving too late in the afternoon for forest trail or waterfall. Safety guidelines mandate daylight completion before 05:30 PM.'
      };
    }
    return { compatible: true, score: 0.95, reason: 'Comfortable daylight window for outdoor exploration.' };
  }

  // 4. Standard attractions with explicit open/close hours
  if (openHours && (openHours.open || openHours.close)) {
    const openMin = openHours.open ? parseTimeToMinutes(openHours.open) : 9 * 60;
    const closeMin = openHours.close ? parseTimeToMinutes(openHours.close) : 18 * 60;
    if (arrivalMinutes < openMin) {
      return { compatible: false, score: 0.3, reason: `Arriving before opening time (${formatMinutesTo12(openMin)}).` };
    }
    if (arrivalMinutes > closeMin - 30) {
      return { compatible: false, score: 0.2, reason: `Arriving too close to closing time (${formatMinutesTo12(closeMin)}).` };
    }
    return { compatible: true, score: 1.0, reason: 'Comfortably within official operating hours.' };
  }

  return { compatible: true, score: 0.85, reason: 'No specific time restrictions.' };
}

/**
 * Builds the complete travel context object.
 */
function buildTravelContext(userProfile, estimatedDistanceKm = 500) {
  const calendar = buildCalendarDays(userProfile.startDate, userProfile.totalDays, estimatedDistanceKm);

  return {
    ...calendar,
    userProfile,
    estimatedDistanceKm,
    dailyDepartureMinutes: parseTimeToMinutes(userProfile.departureTime || '07:30 AM'),
    mealSchedule: {
      breakfast: { start: 8 * 60, end: 9 * 60 + 15, duration: 45 },
      lunch: { start: 12 * 60 + 45, end: 14 * 60, duration: 60 },
      eveningTea: { start: 16 * 60 + 45, end: 17 * 60 + 15, duration: 30 },
      dinner: { start: 19 * 60 + 30, end: 21 * 60, duration: 60 }
    },
    evaluateOperatingHoursCompatibility,
    checkCorridorCurfews,
    parseTimeToMinutes,
    formatMinutesTo12
  };
}

module.exports = {
  buildTravelContext,
  buildCalendarDays,
  checkCorridorCurfews,
  evaluateOperatingHoursCompatibility,
  parseTimeToMinutes,
  formatMinutesTo12,
  ROAD_RESTRICTIONS
};

