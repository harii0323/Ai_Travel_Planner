/**
 * MultiDayContinuityPlanner
 * 
 * Enforces strict multi-day geographical and chronological continuity:
 * - Day 1 end == Day 2 start, Day 2 end == Day 3 start, etc.
 * - Progresses steadily toward final destination without arbitrary resets or premature stops
 * - Generates full multi-day journey covering onward, destination stay, and return phases
 * - Seamless integration for Hyderabad to Kerala (Munnar / Kochi / Wayanad) road trips
 */

const { buildDay1HyderabadToSrisailamKurnool } = require('./dailyItineraryBuilder');
const { parseTimeToMinutes, formatMinutesTo12 } = require('./timeWindowScheduler');

/**
 * Builds all sequential days for a multi-day trip ensuring unbroken location continuity
 */
function planMultiDayContinuity({
  origin = 'Hyderabad',
  destination = 'Munnar, Kerala',
  destinationCity = 'Munnar',
  startDate,
  totalDays = 5,
  isRoundTrip = true,
  normalizedInterests = {},
  numberOfTravelers = 4,
  vehicleDetails = { vehicleType: 'car', fuelType: 'petrol', mileage: 15 },
  fuelPrice = 105.5,
  departureTime = '04:30 AM',
  accommodationType = 'budgetHotel',
  includeSrisailamDetour = true
}) {
  const dayPlans = [];
  const safeTotalDays = Math.max(1, Math.min(14, totalDays));

  // Determine phases
  let onwardDays = 2;
  let destinationDays = 1;
  let returnDays = 2;

  if (safeTotalDays === 1) {
    onwardDays = 1;
    destinationDays = 0;
    returnDays = 0;
  } else if (safeTotalDays === 2) {
    onwardDays = 1;
    destinationDays = 0;
    returnDays = 1;
  } else if (safeTotalDays === 3) {
    onwardDays = 1;
    destinationDays = 1;
    returnDays = 1;
  } else if (safeTotalDays === 4) {
    onwardDays = 2;
    destinationDays = 1;
    returnDays = 1;
  } else if (safeTotalDays === 5) {
    onwardDays = 2;
    destinationDays = 1;
    returnDays = 2;
  } else if (safeTotalDays >= 6) {
    onwardDays = 2;
    destinationDays = safeTotalDays - 4;
    returnDays = 2;
  }

  const getDateForDay = (dayIdx) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayIdx);
    return d.toISOString().split('T')[0];
  };

  let currentDepartureCity = origin;

  // -------------------------------------------------------------
  // DAY 1: Origin -> Intermediate Hub 1 (e.g. Hyderabad -> Kurnool)
  // -------------------------------------------------------------
  const isHydToKeralaWithSpiritualScenic =
    String(origin).toLowerCase().includes('hyderabad') &&
    (String(destination).toLowerCase().includes('kerala') || String(destination).toLowerCase().includes('munnar')) &&
    (normalizedInterests.temple >= 0.8 || normalizedInterests.photography >= 0.8 || includeSrisailamDetour);

  if (isHydToKeralaWithSpiritualScenic) {
    const day1 = buildDay1HyderabadToSrisailamKurnool({
      dayNumber: 1,
      dateString: getDateForDay(0),
      startLocation: origin,
      departureTime,
      normalizedInterests,
      numberOfTravelers,
      vehicleDetails,
      fuelPrice
    });
    dayPlans.push(day1);
    currentDepartureCity = day1.endLocation; // 'Kurnool'
  } else {
    // Standard direct onward Day 1
    const day1ArrivalCity = safeTotalDays === 1 ? destinationCity : 'Kurnool';
    const day1Dist = safeTotalDays === 1 ? 400 : 215;
    const day1Fuel = Math.round((day1Dist / vehicleDetails.mileage) * fuelPrice);
    const day1Hotel = safeTotalDays === 1 ? 0 : Math.ceil(numberOfTravelers / 2) * 1800;

    dayPlans.push({
      day: 1,
      date: getDateForDay(0),
      startLocation: origin,
      endLocation: day1ArrivalCity,
      phase: 'Onward Journey',
      departureTime: '06:00 AM',
      arrivalTime: '02:30 PM',
      totalDayDistanceKm: day1Dist,
      totalDayDrivingMinutes: 240,
      timeline: [
        {
          time: '06:00 AM – 06:20 AM',
          place: `Depart from ${origin} (Highway Onward Transit)`,
          category: 'travel',
          travelTime: '0 mins (0 km)',
          visitDuration: '20 mins',
          cost: `₹${day1Fuel}`,
          reason: `Early start along the 4-lane highway toward ${day1ArrivalCity}.`
        },
        {
          time: '08:30 AM – 09:15 AM',
          place: 'Highway Breakfast Halt (NH 44 Corridor)',
          category: 'meal',
          travelTime: '130 mins (120 km transit)',
          visitDuration: '45 mins',
          cost: `₹${120 * numberOfTravelers}`,
          reason: 'Highway dining and driver coffee break.'
        },
        {
          name: 'Konda Reddy Buruj (Kurnool Fort)',
          rating: 4.4,
          time: '11:00 AM – 12:15 PM',
          place: 'Konda Reddy Buruj (Kurnool Fort)',
          category: 'historical',
          travelTime: '105 mins (95 km highway transit)',
          visitDuration: '75 mins',
          cost: '₹0',
          reason: 'Historical landmark exploration matching cultural and heritage preferences.'
        },
        {
          time: '01:00 PM – 02:00 PM',
          place: 'Regional Lunch in Kurnool',
          category: 'meal',
          travelTime: '15 mins',
          visitDuration: '60 mins',
          cost: `₹${180 * numberOfTravelers}`,
          reason: 'Midday meal break.'
        },
        {
          time: '06:30 PM – 08:00 PM',
          place: `Dinner & Intermediate Overnight Stay at ${accommodationType || 'budgetHotel'} (${day1ArrivalCity})`,
          category: 'hotel',
          travelTime: '30 mins (25 km transit)',
          visitDuration: 'Overnight Rest',
          cost: `₹${day1Hotel}`,
          reason: `Rest before resuming onward travel to ${destinationCity}.`
        }
      ],
      activities: [{ name: 'Konda Reddy Buruj (Kurnool Fort)', category: 'historical', rating: 4.4, travelTime: '105 mins (95 km highway transit)' }],
      stops: [{ name: 'Kurnool Fort', category: 'historical', rating: 4.4 }],
      cost: {
        day: 1,
        fuel: day1Fuel,
        tolls: 240,
        food: 300 * numberOfTravelers,
        accommodation: day1Hotel,
        localTransport: 0,
        entryFees: 0,
        activities: 0,
        parking: 50,
        dayTotal: day1Fuel + 240 + 300 * numberOfTravelers + day1Hotel + 50
      },
      plan: `**Onward Journey - Day 1: ${origin} → ${day1ArrivalCity}**\n\nDirect highway transit along NH 44 with stops at Kurnool Fort and highway amenities.`
    });
    currentDepartureCity = day1ArrivalCity;
  }

  // -------------------------------------------------------------
  // DAY 2: Intermediate Hub 1 -> Final Destination Arrival (e.g. Kurnool -> Munnar)
  // -------------------------------------------------------------
  if (safeTotalDays >= 2) {
    const isArrivingToday = onwardDays === 2 || safeTotalDays <= 3;
    const day2EndCity = isArrivingToday ? destinationCity : 'Hosur (Bengaluru Outskirts)';
    const day2Dist = isArrivingToday ? 480 : 380;
    const day2Fuel = Math.round((day2Dist / vehicleDetails.mileage) * fuelPrice);
    const day2Hotel = Math.ceil(numberOfTravelers / 2) * 1900;

    const day2Timeline = [
      {
        time: '06:30 AM – 06:50 AM',
        place: `Depart from ${currentDepartureCity} (Resuming Onward Journey)`,
        category: 'travel',
        travelTime: '0 mins',
        visitDuration: '20 mins',
        cost: '₹0',
        reason: `Early departure from Day 1 arrival hub (${currentDepartureCity}) to maximize daylight exploration.`
      },
      {
        time: '08:30 AM – 09:15 AM',
        place: 'Highway Breakfast Halt (Anantapur Corridor)',
        category: 'meal',
        travelTime: '100 mins (115 km transit)',
        visitDuration: '45 mins',
        cost: `₹${120 * numberOfTravelers}`,
        reason: 'Fresh South Indian breakfast and driver rest.'
      },
      {
        name: 'Veerabhadra Temple Lepakshi',
        rating: 4.7,
        time: '11:00 AM – 12:30 PM',
        place: 'Veerabhadra Temple (Lepakshi Hanging Pillar)',
        category: 'spiritual',
        travelTime: '105 mins (110 km highway + 14 km detour)',
        visitDuration: '90 mins',
        bestVisitWindow: 'Morning Architecture Window (08:00 AM - 12:30 PM)',
        cost: '₹0 (Free Entry)',
        reason: 'Iconic 16th-century Vijayanagara spiritual and architectural marvel featuring the famous hanging pillar, massive monolithic Nandi, and vibrant mural paintings. Strongly matches spiritual and photography interests.',
        coordinates: { lat: 13.8041, lng: 77.6083 }
      },
      {
        time: '01:00 PM – 02:00 PM',
        place: 'Regional Andhra Lunch Halt (Lepakshi / Bagepalli)',
        category: 'meal',
        travelTime: '20 mins',
        visitDuration: '60 mins',
        cost: `₹${180 * numberOfTravelers}`,
        reason: 'Traditional regional lunch.'
      },
      {
        name: 'Nandi Hills Viewpoint',
        rating: 4.5,
        time: '04:00 PM – 05:00 PM',
        place: 'Nandi Hills Scenic Viewpoint (Optional Sunset Halt)',
        category: 'scenic',
        travelTime: '120 mins (85 km transit)',
        visitDuration: '60 mins',
        cost: `₹${30 * numberOfTravelers}`,
        isOptional: true,
        reason: 'Scenic hill station overlooking Chikkaballapur valley with breezy sunset vistas.'
      },
      {
        time: '07:30 PM – 09:00 PM',
        place: isArrivingToday
          ? `Dinner & Final Destination Arrival at ${accommodationType} (${destinationCity})`
          : `Dinner & Intermediate Overnight Stay at ${accommodationType} (${day2EndCity})`,
        category: 'hotel',
        travelTime: '30 mins (25 km transit)',
        visitDuration: 'Overnight Rest',
        cost: `₹${day2Hotel} (Rooms) + ₹${220 * numberOfTravelers} (Dinner)`,
        reason: isArrivingToday
          ? `Arrival at final destination ${destinationCity}! Check in to resort or hotel and enjoy dinner.`
          : `Strategic overnight stop at ${day2EndCity} bypassing Bangalore city center traffic, perfectly poised on NH 44 / NH 544 for smooth morning entry into Tamil Nadu and Kerala tea hills.`
      }
    ];

    dayPlans.push({
      day: 2,
      date: getDateForDay(1),
      startLocation: currentDepartureCity, // Starts where Day 1 ended!
      endLocation: day2EndCity,
      phase: 'Onward Journey',
      departureTime: '06:30 AM',
      arrivalTime: '07:30 PM',
      totalDayDistanceKm: day2Dist,
      totalDayDrivingMinutes: 310,
      timeline: day2Timeline,
      activities: day2Timeline.filter(t => !['travel', 'meal', 'hotel'].includes(t.category)),
      stops: [
        { name: 'Veerabhadra Temple Lepakshi', category: 'spiritual', rating: 4.7 },
        { name: 'Nandi Hills Viewpoint', category: 'scenic', rating: 4.5 }
      ],
      cost: {
        day: 2,
        fuel: day2Fuel,
        tolls: 380,
        food: (120 + 180 + 220) * numberOfTravelers,
        accommodation: day2Hotel,
        localTransport: 0,
        entryFees: 30 * numberOfTravelers,
        activities: 0,
        parking: 80,
        dayTotal: day2Fuel + 380 + 520 * numberOfTravelers + day2Hotel + 80
      },
      plan: `**Onward Journey - Day 2: ${currentDepartureCity} → Lepakshi → ${day2EndCity}**\n\n` +
        `**Route:** Depart ${currentDepartureCity} south along NH 44.\n` +
        `**Key Highlights:** Spiritual exploration at Lepakshi Veerabhadra Temple (famous hanging pillar & monolithic Nandi), scenic bypass around Bangalore outskirts, and overnight arrival at ${day2EndCity}.`
    });
    currentDepartureCity = day2EndCity;
  }

  // -------------------------------------------------------------
  // DAY 3: Destination Stay or Mountain Exploration in Kerala (e.g. Munnar)
  // -------------------------------------------------------------
  if (safeTotalDays >= 3) {
    const isAlreadyAtDestination = currentDepartureCity.toLowerCase().includes(destinationCity.toLowerCase());
    const day3EndCity = destinationCity;
    const day3Dist = isAlreadyAtDestination ? 75 : 360;
    const day3Fuel = Math.round((day3Dist / vehicleDetails.mileage) * fuelPrice);
    const day3Hotel = Math.ceil(numberOfTravelers / 2) * 2200;

    const day3Timeline = isAlreadyAtDestination ? [
      {
        time: '07:30 AM – 08:30 AM',
        place: `Traditional Kerala Breakfast at Resort (${destinationCity})`,
        category: 'meal',
        travelTime: '0 mins',
        visitDuration: '60 mins',
        cost: `₹${140 * numberOfTravelers}`,
        reason: 'Fresh appams with vegetable stew and Kerala filter coffee.'
      },
      {
        name: 'Eravikulam National Park',
        rating: 4.6,
        time: '09:00 AM – 11:30 AM',
        place: 'Eravikulam National Park (Rajamalai Hills & Nilgiri Tahr Trek)',
        category: 'trekking',
        travelTime: '30 mins (12 km local transit)',
        visitDuration: '2 hr 30 min (including eco-safari bus & hill trek)',
        bestVisitWindow: 'Cool Morning Trek (08:30 AM - 11:30 AM)',
        cost: `₹${200 * numberOfTravelers} (Entry & Eco-Bus: ₹200/person)`,
        reason: 'High-altitude shola-grassland sanctuary protecting the endangered Nilgiri Tahr mountain goat against the towering Anamudi peak. Prime mountain trekking and landscape photography.',
        coordinates: { lat: 10.1518, lng: 77.0601 }
      },
      {
        time: '12:30 PM – 01:30 PM',
        place: `Local Dining in ${destinationCity} Town`,
        category: 'meal',
        travelTime: '20 mins',
        visitDuration: '60 mins',
        cost: `₹${200 * numberOfTravelers}`,
        reason: 'Midday Kerala dining.'
      },
      {
        name: 'Mattupetty Dam & Echo Point',
        rating: 4.4,
        time: '02:00 PM – 03:30 PM',
        place: 'Mattupetty Dam & Eco Point (Speed Boating & Echo Trail)',
        category: 'scenic',
        travelTime: '30 mins (14 km transit)',
        visitDuration: '90 mins',
        cost: `₹${50 * numberOfTravelers} + ₹${150 * numberOfTravelers} (Boating)`,
        reason: 'High-altitude concrete gravity dam reflecting green hills, offering speed boating across the reservoir and peaceful nature walks.',
        coordinates: { lat: 10.1064, lng: 77.1245 }
      },
      {
        name: 'Top Station Viewpoint',
        rating: 4.5,
        time: '04:15 PM – 06:15 PM',
        place: 'Top Station Panoramic Viewpoint (Western Ghats Vista)',
        category: 'scenic',
        travelTime: '45 mins (22 km mountain drive)',
        visitDuration: '2 hours',
        bestVisitWindow: 'Golden Hour & Cloud Carpet (04:30 PM - 06:15 PM)',
        cost: `₹${25 * numberOfTravelers}`,
        reason: 'Highest elevation viewpoint on Munnar ridge (6,170 ft) offering 360-degree panoramic views of clouds floating over the Tamil Nadu valley below.',
        coordinates: { lat: 10.1247, lng: 77.2447 }
      },
      {
        time: '07:30 PM – 09:00 PM',
        place: `Dinner & Overnight Resort Stay in ${destinationCity}`,
        category: 'hotel',
        travelTime: '30 mins (20 km return transit)',
        visitDuration: 'Overnight Rest',
        cost: `₹${day3Hotel} (Resort) + ₹${250 * numberOfTravelers} (Dinner)`,
        reason: `Restful evening at resort with authentic spice-infused dining, recounting mountain memories.`
      }
    ] : [
      {
        time: '06:00 AM – 06:20 AM',
        place: `Depart from ${currentDepartureCity} towards ${destinationCity}`,
        category: 'travel',
        travelTime: '0 mins',
        visitDuration: '20 mins',
        cost: '₹0',
        reason: `Early departure from ${currentDepartureCity} to enter the scenic Western Ghats gap road during golden daylight hours.`
      },
      {
        time: '08:00 AM – 08:45 AM',
        place: 'Highway Breakfast Halt (Salem / Dharmapuri Corridor)',
        category: 'meal',
        travelTime: '100 mins (110 km transit)',
        visitDuration: '45 mins',
        cost: `₹${120 * numberOfTravelers}`,
        reason: 'Traditional highway breakfast.'
      },
      {
        name: 'Chinnar Wildlife Sanctuary',
        rating: 4.5,
        time: '11:00 AM – 12:30 PM',
        place: 'Chinnar Wildlife Sanctuary (Riverine Trek & Giant Squirrel Trail)',
        category: 'wildlife',
        travelTime: '135 mins (120 km transit)',
        visitDuration: '90 mins',
        cost: `₹${100 * numberOfTravelers}`,
        reason: 'Protected rain-shadow biodiversity sanctuary on Kerala border. Short nature trek along the Chinnar river watching for grizzled giant squirrels and star tortoises.',
        coordinates: { lat: 10.3129, lng: 77.2023 }
      },
      {
        time: '01:00 PM – 02:00 PM',
        place: 'Authentic Kerala Meals (Marayoor Traditional Dining)',
        category: 'meal',
        travelTime: '20 mins (18 km transit)',
        visitDuration: '60 mins',
        cost: `₹${180 * numberOfTravelers}`,
        reason: 'Taste iconic Kerala red rice, sambar, avial, and local banana chips.'
      },
      {
        name: 'Marayoor Sandalwood Forest & Dolmens',
        rating: 4.6,
        time: '02:30 PM – 03:45 PM',
        place: 'Marayoor Sandalwood Forest & Megalithic Dolmens',
        category: 'historical',
        travelTime: '15 mins',
        visitDuration: '75 mins',
        cost: `₹${25 * numberOfTravelers}`,
        reason: 'Prehistoric stone dolmens (Muniyaras) dating back to the Iron Age, perched on rocky hillsides overlooking aromatic wild sandalwood groves.',
        coordinates: { lat: 10.2798, lng: 77.1601 }
      },
      {
        time: '05:30 PM – 08:00 PM',
        place: `Arrival & Check-in at Hillside Resort (${destinationCity}, Kerala)`,
        category: 'hotel',
        travelTime: '90 mins (42 km scenic tea hill climb)',
        visitDuration: 'Overnight Stay',
        cost: `₹${day3Hotel} (Resort) + ₹${250 * numberOfTravelers} (Dinner)`,
        reason: `Final destination arrival in ${destinationCity}! Check into hillside accommodation surrounded by rolling green tea estates, misty mountain breeze, and fresh regional dinner.`
      }
    ];

    dayPlans.push({
      day: 3,
      date: getDateForDay(2),
      startLocation: currentDepartureCity,
      endLocation: day3EndCity,
      phase: isAlreadyAtDestination ? 'Destination Stay' : 'Destination Arrival',
      departureTime: isAlreadyAtDestination ? '08:30 AM' : '06:00 AM',
      arrivalTime: '06:00 PM',
      totalDayDistanceKm: day3Dist,
      totalDayDrivingMinutes: isAlreadyAtDestination ? 120 : 340,
      timeline: day3Timeline,
      activities: day3Timeline.filter(t => !['travel', 'meal', 'hotel'].includes(t.category)),
      stops: isAlreadyAtDestination ? [
        { name: 'Eravikulam National Park', category: 'trekking', rating: 4.6 },
        { name: 'Mattupetty Dam & Echo Point', category: 'scenic', rating: 4.4 },
        { name: 'Top Station Viewpoint', category: 'scenic', rating: 4.5 }
      ] : [
        { name: 'Chinnar Wildlife Sanctuary', category: 'wildlife', rating: 4.5 },
        { name: 'Marayoor Dolmens & Sandalwood Forest', category: 'historical', rating: 4.6 }
      ],
      cost: {
        day: 3,
        fuel: day3Fuel,
        tolls: isAlreadyAtDestination ? 0 : 310,
        food: (120 + 180 + 250) * numberOfTravelers,
        accommodation: day3Hotel,
        localTransport: 0,
        entryFees: 200 * numberOfTravelers,
        activities: 150 * numberOfTravelers,
        parking: 60,
        dayTotal: day3Fuel + (isAlreadyAtDestination ? 0 : 310) + 550 * numberOfTravelers + day3Hotel + 60
      },
      plan: `**Destination Stay - Day 3: Full-Day Exploration of ${destinationCity}, Kerala**\n\n` +
        `**Focus:** Mountain vistas, Nilgiri Tahr wildlife trekking, lake boating, and high-altitude photography in ${destinationCity}.\n` +
        `**Highlights:** Eravikulam National Park, Mattupetty Dam, and Top Station viewpoint cloud vistas.`
    });
    currentDepartureCity = day3EndCity;
  }

  // -------------------------------------------------------------
  // DAY 4+: Return Journey or Extended Stay
  // For 5-day round trip: Day 4 is Return Journey Leg 1 (Munnar -> Salem / Bengaluru Outskirts)
  // -------------------------------------------------------------
  if (safeTotalDays >= 4) {
    const isReturnLeg = returnDays >= 2 && safeTotalDays === 5;
    const day4EndCity = isReturnLeg ? 'Salem / Bengaluru Outskirts' : destinationCity;
    const day4Dist = isReturnLeg ? 360 : 65;
    const day4Fuel = Math.round((day4Dist / vehicleDetails.mileage) * fuelPrice);
    const day4Hotel = Math.ceil(numberOfTravelers / 2) * 1900;

    const day4Timeline = isReturnLeg ? [
      {
        time: '06:30 AM – 06:50 AM',
        place: `Depart from ${currentDepartureCity} (Return Journey)`,
        category: 'travel',
        travelTime: '0 mins',
        visitDuration: '20 mins',
        cost: '₹0',
        reason: `Starting the return journey from ${currentDepartureCity} back towards ${day4EndCity}.`
      },
      {
        time: '08:30 AM – 09:15 AM',
        place: 'Highway Breakfast Halt (Theni / Dindigul Corridor)',
        category: 'meal',
        travelTime: '100 mins (90 km transit)',
        visitDuration: '45 mins',
        cost: `₹${120 * numberOfTravelers}`,
        reason: 'Highway breakfast.'
      },
      {
        name: 'Yercaud Hill Viewpoint or Hogenakkal Falls',
        rating: 4.5,
        time: '12:00 PM – 01:30 PM',
        place: 'Yercaud Hill Viewpoint or Hogenakkal Falls (Return Exploration)',
        category: 'scenic',
        travelTime: '150 mins (160 km transit)',
        visitDuration: '90 mins',
        cost: `₹${50 * numberOfTravelers}`,
        reason: 'New sightseeing experience on return leg ensuring no repetition of onward stops.'
      },
      {
        time: '01:45 PM – 02:45 PM',
        place: 'Highway Lunch Halt',
        category: 'meal',
        travelTime: '15 mins',
        visitDuration: '60 mins',
        cost: `₹${180 * numberOfTravelers}`,
        reason: 'Midday meal break.'
      },
      {
        time: '07:00 PM – 08:30 PM',
        place: `Dinner & Intermediate Overnight Stay at ${accommodationType} (${day4EndCity})`,
        category: 'hotel',
        travelTime: '30 mins (25 km transit)',
        visitDuration: 'Overnight Rest',
        cost: `₹${day4Hotel} (Hotel) + ₹${220 * numberOfTravelers} (Dinner)`,
        reason: `Safe overnight rest stop at ${day4EndCity} breaking up the return drive comfortably.`
      }
    ] : [
      {
        time: '07:30 AM – 08:30 AM',
        place: `Traditional Kerala Breakfast at Resort (${destinationCity})`,
        category: 'meal',
        travelTime: '0 mins',
        visitDuration: '60 mins',
        cost: `₹${140 * numberOfTravelers}`,
        reason: 'Fresh appams with vegetable stew and Kerala filter coffee.'
      },
      {
        name: 'Eravikulam National Park',
        rating: 4.6,
        time: '09:00 AM – 11:30 AM',
        place: 'Eravikulam National Park (Rajamalai Hills & Nilgiri Tahr Trek)',
        category: 'trekking',
        travelTime: '25 mins (12 km local transit)',
        visitDuration: '2 hr 30 min',
        cost: `₹${200 * numberOfTravelers}`,
        reason: 'Trekking among wild Nilgiri Tahr.'
      },
      {
        time: '07:30 PM – 09:00 PM',
        place: `Campfire Dinner & Night Stay in ${destinationCity}`,
        category: 'hotel',
        travelTime: '30 mins (15 km transit)',
        visitDuration: 'Overnight Rest',
        cost: `₹${day4Hotel}`,
        reason: 'Restful night in Munnar.'
      }
    ];

    dayPlans.push({
      day: 4,
      date: getDateForDay(3),
      startLocation: currentDepartureCity,
      endLocation: day4EndCity,
      phase: isReturnLeg ? 'Return Journey' : 'Destination Stay',
      departureTime: '06:30 AM',
      arrivalTime: '07:30 PM',
      totalDayDistanceKm: day4Dist,
      totalDayDrivingMinutes: isReturnLeg ? 320 : 135,
      timeline: day4Timeline,
      activities: day4Timeline.filter(t => !['travel', 'meal', 'hotel'].includes(t.category)),
      stops: [{ name: isReturnLeg ? 'Yercaud Viewpoint' : 'Eravikulam National Park', category: 'scenic', rating: 4.5 }],
      cost: {
        day: 4,
        fuel: day4Fuel,
        tolls: isReturnLeg ? 340 : 0,
        food: (120 + 180 + 220) * numberOfTravelers,
        accommodation: day4Hotel,
        localTransport: 0,
        entryFees: 50 * numberOfTravelers,
        activities: 0,
        parking: 60,
        dayTotal: day4Fuel + (isReturnLeg ? 340 : 0) + 520 * numberOfTravelers + day4Hotel + 60
      },
      plan: isReturnLeg
        ? `**Return Journey - Day 4: ${currentDepartureCity} → ${day4EndCity}**\n\nStarting return leg from ${destinationCity} towards ${day4EndCity} with scenic highway stops.`
        : `**Destination Stay - Day 4: Exploration of ${destinationCity}**`
    });
    currentDepartureCity = day4EndCity;
  }

  // -------------------------------------------------------------
  // DAY 5+: Return Journey back to Origin (e.g. Salem/Bengaluru -> Hyderabad)
  // -------------------------------------------------------------
  if (safeTotalDays >= 5) {
    for (let dayNum = 5; dayNum <= safeTotalDays; dayNum++) {
      const isFinalDay = dayNum === safeTotalDays;
      const returnEndCity = isFinalDay ? origin : 'Salem / Bengaluru Outskirts';
      const returnDist = isFinalDay && safeTotalDays === 5 ? 540 : 380;
      const returnFuel = Math.round((returnDist / vehicleDetails.mileage) * fuelPrice);
      const returnHotel = isFinalDay ? 0 : Math.ceil(numberOfTravelers / 2) * 1800;

      const returnTimeline = [
        {
          time: '06:30 AM – 06:50 AM',
          place: `Depart from ${currentDepartureCity} (Final Return Leg)`,
          category: 'travel',
          travelTime: '0 mins',
          visitDuration: '20 mins',
          cost: '₹0',
          reason: `Starting final return journey from ${currentDepartureCity} back to original home location (${origin}).`
        },
        {
          time: '08:30 AM – 09:15 AM',
          place: 'Highway Breakfast Halt (Anantapur Corridor)',
          category: 'meal',
          travelTime: '100 mins (90 km transit)',
          visitDuration: '45 mins',
          cost: `₹${120 * numberOfTravelers}`,
          reason: 'Highway breakfast.'
        },
        {
          name: 'Belum Caves or Gandikota Canyon',
          rating: 4.6,
          time: '12:00 PM – 01:30 PM',
          place: 'Belum Caves or Gandikota Canyon (Return Exploration)',
          category: 'scenic',
          travelTime: '150 mins (160 km transit)',
          visitDuration: '90 mins',
          cost: `₹${50 * numberOfTravelers}`,
          reason: 'New sightseeing experience on return leg ensuring no repetition of onward stops.'
        },
        {
          time: '01:45 PM – 02:45 PM',
          place: 'Highway Lunch Halt',
          category: 'meal',
          travelTime: '15 mins',
          visitDuration: '60 mins',
          cost: `₹${180 * numberOfTravelers}`,
          reason: 'Midday meal break.'
        },
        {
          time: '07:30 PM – 08:30 PM',
          place: isFinalDay ? `Arrival Back at Origin (${origin}) — Trip Completed` : `Overnight Stay at ${returnEndCity}`,
          category: 'hotel',
          travelTime: '240 mins (250 km highway driving)',
          visitDuration: isFinalDay ? 'Trip Completion' : 'Overnight Rest',
          cost: isFinalDay ? '₹0' : `₹${returnHotel}`,
          reason: isFinalDay
            ? `Safe return to original starting location (${origin}). Unload luggage, vehicle post-trip inspection, and celebrate a memorable multi-day journey!`
            : `Safe overnight rest stop at ${returnEndCity} breaking up the return drive comfortably.`
        }
      ];

      dayPlans.push({
        day: dayNum,
        date: getDateForDay(dayNum - 1),
        startLocation: currentDepartureCity,
        endLocation: returnEndCity,
        phase: 'Return Journey',
        departureTime: '06:30 AM',
        arrivalTime: isFinalDay ? '08:00 PM' : '07:00 PM',
        totalDayDistanceKm: returnDist,
        totalDayDrivingMinutes: 380,
        timeline: returnTimeline,
        activities: returnTimeline.filter(t => !['travel', 'meal', 'hotel'].includes(t.category)),
        stops: [{ name: isFinalDay ? 'Belum Caves Canyon' : 'Yercaud Viewpoint', category: 'scenic', rating: 4.5 }],
        cost: {
          day: dayNum,
          fuel: returnFuel,
          tolls: 380,
          food: (120 + 180 + 200) * numberOfTravelers,
          accommodation: returnHotel,
          localTransport: 0,
          entryFees: 50 * numberOfTravelers,
          activities: 0,
          parking: 60,
          dayTotal: returnFuel + 380 + 500 * numberOfTravelers + returnHotel + 60
        },
        plan: `**Return Journey - Day ${dayNum}: ${currentDepartureCity} → ${returnEndCity}**\n\n` +
          `**Route:** Smooth return transit along highway corridor.\n` +
          `**Focus:** Safe driving pace, distinct return viewpoints, and ${isFinalDay ? `arrival back home in ${origin}` : `comfortable overnight stay in ${returnEndCity}`}.`
      });
      currentDepartureCity = returnEndCity;
    }
  }

  return dayPlans;
}

module.exports = {
  planMultiDayContinuity
};
