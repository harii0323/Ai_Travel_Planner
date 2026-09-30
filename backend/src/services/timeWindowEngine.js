/**
 * Time Window Engine - Time-Aware Place Selection & Compatibility Calculation
 * 
 * Enforces realistic time profiles and visiting windows:
 * - Sunrise viewpoints: 05:30 AM - 08:00 AM (rejected if arriving in afternoon!)
 * - Temples: 06:00 AM - 12:30 PM & 04:30 PM - 08:30 PM (midday darshan closure)
 * - Waterfalls & Treks: Daylight only (08:00 AM - 05:00 PM)
 * - Museums & Palaces: 10:00 AM - 05:00 PM
 * - Beaches: 04:00 PM - 07:00 PM (or sunrise)
 * - Wildlife Safaris: 06:00 AM - 09:30 AM or 03:00 PM - 06:00 PM
 * - Night Markets & Food Streets: 06:00 PM - 10:30 PM
 * 
 * Classifies visits as IDEAL, ACCEPTABLE, POOR, or UNAVAILABLE.
 */

const TIME_PROFILES = {
  sunrise_point: {
    category: 'sunrise_point',
    openMinutes: 5 * 60, // 05:00
    closeMinutes: 19 * 60, // 19:00
    idealWindows: [{ start: 5 * 60 + 15, end: 7 * 60 + 45, label: 'Early Morning Sunrise (5:15 AM - 7:45 AM)' }],
    durationMinutes: 75,
    parkingMinutes: 15,
    walkingBufferMinutes: 15,
    requiresDaylight: true,
    strictWindow: true // Cannot be visited at 2 PM!
  },
  sunset_point: {
    category: 'sunset_point',
    openMinutes: 6 * 60, // 06:00
    closeMinutes: 20 * 60, // 20:00
    idealWindows: [{ start: 16 * 60 + 30, end: 19 * 60, label: 'Golden Hour Sunset (4:30 PM - 7:00 PM)' }],
    durationMinutes: 90,
    parkingMinutes: 15,
    walkingBufferMinutes: 10,
    requiresDaylight: false,
    strictWindow: false
  },
  temple: {
    category: 'temple',
    // Indian temples typically close midday between 12:30 PM and 4:30 PM
    openIntervals: [
      { start: 6 * 60, end: 12 * 60 + 30 },
      { start: 16 * 60 + 30, end: 20 * 60 + 30 }
    ],
    idealWindows: [
      { start: 6 * 60 + 30, end: 10 * 60, label: 'Morning Puja (6:30 AM - 10:00 AM)' },
      { start: 17 * 60, end: 19 * 60 + 30, label: 'Evening Aarti (5:00 PM - 7:30 PM)' }
    ],
    durationMinutes: 75,
    parkingMinutes: 15,
    walkingBufferMinutes: 15,
    strictWindow: false
  },
  waterfall: {
    category: 'waterfall',
    openMinutes: 8 * 60, // 08:00
    closeMinutes: 17 * 60, // 17:00 (strict daylight entry)
    idealWindows: [{ start: 9 * 60, end: 15 * 60, label: 'Daylight Window (9:00 AM - 3:00 PM)' }],
    durationMinutes: 90,
    parkingMinutes: 15,
    walkingBufferMinutes: 20,
    requiresDaylight: true,
    strictWindow: true
  },
  beach: {
    category: 'beach',
    openMinutes: 5 * 60,
    closeMinutes: 23 * 60,
    idealWindows: [
      { start: 6 * 60, end: 9 * 60, label: 'Cool Morning Walk (6:00 AM - 9:00 AM)' },
      { start: 16 * 60, end: 19 * 60, label: 'Sunset & Sea Breeze (4:00 PM - 7:00 PM)' }
    ],
    durationMinutes: 105,
    parkingMinutes: 15,
    walkingBufferMinutes: 10,
    strictWindow: false
  },
  national_park: {
    category: 'national_park',
    // Wildlife safaris operate in two fixed batches
    openIntervals: [
      { start: 6 * 60, end: 10 * 60 },
      { start: 14 * 60 + 30, end: 18 * 60 }
    ],
    idealWindows: [
      { start: 6 * 60, end: 9 * 60 + 30, label: 'Morning Safari (6:00 AM - 9:30 AM)' },
      { start: 15 * 60, end: 17 * 60 + 45, label: 'Evening Safari (3:00 PM - 5:45 PM)' }
    ],
    durationMinutes: 180,
    parkingMinutes: 20,
    walkingBufferMinutes: 20,
    strictWindow: true
  },
  museum: {
    category: 'museum',
    openMinutes: 10 * 60, // 10:00 AM
    closeMinutes: 17 * 60 + 30, // 5:30 PM
    idealWindows: [{ start: 10 * 60 + 30, end: 15 * 60 + 30, label: 'Mid-Day Indoor (10:30 AM - 3:30 PM)' }],
    durationMinutes: 90,
    parkingMinutes: 10,
    walkingBufferMinutes: 10,
    strictWindow: false
  },
  fort: {
    category: 'fort',
    openMinutes: 8 * 60 + 30,
    closeMinutes: 17 * 60 + 30,
    idealWindows: [
      { start: 8 * 60 + 30, end: 11 * 60 + 30, label: 'Morning Exploration (8:30 AM - 11:30 AM)' },
      { start: 15 * 60, end: 17 * 60 + 30, label: 'Late Afternoon (3:00 PM - 5:30 PM)' }
    ],
    durationMinutes: 120,
    parkingMinutes: 15,
    walkingBufferMinutes: 20,
    requiresDaylight: true,
    strictWindow: false
  },
  palace: {
    category: 'palace',
    openMinutes: 9 * 60,
    closeMinutes: 17 * 60 + 30,
    idealWindows: [{ start: 9 * 60 + 30, end: 14 * 60, label: 'Daytime Sightseeing (9:30 AM - 2:00 PM)' }],
    durationMinutes: 105,
    parkingMinutes: 15,
    walkingBufferMinutes: 15,
    strictWindow: false
  },
  market: {
    category: 'market',
    openMinutes: 11 * 60,
    closeMinutes: 22 * 60,
    idealWindows: [{ start: 17 * 60, end: 21 * 60, label: 'Evening Bazaars & Dining (5:00 PM - 9:00 PM)' }],
    durationMinutes: 90,
    parkingMinutes: 15,
    walkingBufferMinutes: 10,
    strictWindow: false
  },
  viewpoint: {
    category: 'viewpoint',
    openMinutes: 6 * 60,
    closeMinutes: 19 * 60 + 30,
    idealWindows: [
      { start: 6 * 60, end: 9 * 60, label: 'Morning Vista (6:00 AM - 9:00 AM)' },
      { start: 16 * 60, end: 18 * 60 + 45, label: 'Sunset Vista (4:00 PM - 6:45 PM)' }
    ],
    durationMinutes: 60,
    parkingMinutes: 10,
    walkingBufferMinutes: 10,
    requiresDaylight: true,
    strictWindow: false
  },
  adventure: {
    category: 'adventure',
    openMinutes: 8 * 60 + 30,
    closeMinutes: 17 * 60,
    idealWindows: [{ start: 9 * 60, end: 13 * 60, label: 'Morning High Energy (9:00 AM - 1:00 PM)' }],
    durationMinutes: 120,
    parkingMinutes: 15,
    walkingBufferMinutes: 15,
    requiresDaylight: true,
    strictWindow: false
  }
};

