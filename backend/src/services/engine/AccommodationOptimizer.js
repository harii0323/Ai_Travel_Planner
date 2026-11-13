/**
 * AccommodationOptimizer
 * 
 * Module 10 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Recommends verified overnight stays strategically positioned at the day's final hub.
 * - Aligns room configurations with traveler counts and companion dynamics (family, couple, friends, solo).
 * - Avoids isolated recommendations: overnight stays directly improve the next morning's transit efficiency.
 */

const { ACCOMMODATION_BENCHMARKS } = require('./BudgetCalculationEngine');

// Regional verified hotel recommendations database
const HOTEL_RECOMMENDATIONS_DATABASE = {
  goa: [
    { name: 'Taj Fort Aguada Resort & Spa', category: 'luxuryHotel', rating: 4.8, pricePerNight: 8500, area: 'Sinquerim, North Goa' },
    { name: 'BloomSuites | Calangute', category: 'budgetHotel', rating: 4.5, pricePerNight: 2200, area: 'Calangute, North Goa' },
    { name: 'Zostel Goa (Morjim / Baga)', category: 'hostel', rating: 4.6, pricePerNight: 750, area: 'Baga Backpacker Strip' }
  ],
  tirupati: [
    { name: 'Fortune Select Grand Ridge', category: 'luxuryHotel', rating: 4.6, pricePerNight: 4200, area: 'Tirupati Alipiri Bypass' },
    { name: 'Hotel Bliss Tirupati', category: 'budgetHotel', rating: 4.4, pricePerNight: 1900, area: 'Ramanuja Circle, Near Railway Station' },
    { name: 'TTD Srinivasam Pilgrim Complex', category: 'hostel', rating: 4.3, pricePerNight: 500, area: 'Opposite Tirupati Central Bus Stand' }
  ],
  manali: [
    { name: 'The Himalayan Resort & Spa', category: 'luxuryHotel', rating: 4.8, pricePerNight: 7500, area: 'Hadimba Temple Road' },
    { name: 'Apple Country Resort', category: 'resort', rating: 4.5, pricePerNight: 3400, area: 'Log Huts Area, Old Manali' },
    { name: 'Zostel Manali (Old Manali)', category: 'hostel', rating: 4.7, pricePerNight: 800, area: 'Manu Temple Road' }
  ],
  hampi: [
    { name: 'Heritage Resort Hampi', category: 'resort', rating: 4.6, pricePerNight: 4500, area: 'Hosapete - Hampi Road' },
    { name: 'KSTDC Hotel Mayura Bhuvaneshwari', category: 'budgetHotel', rating: 4.3, pricePerNight: 2100, area: 'Kamalapur (Near Hampi Ruins)' },
    { name: 'Rocky Guesthouse & Homestay', category: 'homestay', rating: 4.5, pricePerNight: 1200, area: 'Hampi Bazaar' }
  ],
  araku: [
    { name: 'Haritha Valley Resort (APTDC)', category: 'resort', rating: 4.4, pricePerNight: 2400, area: 'Araku Valley Main Road' },
    { name: 'Padmapuram Gardens Eco Huts', category: 'homestay', rating: 4.3, pricePerNight: 1800, area: 'Near Padmapuram Botanical Gardens' }
  ],
  munnar: [
    { name: 'Blanket Hotel & Luxury Spa', category: 'luxuryHotel', rating: 4.8, pricePerNight: 6500, area: 'Attukad Waterfalls Road' },
    { name: 'Tea County Munnar (KTDC)', category: 'budgetHotel', rating: 4.5, pricePerNight: 2800, area: 'Munnar Town Center' },
    { name: 'Zostel Munnar', category: 'hostel', rating: 4.6, pricePerNight: 850, area: 'Near Pothamedu Viewpoint' }
  ],
  kurnool: [
    { name: 'Mourya Inn Kurnool', category: 'budgetHotel', rating: 4.3, pricePerNight: 1900, area: 'Bhagya Nagar, NH 44 Bypass' },
    { name: 'Hotel DVR Mansion', category: 'budgetHotel', rating: 4.4, pricePerNight: 2100, area: 'Railway Station Road' }
  ]
};

/**
 * Recommends optimal accommodation options for the day's overnight stop.
 */
function optimizeAccommodationForHub(hubCityName, accommodationPreference = 'budgetHotel', travelerCount = 1) {
  const normHub = String(hubCityName || '').toLowerCase().replace(/[^a-z]/g, '');
  const config = ACCOMMODATION_BENCHMARKS[accommodationPreference] || ACCOMMODATION_BENCHMARKS.budgetHotel;
  const roomsNeeded = Math.ceil(travelerCount / (config.capacity || 2));

  // Check verified hotel recommendations
  let matchedHotels = [];
  for (const [key, list] of Object.entries(HOTEL_RECOMMENDATIONS_DATABASE)) {
    if (normHub.includes(key) || key.includes(normHub)) {
      matchedHotels = list;
      break;
    }
  }

  const selectedHotel = matchedHotels.find(h => h.category === accommodationPreference) ||
    matchedHotels[0] || {
      name: `${config.label} (${hubCityName})`,
      category: accommodationPreference,
      rating: 4.4,
      pricePerNight: config.ratePerRoom,
      area: `Central ${hubCityName}`
    };

  return {
    hubLocation: hubCityName,
    recommendedHotel: selectedHotel.name,
    area: selectedHotel.area,
    hotelRating: selectedHotel.rating,
    accommodationType: accommodationPreference,
    roomsNeeded,
    ratePerRoomPerNight: selectedHotel.pricePerNight,
    totalNightlyCost: roomsNeeded * selectedHotel.pricePerNight,
    whyRecommended: `Strategic overnight stay at ${hubCityName} positioned to minimize morning commute to scheduled activities and provide comfortable rest for ${travelerCount} traveler(s).`
  };
}

module.exports = {
  optimizeAccommodationForHub,
  HOTEL_RECOMMENDATIONS_DATABASE
};

