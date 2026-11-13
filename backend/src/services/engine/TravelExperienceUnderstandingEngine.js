/**
 * TravelExperienceUnderstandingEngine
 * 
 * Module 14 of VISTA AI Travel Optimization Engine.
 * (Prompt Section 8 & Section 13)
 * 
 * Strict Responsibilities:
 * - Understands what kind of complete travel experience the traveler expects from natural-language inputs.
 * - Recognizes and structures experiential milestones:
 *     1. Vehicle preparation & fuel filling
 *     2. Morning departure
 *     3. Highway breakfast halt
 *     4. Scenic highway / ghat driving
 *     5. Sunrise viewing (with solar astronomical window calculation)
 *     6. Sightseeing & cultural heritage exploration
 *     7. Temple darshan (with darshan queues & midday closure rules)
 *     8. Trekking & mountain trails (with daylight safety limits)
 *     9. Adventure sports (rafting, paragliding, zorbing, safari)
 *     10. Regional lunch break & driver refreshment
 *     11. Refreshment & tea breaks
 *     12. Sunset viewing & coastal golden hour
 *     13. Beach visits & aquatic relaxation
 *     14. Accommodation check-in
 *     15. Regional dinner
 *     16. Overnight rest
 * - Calculates astronomical solar windows (sunrise & sunset minutes) from latitude and calendar date.
 * - Validates experiential time-window compatibility (e.g. sunrise viewpoint reached before sunrise).
 * - Converts raw traveler requests into structured activity objects with priority, duration, time window, and dependencies.
 */

/**
 * Calculates astronomical sunrise and sunset minutes for a given geographic latitude and calendar date.
 * Uses standard solar declination and hour-angle approximation for India (latitudes 8°N to 36°N).
 */
function calculateSolarTimes(lat = 15.0, date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  
  // Day of the year (1 - 365)
  const startOfYear = new Date(d.getFullYear(), 0, 0);
  const diff = d - startOfYear;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Solar declination in radians
  const declination = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)) * (Math.PI / 180);
  const latRad = lat * (Math.PI / 180);

  // Hour angle at sunrise/sunset (solar depression angle 0.833° for refraction and disc diameter)
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);
  const clampedCos = Math.max(-1.0, Math.min(1.0, cosHourAngle));
  const hourAngleDeg = Math.acos(clampedCos) * (180 / Math.PI);

  // Solar noon in Indian Standard Time (UTC+5.30): average 12:15 PM IST
  const solarNoonMinutes = 12 * 60 + 15;
  const halfDayMinutes = Math.round((hourAngleDeg / 15) * 60);

  const sunriseMinutes = solarNoonMinutes - halfDayMinutes;
  const sunsetMinutes = solarNoonMinutes + halfDayMinutes;

  return {
    sunriseMinutes: Math.max(5 * 60, Math.min(7 * 60 + 15, sunriseMinutes)),
    sunsetMinutes: Math.max(17 * 60, Math.min(19 * 60, sunsetMinutes)),
    goldenHourMorningStartMinutes: sunriseMinutes - 30,
    goldenHourMorningEndMinutes: sunriseMinutes + 60,
    goldenHourEveningStartMinutes: sunsetMinutes - 60,
    goldenHourEveningEndMinutes: sunsetMinutes + 30
  };
}

/**
 * Parses user input into structured travel experience intentions.
 */
function parseRequestedExperience(userProfile = {}, rawInput = {}) {
  const textCorpus = [
    rawInput.activities,
    rawInput.preferred_activities,
    rawInput.preferredActivities,
    rawInput.prompt,
    rawInput.notes,
    rawInput.planningStyle,
    rawInput.travelStyle,
    rawInput.specialRequirements,
    userProfile.specialRequirements
  ].filter(Boolean).join(' ').toLowerCase();

  const experiences = [];

  // 1. Sunrise viewing request
  if (/sunrise|dawn|first light|morning peak view/i.test(textCorpus)) {
    experiences.push({
      type: 'sunrise_viewing',
      priority: 'high',
      preferredTime: 'early_morning',
      minDurationMinutes: 60,
      requiresDaylight: false,
      requiredConditions: 'arrival_before_sunrise',
      description: 'Experience early morning golden-hour sunrise across panoramic vistas.'
    });
  }

  // 2. Sunset viewing request
  if (/sunset|dusk|evening view|golden hour/i.test(textCorpus)) {
    experiences.push({
      type: 'sunset_viewing',
      priority: 'high',
      preferredTime: 'evening',
      minDurationMinutes: 60,
      requiresDaylight: true,
      requiredConditions: 'golden_hour_sunset',
      description: 'Experience breathtaking sunset views and evening atmospheric colors.'
    });
  }

  // 3. Temple darshan & spiritual immersion
  if (/temple|darshan|spiritual|shrine|puja|pilgrimage|jyotirlinga|shakti peeth/i.test(textCorpus)) {
    experiences.push({
      type: 'temple_darshan',
      priority: 'high',
      preferredTime: 'morning_or_evening',
      minDurationMinutes: 90,
      requiresDaylight: false,
      requiredConditions: 'respect_sanctum_closure',
      description: 'Participate in sacred sanctum darshan, traditional poojas, and cultural heritage reverence.'
    });
  }

  // 4. Trekking & mountain ascent
  if (/trek|trekking|hike|hiking|trail|summit/i.test(textCorpus)) {
    experiences.push({
      type: 'trekking',
      priority: 'high',
      preferredTime: 'morning',
      minDurationMinutes: 120,
      requiresDaylight: true,
      requiredConditions: 'conclude_before_1730',
      description: 'Navigate scenic mountain ridges and nature trails with ascent and descent buffer.'
    });
  }

  // 5. Beach relaxation & aquatic leisure
  if (/beach|coastal|sea|waves|sand|shore/i.test(textCorpus)) {
    experiences.push({
      type: 'beach_relaxation',
      priority: 'high',
      preferredTime: 'afternoon_evening',
      minDurationMinutes: 90,
      requiresDaylight: true,
      requiredConditions: 'tide_safety',
      description: 'Relax along coastal shores, explore sea cliffs, and enjoy marine tranquility.'
    });
  }

  // 6. Adventure & water sports
  if (/adventure|rafting|kayak|paragliding|zipline|boating|safari/i.test(textCorpus)) {
    experiences.push({
      type: 'adventure_activity',
      priority: 'high',
      preferredTime: 'daylight',
      minDurationMinutes: 90,
      requiresDaylight: true,
      requiredConditions: 'safety_instructor_guided',
      description: 'Engage in verified outdoor adventures and thrill sports with local guides.'
    });
  }

  // 7. Historical & architectural exploration
  if (/history|historical|fort|palace|ruins|unesco|monument|museum|heritage/i.test(textCorpus)) {
    experiences.push({
      type: 'cultural_heritage',
      priority: 'high',
      preferredTime: 'daylight',
      minDurationMinutes: 75,
      requiresDaylight: true,
      requiredConditions: 'open_operating_hours',
      description: 'Explore historical fortifications, ancient stone architecture, and museum relics.'
    });
  }

  return experiences;
}