/**
 * Normalizes time string ("08:30" or "8:30 AM") to minutes from midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') return timeStr;

  const str = String(timeStr).trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  const clean = str.replace(/[A-Z\s]/g, '');
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  return h * 60 + m;
}

/**
 * Formats minutes from midnight to 12-hour string (e.g. 510 -> "08:30 AM")
 */
function formatMinutesTo12(minutes) {
  const norm = Math.max(0, Math.floor(minutes)) % 1440;
  const h24 = Math.floor(norm / 60);
  const m = norm % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Detects appropriate category time profile for a POI
 */
function getPlaceTimeProfile(poi) {
  const name = String(poi?.name || '').toLowerCase();
  const category = String(poi?.category || (poi?.types ? poi.types[0] : '')).toLowerCase();

  if (name.includes('sunrise') || name.includes('tiger hill') || category === 'sunrise_point') {
    return TIME_PROFILES.sunrise_point;
  }
  if (name.includes('sunset') || category === 'sunset_point') {
    return TIME_PROFILES.sunset_point;
  }
  if (name.includes('temple') || name.includes('mandir') || name.includes('ashram') || category === 'temple') {
    return TIME_PROFILES.temple;
  }
  if (name.includes('waterfall') || name.includes('falls') || category === 'waterfall') {
    return TIME_PROFILES.waterfall;
  }
  if (name.includes('safari') || name.includes('national park') || name.includes('wildlife') || category === 'national_park') {
    return TIME_PROFILES.national_park;
  }
  if (name.includes('beach') || category === 'beach') {
    return TIME_PROFILES.beach;
  }
  if (name.includes('museum') || name.includes('gallery') || category === 'museum') {
    return TIME_PROFILES.museum;
  }
  if (name.includes('fort') || category === 'fort') {
    return TIME_PROFILES.fort;
  }
  if (name.includes('palace') || category === 'palace') {
    return TIME_PROFILES.palace;
  }
  if (name.includes('market') || name.includes('bazaar') || category === 'market') {
    return TIME_PROFILES.market;
  }
  if (name.includes('rafting') || name.includes('paragliding') || category === 'adventure') {
    return TIME_PROFILES.adventure;
  }

  return TIME_PROFILES.viewpoint;
}

/**
 * Calculates time compatibility of reaching a POI at expected arrival minutes.
 * Returns {
 *   status: 'IDEAL' | 'ACCEPTABLE' | 'POOR' | 'UNAVAILABLE',
 *   compatibilityScore: 0.0 - 1.0,
 *   arrivalFormatted: string,
 *   departureFormatted: string,
 *   bestWindowText: string,
 *   reason: string,
 *   usable: boolean
 * }
 */
function evaluateTimeCompatibility(poi, arrivalMinutes) {
  const profile = getPlaceTimeProfile(poi);
  const arrMins = typeof arrivalMinutes === 'number' ? arrivalMinutes : parseTimeToMinutes(arrivalMinutes);
  const visitDuration = profile.durationMinutes;
  const depMins = arrMins + visitDuration + profile.parkingMinutes + profile.walkingBufferMinutes;

  const arrFormatted = formatMinutesTo12(arrMins);
  const depFormatted = formatMinutesTo12(depMins);

  // 1. Check Open / Closed Hours
  let isOpen = false;
  if (profile.openIntervals) {
    for (const interval of profile.openIntervals) {
      if (arrMins >= interval.start && depMins <= interval.end) {
        isOpen = true;
        break;
      }
    }
  } else {
    isOpen = arrMins >= profile.openMinutes && depMins <= profile.closeMinutes;
  }

  if (!isOpen) {
    // If strict or temple midday closure
    const reason = profile.openIntervals 
      ? `Closed during midday interval at arrival time (${arrFormatted}). Re-opens late afternoon.`
      : `Closed at scheduled arrival time (${arrFormatted}). Operating hours: ${formatMinutesTo12(profile.openMinutes)} - ${formatMinutesTo12(profile.closeMinutes)}.`;
    
    return {
      status: 'UNAVAILABLE',
      compatibilityScore: 0.0,
      arrivalFormatted: arrFormatted,
      departureFormatted: depFormatted,
      bestWindowText: profile.idealWindows.map(w => w.label).join(' or '),
      reason,
      usable: false
    };
  }

  // 2. Check Ideal Windows
  let isIdeal = false;
  let idealLabel = '';
  for (const win of profile.idealWindows) {
    if (arrMins >= win.start && arrMins <= win.end) {
      isIdeal = true;
      idealLabel = win.label;
      break;
    }
  }

  if (isIdeal) {
    return {
      status: 'IDEAL',
      compatibilityScore: 1.0,
      arrivalFormatted: arrFormatted,
      departureFormatted: depFormatted,
      bestWindowText: idealLabel,
      reason: `Arrives during the peak visiting window (${idealLabel}). Optimal light and comfort.`,
      usable: true
    };
  }

  // 3. Strict Window Check (e.g. Sunrise point at 2:00 PM)
  if (profile.strictWindow && profile.category === 'sunrise_point') {
    // Arrival after 9:00 AM at sunrise point is unacceptable
    if (arrMins > 9 * 60) {
      return {
        status: 'POOR',
        compatibilityScore: 0.15,
        arrivalFormatted: arrFormatted,
        departureFormatted: depFormatted,
        bestWindowText: profile.idealWindows[0].label,
        reason: `Reaching sunrise point at ${arrFormatted} is outside the sunrise window. Replace with daytime viewpoint or cultural stop.`,
        usable: false
      };
    }
  }

  // 4. Daylight check for daylight-restricted places arriving after dusk
  if (profile.requiresDaylight && arrMins >= 17 * 60 + 30) {
    return {
      status: 'POOR',
      compatibilityScore: 0.10,
      arrivalFormatted: arrFormatted,
      departureFormatted: depFormatted,
      bestWindowText: profile.idealWindows[0].label,
      reason: `Arrives near or after dusk (${arrFormatted}). Natural daylight required for safe exploration.`,
      usable: false
    };
  }

  // 5. Acceptable Regular Hours
  return {
    status: 'ACCEPTABLE',
    compatibilityScore: 0.70,
    arrivalFormatted: arrFormatted,
    departureFormatted: depFormatted,
    bestWindowText: profile.idealWindows.map(w => w.label).join(' or '),
    reason: `Place is open from ${formatMinutesTo12(profile.openMinutes || 480)} to ${formatMinutesTo12(profile.closeMinutes || 1080)}. Visit fits safely.`,
    usable: true
  };
}

module.exports = {
  TIME_PROFILES,
  parseTimeToMinutes,
  formatMinutesTo12,
  getPlaceTimeProfile,
  evaluateTimeCompatibility
};
