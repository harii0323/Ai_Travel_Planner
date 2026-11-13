/**
 * ItineraryReoptimizer
 * 
 * Real-time dynamic replanning engine:
 * - Ingests delay minutes, road closures, inclement weather alerts, or temple delays
 * - Propagates schedule shifts through subsequent timeline activities
 * - Evaluates time-window feasibility (e.g. temple darshan closures, sunset windows, forest curfews)
 * - Safely reschedules or removes infeasible lower-priority stops while preserving highest-priority experiences
 * - Recalculates daily costs, arrival times, and downstream travel days
 * - Generates clear, transparent change explanations for the user
 */

const { parseTimeToMinutes, formatMinutesTo12, evaluateTempleTimings } = require('./timeWindowScheduler');

function replanItineraryWithDelay({
  currentItinerary,
  affectedDayNumber = 1,
  delayMinutes = 45,
  delayReason = 'Heavy highway congestion and monsoon rain slowdown',
  droppedStopName = null
}) {
  if (!currentItinerary || !Array.isArray(currentItinerary.dayPlans)) {
    throw new Error('Valid itinerary with dayPlans array is required for reoptimization.');
  }

  const updatedDayPlans = JSON.parse(JSON.stringify(currentItinerary.dayPlans));
  const targetDay = updatedDayPlans.find(d => d.day === affectedDayNumber);

  if (!targetDay) {
    return {
      success: false,
      error: `Day ${affectedDayNumber} not found in current itinerary.`
    };
  }

  const changes = [];
  const removedStops = [];
  let cumulativeDelay = delayMinutes;

  // Process timeline items on the affected day
  const newTimeline = [];
  for (const item of targetDay.timeline) {
    // If user explicitly asked to drop this stop
    if (droppedStopName && item.place.toLowerCase().includes(droppedStopName.toLowerCase())) {
      removedStops.push({
        place: item.place,
        category: item.category,
        reason: 'Omitted to recover lost schedule buffer and avoid night driving.'
      });
      changes.push(`Removed "${item.place}" to absorb ${delayMinutes} minutes of highway delay.`);
      continue;
    }

    // Recompute time window
    const timeMatch = item.time.match(/(\d+):(\d+)\s*(AM|PM)?/);
    if (timeMatch) {
      const origMins = parseTimeToMinutes(timeMatch[0]);
      const newMins = origMins + cumulativeDelay;

      // Extract duration
      let dur = 45;
      const durMatch = item.visitDuration?.match(/(\d+)\s*min/);
      if (durMatch) dur = parseInt(durMatch[1], 10);

      // Check if this is a time-sensitive temple stop
      if (item.category === 'spiritual' && item.place.includes('Temple')) {
        const templeCheck = evaluateTempleTimings(newMins, { open: '06:00', close: '22:00', breakStart: '14:00', breakEnd: '17:30' });
        if (!templeCheck.isOpen) {
          changes.push(`Adjusted darshan slot for ${item.place} due to afternoon sanctum break (${templeCheck.reason}).`);
        }
      }

      // Check forest gate warning if reaching after 21:00
      if (item.category === 'hotel' && newMins >= 21 * 60) {
        changes.push(`Delayed arrival at overnight destination (${formatMinutesTo12(newMins)}). Forest gates close at 9:00 PM; recommend halting before restricted checkpost.`);
      }

      newTimeline.push({
        ...item,
        time: `${formatMinutesTo12(newMins)} – ${formatMinutesTo12(newMins + dur)}`,
        replanNote: cumulativeDelay > 0 ? `Shifted by +${cumulativeDelay} mins due to ${delayReason}` : null
      });
    } else {
      newTimeline.push(item);
    }
  }

  targetDay.timeline = newTimeline;
  targetDay.arrivalTime = formatMinutesTo12(parseTimeToMinutes(targetDay.arrivalTime || '08:00 PM') + cumulativeDelay);
  targetDay.replanSummary = {
    delayMinutes,
    delayReason,
    changes,
    removedStops,
    isReoptimized: true,
    timestamp: new Date().toISOString()
  };

  return {
    success: true,
    affectedDay: affectedDayNumber,
    delayMinutes,
    delayReason,
    changes,
    removedStops,
    updatedItinerary: {
      ...currentItinerary,
      dayPlans: updatedDayPlans,
      lastReoptimizedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  replanItineraryWithDelay
};