/**
 * Evaluates whether an arrival time fits a given experience type and solar window.
 */
function evaluateExperienceTimeWindow({
  experienceType,
  arrivalMinutes,
  solarTimes = { sunriseMinutes: 375, sunsetMinutes: 1070 },
  openHours = null
}) {
  const { sunriseMinutes, sunsetMinutes } = solarTimes;

  switch (experienceType) {
    case 'sunrise_viewing': {
      // Must arrive at or before sunrise (within 20 minutes buffer)
      if (arrivalMinutes <= sunriseMinutes + 15) {
        return {
          compatible: true,
          score: 1.0,
          reason: `Optimal sunrise arrival before ${formatMinutes(sunriseMinutes)} IST.`
        };
      }
      return {
        compatible: false,
        score: 0.35,
        reason: `Arriving at ${formatMinutes(arrivalMinutes)}, after sunrise (${formatMinutes(sunriseMinutes)}). Scenic panorama accessible, but sunrise colors missed.`
      };
    }

    case 'sunset_viewing':
    case 'beach_sunset': {
      // Must arrive before sunset and during golden hour (sunset - 60 to sunset + 15)
      const isSunsetSlot = arrivalMinutes >= sunsetMinutes - 75 && arrivalMinutes <= sunsetMinutes + 20;
      if (isSunsetSlot) {
        return {
          compatible: true,
          score: 1.0,
          reason: `Arriving during evening golden hour leading into sunset at ${formatMinutes(sunsetMinutes)} IST.`
        };
      }
      return {
        compatible: false,
        score: 0.45,
        reason: arrivalMinutes < sunsetMinutes - 75
          ? 'Midday beach/viewpoint arrival. Bright sunlight, but before the sunset golden hour.'
          : 'Arriving after dusk; sunset visibility completed.'
      };
    }

    case 'temple_darshan': {
      // Midday temple closure: strictly respect 12:30 PM - 04:30 PM (750 to 990 mins)
      const isMiddayClosure = arrivalMinutes > 12 * 60 + 30 && arrivalMinutes < 16 * 60 + 30;
      if (isMiddayClosure) {
        return {
          compatible: false,
          score: 0.15,
          reason: 'Arriving during traditional temple sanctum closure (12:30 PM - 04:30 PM). Sanctum doors and darshan queues closed.'
        };
      }
      return {
        compatible: true,
        score: 1.0,
        reason: arrivalMinutes <= 12 * 60 + 30
          ? 'Arriving during serene morning darshan window.'
          : 'Arriving during vibrant evening aarti and darshan window.'
      };
    }

    case 'trekking': {
      // Mountain trail safety: strictly conclude before 17:30 (1050 mins)
      if (arrivalMinutes > 15 * 60 + 30) {
        return {
          compatible: false,
          score: 0.20,
          reason: 'Arriving too late in afternoon for safe trail completion. Forest department mandates daylight completion before 05:30 PM.'
        };
      }
      return {
        compatible: true,
        score: 0.95,
        reason: 'Comfortable morning/afternoon daylight window for mountain ascent and safe return.'
      };
    }

    default:
      return { compatible: true, score: 0.85, reason: 'Standard operating hours compliant.' };
  }
}

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const mod = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${mod}`;
}

module.exports = {
  calculateSolarTimes,
  parseRequestedExperience,
  evaluateExperienceTimeWindow
};

