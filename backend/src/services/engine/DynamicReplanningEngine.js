/**
 * DynamicReplanningEngine
 * 
 * Module 11 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Recalculates affected itinerary days and stops when delays, skipped stops, or preference shifts occur.
 * - Preserves completed activities without unnecessary complete regeneration.
 * - Dynamically shifts timelines and sheds lowest-priority stops to preserve curfew or operating hour safety.
 */

const { parseTimeToMinutes, formatMinutesTo12 } = require('./TravelContextBuilder');

/**
 * Replans a day's timeline when an unexpected delay occurs.
 */
function replanTimelineWithDelay({
  dayPlan,
  delayMinutes = 45,
  currentStopIndex = 0,
  trafficAlert = null
}) {
  if (!dayPlan || !Array.isArray(dayPlan.timeline)) {
    return dayPlan;
  }

  const updatedTimeline = [];
  let cumDelay = Number(delayMinutes) || 30;

  for (let i = 0; i < dayPlan.timeline.length; i++) {
    const item = { ...dayPlan.timeline[i] };

    // If stop is before current stop index, preserve as completed
    if (i < currentStopIndex) {
      item.status = 'COMPLETED';
      updatedTimeline.push(item);
      continue;
    }

    // Shift times
    const timeMatch = (item.time || '').match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (timeMatch) {
      const origStartMins = parseTimeToMinutes(timeMatch[1]);
      const origEndMins = parseTimeToMinutes(timeMatch[2]);
      const duration = origEndMins - origStartMins;

      const newStartMins = origStartMins + cumDelay;
      const newEndMins = newStartMins + duration;

      item.time = `${formatMinutesTo12(newStartMins)} – ${formatMinutesTo12(newEndMins)}`;
      item.arrivalTime = formatMinutesTo12(newStartMins);
      item.departureTime = formatMinutesTo12(newEndMins);
      item.adjustedForDelayMinutes = cumDelay;
    }

    // Check if this stop now extends past closing time or causes late evening arrival (> 09:30 PM)
    const endMinutes = item.departureTime ? parseTimeToMinutes(item.departureTime) : 0;
    const isLateEvening = endMinutes > 21 * 60 + 30;

    // If an optional or low-priority sightseeing activity causes significant delay, offer to shed it
    if (isLateEvening && !['travel', 'meal', 'hotel'].includes(item.category) && item.preferenceMatch < 0.85) {
      item.replanAdvisory = `Dropped or made optional due to ${delayMinutes} min delay to ensure on-time arrival at overnight hotel.`;
      item.isSkippedToRecoverBuffer = true;
      cumDelay = Math.max(0, cumDelay - (item.visitDurationMinutes || 60));
    }

    updatedTimeline.push(item);
  }

  return {
    ...dayPlan,
    timeline: updatedTimeline,
    hasReplanned: true,
    delayShiftMinutes: delayMinutes,
    trafficAlert: trafficAlert || 'Schedule adjusted for real-time delay.'
  };
}

module.exports = {
  replanTimelineWithDelay
};

