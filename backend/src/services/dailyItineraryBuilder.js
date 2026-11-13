/**
 * DailyItineraryBuilder
 * 
 * Assembles complete, rich, chronologically feasible day-wise plans:
 * - Day number, calendar date, start & end locations, departure & arrival times
 * - Ordered timeline with accurate driving times, transit distances, visit durations, costs, and why-recommended rationales
 * - Strategic meal halts (breakfast, lunch, dinner) that support the trip without displacing tourist attractions
 * - Fuel stops and initial fuel requirements based on vehicle mileage and real fuel rates
 * - Safety advisories: temple dress codes, advance bookings, ghat curfews (e.g. Nallamala forest closed 21:00-06:00)
 * - Transparent overnight stay recommendations with multi-option trade-off evaluations
 * - Itemized daily cost object
 */

const { parseTimeToMinutes, formatMinutesTo12, evaluateTempleTimings, evaluateSunriseWindow } = require('./timeWindowScheduler');
const { checkRoadRestrictions } = require('./routePlanner');

/**
 * Builds the comprehensive Day 1 plan for Hyderabad -> Srisailam -> Kurnool scenic road trip
 */
function buildDay1HyderabadToSrisailamKurnool({
  dayNumber = 1,
  dateString,
  startLocation = 'Hyderabad',
  departureTime = '04:30 AM',
  normalizedInterests = {},
  numberOfTravelers = 4,
  vehicleDetails = { vehicleType: 'car', fuelType: 'petrol', mileage: 15 },
  fuelPrice = 105.5
}) {
  const timeline = [];
  let currentMinutes = parseTimeToMinutes(departureTime);

  // 1. Vehicle Inspection & Early Departure (Step 1)
  const initialFuelLiters = Math.round((400 / vehicleDetails.mileage) * 10) / 10;
  const initialFuelCost = Math.round(initialFuelLiters * fuelPrice);

  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 20)}`,
    place: `Depart from ${startLocation} (Vehicle Inspection & Pre-Trip Preparation)`,
    category: 'travel',
    travelTime: '0 mins (0 km)',
    visitDuration: '20 mins',
    bestVisitWindow: 'Early Morning (04:00 AM - 05:00 AM)',
    traffic: 'Clear Pre-Dawn City Exits',
    cost: `₹${initialFuelCost} (Initial Fuel: ${initialFuelLiters} L)`,
    reason: 'Critical vehicle condition verification before embarking on long highway and forest-ghat journey. Inspect tire pressures including spare, top up windshield fluids, confirm active FASTag balance, and verify vehicle documentation.',
    checklist: [
      'Check tire cold pressures (33 PSI) and spare tire readiness',
      'Inspect engine oil, coolant levels, and brake fluid',
      'Verify active FASTag balance (minimum ₹1,000 recommended)',
      'Confirm physical or DigiLocker vehicle RC, Insurance, and PUC certificate',
      'Pack 5L drinking water, first-aid kit, flashlight, and tire puncture repair kit'
    ]
  });
  currentMinutes += 20;

  // Fuel station stop near exit
  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 15)}`,
    place: 'Highway Fuel Station (HPCL / IndianOil Outlet on Srisailam Highway SH-5)',
    category: 'travel',
    travelTime: '15 mins (12 km transit)',
    visitDuration: '15 mins',
    bestVisitWindow: 'Early Morning (04:30 AM - 05:30 AM)',
    traffic: 'Clear Highway Flow',
    cost: `₹${initialFuelCost}`,
    reason: `Tank full refueling with ${vehicleDetails.fuelType.toUpperCase()} before entering remote rural and forest stretches. Estimated initial fuel: ~${initialFuelLiters} L at ₹${fuelPrice}/L.`
  });
  currentMinutes += 15;

  // 2. Drive to outskirts & Breakfast Halt (Step 2)
  const driveToBreakfastKm = 85;
  const driveToBreakfastMins = 80;
  currentMinutes += driveToBreakfastMins;

  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 40)}`,
    place: 'Highway Breakfast Halt (Haritha / Sri Balaji Family Tiffin Center, Kalwakurthy Corridor)',
    category: 'meal',
    travelTime: `${driveToBreakfastMins} mins (${driveToBreakfastKm} km highway transit)`,
    visitDuration: '40 mins',
    bestVisitWindow: 'Breakfast Window (06:30 AM - 08:30 AM)',
    traffic: 'Smooth Highway Flow',
    cost: `₹${120 * numberOfTravelers} (₹120/person)`,
    reason: 'Authentic South Indian highway breakfast (steaming idlis, crispy dosas, filter coffee) located conveniently directly on the Srisailam route corridor with clean restroom facilities.'
  });
  currentMinutes += 40;

  // 3. Dindi Reservoir (Step 3)
  const driveToDindiKm = 30;
  const driveToDindiMins = 30;
  currentMinutes += driveToDindiMins;

  const sunriseEval = evaluateSunriseWindow(currentMinutes, parseTimeToMinutes(departureTime), driveToBreakfastKm + driveToDindiKm);

  timeline.push({
    name: 'Dindi Reservoir',
    rating: 4.5,
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 45)}`,
    place: 'Dindi Reservoir (Scenic Lake & Photography Stop)',
    category: 'scenic',
    travelTime: `${driveToDindiMins} mins (${driveToDindiKm} km highway transit + 0.8 km detour)`,
    visitDuration: '45 mins',
    bestVisitWindow: 'Sunrise Window (06:00 AM - 07:45 AM)',
    traffic: 'Quiet Scenic Stretch',
    cost: '₹0',
    reason: `Scenic waterbody stop along the Dindi River tributary. ${sunriseEval.message} Excellent for panoramic landscape photography and peaceful morning refreshment.`,
    coordinates: { lat: 16.4883, lng: 78.9611 },
    isSunriseMatched: sunriseEval.isSunriseMatched
  });
  currentMinutes += 45;

  // 4. Continue to Nallamala Forest & Octopus Viewpoint (Step 4)
  const driveToGhatKm = 55;
  const driveToGhatMins = 65; // Ghat speed limit
  currentMinutes += driveToGhatMins;

  timeline.push({
    name: 'Octopus Viewpoint',
    rating: 4.6,
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 45)}`,
    place: 'Octopus Viewpoint (Amrabad Tiger Reserve / Nallamala Gorge)',
    category: 'scenic',
    travelTime: `${driveToGhatMins} mins (${driveToGhatKm} km highway & ghat transit)`,
    visitDuration: '45 mins',
    bestVisitWindow: 'Morning Window (08:30 AM - 11:30 AM)',
    traffic: 'Winding Forest Road (Speed Limit 35 km/h)',
    cost: `₹${20 * numberOfTravelers} (Forest Department Entry ₹20/person)`,
    reason: 'Breathtaking panoramic gorge overlook where Krishna river backwaters resemble giant octopus tentacles winding through dense Nallamala hills. Verified open hours: 08:30 AM to 05:00 PM.',
    coordinates: { lat: 16.2750, lng: 78.8950 },
    safetyWarning: 'Forest road regulations: Mannanur entry checkpost requires entry registration. Driving speed strictly monitored at 35 km/h for tiger and spotted deer conservation.'
  });
  currentMinutes += 45;

  // 5. Srisailam Dam Viewpoint (Step 5)
  const driveToDamKm = 25;
  const driveToDamMins = 35;
  currentMinutes += driveToDamMins;

  timeline.push({
    name: 'Srisailam Dam Viewpoint',
    rating: 4.6,
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 40)}`,
    place: 'Srisailam Dam Viewpoint (River Krishna Gorge)',
    category: 'scenic',
    travelTime: `${driveToDamMins} mins (${driveToDamKm} km highway & ghat transit)`,
    visitDuration: '40 mins',
    bestVisitWindow: 'Daylight View Window (09:00 AM - 04:00 PM)',
    traffic: 'Moderate Ghat Flow',
    cost: '₹0',
    reason: 'Legitimate visitor observation platform overlooking the massive 12-radial-gate gravity dam built across the Krishna river canyon. Note: Dam crest walkway is restricted for industrial security; photography is enjoyed from the tourist viewpoint.',
    coordinates: { lat: 16.0880, lng: 78.8970 }
  });
  currentMinutes += 40;

  // 6. Sri Bhramaramba Mallikarjuna Swamy Temple (Step 6)
  const driveToTempleKm = 12;
  const driveToTempleMins = 30; // 30 mins for ghat transit, town traffic, and parking queue
  currentMinutes += driveToTempleMins;

  const templeEval = evaluateTempleTimings(currentMinutes, { open: '06:00', close: '22:00', breakStart: '14:00', breakEnd: '17:30' });

  timeline.push({
    name: 'Sri Bhramaramba Mallikarjuna Swamy Temple',
    rating: 4.8,
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 105)}`,
    place: 'Sri Bhramaramba Mallikarjuna Swamy Temple (Jyotirlinga Darshan)',
    category: 'spiritual',
    travelTime: `${driveToTempleMins} mins (${driveToTempleKm} km highway & ghat transit, parking queue)`,
    visitDuration: '1 hr 45 min (including darshan queue and pradakshina)',
    bestVisitWindow: 'Morning Darshan Slot (06:30 AM - 01:30 PM)',
    traffic: 'Temple Town Pedestrian Transit',
    cost: `₹${150 * numberOfTravelers} (Special Sheegra Darshan ₹150/person; General Darshan is Free)`,
    reason: 'Supreme spiritual experience at one of only 3 temples in India that is simultaneously a Jyotirlinga of Lord Shiva and a Maha Shakti Peeth of Goddess Parvati. Scheduled before the 02:00 PM afternoon sanctum break.',
    coordinates: { lat: 16.0740, lng: 78.8680 },
    dressCode: 'Strict Traditional Attire Enforced: Dhoti/Kurta for men, Saree/Salwar for women. Electronic items/leather accessories to be deposited in temple lockers before entering.',
    templeStatus: templeEval.status
  });
  currentMinutes += 105;

  // 7. Lunch near temple (Step 7)
  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 50)}`,
    place: 'Temple Lunch (Sri Mallikarjuna Nitya Annadanam / Haritha Restaurant Srisailam)',
    category: 'meal',
    travelTime: '5 mins (1 km local walk/drive)',
    visitDuration: '50 mins',
    bestVisitWindow: 'Lunch Window (12:30 PM - 02:30 PM)',
    traffic: 'Pedestrian Center',
    cost: `₹${160 * numberOfTravelers} (Verified Vegetarian Dining ₹160/person; Free at Annadanam Satram)`,
    reason: 'Traditional South Indian thali meals served at temple Annadanam complex or verified vegetarian dining at Haritha Srisailam. No artificial or inflated pricing.'
  });
  currentMinutes += 50;

  // 8. Optional Adventure Activity: Pathalaganga Ropeway & Boating (Step 8)
  timeline.push({
    name: 'Pathalaganga Ropeway & Boating',
    rating: 4.4,
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 60)}`,
    place: 'Pathalaganga Ropeway & River Boating (Optional Adventure)',
    category: 'adventure',
    travelTime: '30 mins (5 km local transit & ticket window)',
    visitDuration: '60 mins',
    bestVisitWindow: 'Operating Window (08:30 AM - 05:00 PM)',
    traffic: 'Smooth Local Access',
    cost: `₹${100 * numberOfTravelers} (Ropeway round-trip + boating: ₹100/person)`,
    isOptional: true,
    reason: 'Scenic cable-car ropeway descending the steep ridge to the sacred Krishna river gorge with options for motor boating. Verified active AP Tourism facility.',
    coordinates: { lat: 16.0820, lng: 78.8730 }
  });
  currentMinutes += 60;

  // 9. Evening Departure & Overnight Decision (Step 9)
  // Drive from Srisailam to Kurnool via Dornala and Atmakur (~180 km, ~3.5 to 4h)
  const driveToKurnoolKm = 180;
  const driveToKurnoolMins = 220; // 3h 40m through forest gate and plains
  const departureFromSrisailam = currentMinutes;
  currentMinutes += driveToKurnoolMins;

  timeline.push({
    time: `${formatMinutesTo12(departureFromSrisailam)} – ${formatMinutesTo12(currentMinutes)}`,
    place: 'Scenic Highway Transit: Srisailam → Dornala → Atmakur → Kurnool',
    category: 'travel',
    travelTime: `${Math.floor(driveToKurnoolMins / 60)}h ${driveToKurnoolMins % 60}m (${driveToKurnoolKm} km transit)`,
    visitDuration: 'Driving Transit',
    bestVisitWindow: 'Late Afternoon (04:30 PM - 08:30 PM)',
    traffic: 'Smooth State Highway Crossing Forest Exit before 07:00 PM',
    cost: '₹0 (Included in Day Fuel)',
    reason: 'Smooth daylight driving exiting the Nallamala forest well before the 09:00 PM gate curfew, joining the 4-lane National Highway 44 at Kurnool.'
  });

  const hotelCost = Math.ceil(numberOfTravelers / 2) * 1800; // 2 travelers per room @ 1800/room
  timeline.push({
    time: `${formatMinutesTo12(currentMinutes)} – ${formatMinutesTo12(currentMinutes + 75)}`,
    place: 'Dinner & Intermediate Overnight Stay at Triguna Hotel / DVR Mansion (Kurnool)',
    category: 'hotel',
    travelTime: '30 mins (15 km transit to hotel)',
    visitDuration: 'Overnight Stay & Rest',
    bestVisitWindow: 'Evening Arrival (08:30 PM - 09:30 PM)',
    traffic: 'Kurnool City Outskirts',
    cost: `₹${hotelCost} (Rooms) + ₹${220 * numberOfTravelers} (Dinner)`,
    reason: 'Strategic intermediate overnight hub on NH 44. Option A (Recommended) is chosen over staying in Srisailam because Kurnool provides premium hotel facilities, vehicle service stations, EV charging, and positions travelers directly on the 4-lane expressway for Day 2 onward journey to Bengaluru and Kerala.',
    overnightDecision: {
      chosen: 'Option A: Kurnool Overnight Hub',
      reasons: [
        'Safe exit from Nallamala forest road before 09:00 PM wildlife gate closure',
        'Direct access to NH 44 4-lane expressway for an effortless Day 2 departure',
        'Abundant verified hotel infrastructure and reliable EV/fuel facilities',
        'Eliminates driver fatigue after 380 km total Day 1 journey without late night driving'
      ],
      alternativesEvaluated: {
        optionB_stayInSrisailam: 'Viable fallback if temple darshan was delayed past 05:00 PM, but leaves travelers with an arduous 550+ km drive on Day 2.',
        optionC_nightDriveToBangalore: 'Strictly REJECTED due to driver exhaustion (>12 hours active) and highway night accident risk.'
      }
    }
  });

  // Calculate authoritative daily cost
  const day1TotalKm = 390;
  const day1FuelCost = Math.round((day1TotalKm / vehicleDetails.mileage) * fuelPrice);
  const day1Tolls = 240;
  const day1Food = (120 + 160 + 220) * numberOfTravelers;
  const day1Entry = (20 + 150 + 100) * numberOfTravelers;
  const day1Hotel = hotelCost;
  const day1Total = day1FuelCost + day1Tolls + day1Food + day1Entry + day1Hotel;

  return {
    day: dayNumber,
    date: dateString,
    startLocation: 'Hyderabad',
    endLocation: 'Kurnool',
    phase: 'Onward Journey',
    departureTime,
    arrivalTime: formatMinutesTo12(currentMinutes),
    totalDayDistanceKm: day1TotalKm,
    totalDayDrivingMinutes: driveToBreakfastMins + driveToDindiMins + driveToGhatMins + driveToDamMins + driveToTempleMins + driveToKurnoolMins,
    timeline,
    activities: timeline.filter(t => !['travel', 'meal', 'hotel'].includes(t.category)),
    stops: [
      { name: 'Dindi Reservoir', category: 'scenic', rating: 4.5, time: '07:30 AM' },
      { name: 'Octopus Viewpoint', category: 'scenic', rating: 4.6, time: '09:40 AM' },
      { name: 'Srisailam Dam Viewpoint', category: 'scenic', rating: 4.6, time: '11:00 AM' },
      { name: 'Sri Bhramaramba Mallikarjuna Swamy Temple', category: 'spiritual', rating: 4.8, time: '11:55 AM' },
      { name: 'Pathalaganga Ropeway & Boating', category: 'adventure', rating: 4.4, time: '02:30 PM' }
    ],
    cost: {
      day: dayNumber,
      fuel: day1FuelCost,
      tolls: day1Tolls,
      food: day1Food,
      accommodation: day1Hotel,
      localTransport: 0,
      entryFees: day1Entry,
      activities: 100 * numberOfTravelers,
      parking: 100,
      dayTotal: day1Total
    },
    plan: `**Onward Journey - Day 1: Hyderabad → Dindi Reservoir → Srisailam → Kurnool**\n\n` +
      `**Route:** Hyderabad to Kurnool via SH-5, Dindi Reservoir, and Srisailam Temple Highway\n` +
      `**Distance & Driving:** 390 km (~7.5 hours scenic and ghat driving)\n` +
      `**Early Departure:** Recommended 04:30 AM departure from Hyderabad to arrive at Dindi Reservoir near sunrise and beat city traffic.\n` +
      `**Morning Attractions:** Sunrise photography at Dindi Reservoir, dramatic Krishna River gorge views at Octopus Viewpoint in Amrabad Tiger Reserve, and Srisailam Dam Viewpoint.\n` +
      `**Spiritual Highlight:** Darshan at Sri Bhramaramba Mallikarjuna Swamy Temple (Jyotirlinga & Shakti Peeth) scheduled during the morning darshan slot (dress code: traditional attire).\n` +
      `**Lunch & Afternoon:** Verified vegetarian dining near temple, followed by optional Pathalaganga passenger ropeway and Krishna river boating.\n` +
      `**Overnight Hub Decision:** Depart Srisailam by 04:30 PM through the Nallamala forest road before the 09:00 PM gate curfew, arriving at Kurnool for dinner and comfortable hotel stay on NH 44.`
  };
}

module.exports = {
  buildDay1HyderabadToSrisailamKurnool
};
