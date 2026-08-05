const axios = require('axios');

/**
 * Google Maps APIs utility
 * Supports Distance Matrix, Directions, and Places APIs
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_DIRECTIONS_MODES = new Set(['driving', 'walking', 'bicycling', 'transit']);
const geocodeCache = new Map();

const maskedApiKey = GOOGLE_MAPS_API_KEY
  ? `${GOOGLE_MAPS_API_KEY.substring(0, 8)}...${GOOGLE_MAPS_API_KEY.substring(GOOGLE_MAPS_API_KEY.length - 4)}`
  : null;
console.log(`🔑 Google Maps API key ${GOOGLE_MAPS_API_KEY ? 'configured' : 'missing'}${maskedApiKey ? ` (${maskedApiKey})` : ''}`);

function buildDistanceMatrixParams(origin, destination) {
  return {
    origins: origin,
    destinations: destination,
    key: GOOGLE_MAPS_API_KEY,
    mode: 'driving',
    units: 'metric'
  };
}

function normalizeDirectionsMode(mode = 'driving') {
  const normalizedMode = String(mode || 'driving').trim().toLowerCase();

  if (GOOGLE_DIRECTIONS_MODES.has(normalizedMode)) {
    return normalizedMode;
  }

  const modeMap = {
    bus: 'transit',
    train: 'transit',
    metro: 'transit',
    public: 'transit',
    car: 'driving',
    cab: 'driving',
    taxi: 'driving',
    own: 'driving',
    bike: 'driving',
    motorcycle: 'driving',
    flight: 'driving'
  };

  return modeMap[normalizedMode] || 'driving';
}

/**
 * Validate the Google Maps API key by making a simple Distance Matrix request.
 * @returns {Promise<{ok: boolean, status: string, error: string|null, distance: number|null, duration: string|null}>}
 */
async function validateGoogleMapsApiKey() {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log('🔑 Google Maps API health check: API key not configured');
    return {
      ok: false,
      status: 'NO_KEY',
      error: 'Google Maps API key not configured',
      distance: null,
      duration: null
    };
  }

  try {
    const response = await axios.get(DISTANCE_MATRIX_URL, {
      params: buildDistanceMatrixParams('New York, NY', 'Los Angeles, CA'),
      timeout: 5000
    });

    console.log('🔍 Google Maps API health check response status:', response.status);
    console.log('🔍 Google Maps API health check data status:', response.data.status);

    if (response.data.status !== 'OK') {
      return {
        ok: false,
        status: response.data.status,
        error: `Google Maps API error: ${response.data.status}`,
        distance: null,
        duration: null
      };
    }

    const element = response.data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return {
        ok: false,
        status: element?.status || 'NO_ROUTE',
        error: `Health check route status: ${element?.status || 'NO_ROUTE'}`,
        distance: null,
        duration: null
      };
    }

    return {
      ok: true,
      status: 'OK',
      error: null,
      distance: Math.round(element.distance.value / 1000),
      duration: element.duration.text
    };
  } catch (error) {
    console.error('🔌 Google Maps API health check failed:', error.message);
    return {
      ok: false,
      status: 'REQUEST_FAILED',
      error: error.message,
      distance: null,
      duration: null
    };
  }
}

/**
 * Calculate distance between two locations using Google Maps API
 * @param {string} origin - Starting location
 * @param {string} destination - Ending location
 * @returns {Promise<{distance: number, duration: string, error: string|null}>}
 */
async function getDistanceFromGoogleMaps(origin, destination) {
  try {
    console.log(`🔍 Google Maps API: Checking distance from ${origin} to ${destination}`);
    
    // Check if API key is configured
    if (!GOOGLE_MAPS_API_KEY) {
      console.log('❌ Google Maps API: No API key configured');
      return {
        distance: null,
        duration: null,
        error: 'Google Maps API key not configured',
        source: 'error'
      };
    }

    console.log('✅ Google Maps API: API key found, making request...');
    
    // Call Google Maps Distance Matrix API
    const response = await axios.get(DISTANCE_MATRIX_URL, {
      params: buildDistanceMatrixParams(origin, destination),
      timeout: 5000
    });

    console.log('📡 Google Maps API: Response received');
    console.log('📊 Google Maps API: Response status:', response.status);
    console.log('📊 Google Maps API: Response data status:', response.data.status);

    // Check if request was successful
    if (response.data.status !== 'OK') {
      console.log('❌ Google Maps API: Response status not OK:', response.data.status);
      return {
        distance: null,
        duration: null,
        error: `Google Maps API error: ${response.data.status}`,
        source: 'google_maps_error'
      };
    }

    // Extract results from the response
    const rows = response.data.rows;
    if (!rows || rows.length === 0 || !rows[0].elements) {
      return {
        distance: null,
        duration: null,
        error: 'No route found between locations',
        source: 'no_route'
      };
    }

    const element = rows[0].elements[0];
    
    console.log('📊 Google Maps API: Element status:', element.status);
    
    // Check if route exists
    if (element.status !== 'OK') {
      console.log('❌ Google Maps API: Element status not OK:', element.status);
      return {
        distance: null,
        duration: null,
        error: `Route status: ${element.status}`,
        source: 'route_not_found'
      };
    }

    // Extract distance in kilometers and duration
    const distanceKm = Math.round(element.distance.value / 1000);
    const durationText = element.duration.text;

    console.log(`✅ Google Maps API: Success! Distance: ${distanceKm} km, Duration: ${durationText}`);

    return {
      distance: distanceKm,
      duration: durationText,
      error: null,
      source: 'google_maps'
    };
  } catch (error) {
    console.error('Google Maps API error:', error.message);
    return {
      distance: null,
      duration: null,
      error: `API request failed: ${error.message}`,
      source: 'request_error'
    };
  }
}

/**
 * Calculate distances for multiple locations (batch request)
 * @param {string} origin - Starting location
 * @param {Array<string>} destinations - List of destination locations
 * @returns {Promise<Array<{location: string, distance: number, duration: string}>>}
 */
async function getDistancesToMultipleLocations(origin, destinations) {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return destinations.map(dest => ({
        location: dest,
        distance: null,
        duration: null,
        source: 'error'
      }));
    }

    const response = await axios.get(DISTANCE_MATRIX_URL, {
      params: {
        origins: origin,
        destinations: destinations.join('|'),
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        units: 'metric'
      },
      timeout: 5000
    });

    if (response.data.status !== 'OK') {
      return destinations.map(dest => ({
        location: dest,
        distance: null,
        duration: null,
        source: 'error'
      }));
    }

    const results = [];
    const elements = response.data.rows[0]?.elements || [];

    elements.forEach((element, index) => {
      if (element.status === 'OK') {
        results.push({
          location: destinations[index],
          distance: Math.round(element.distance.value / 1000),
          duration: element.duration.text,
          source: 'google_maps'
        });
      } else {
        results.push({
          location: destinations[index],
          distance: null,
          duration: null,
          source: 'route_not_found'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Batch distance API error:', error.message);
    return destinations.map(dest => ({
      location: dest,
      distance: null,
      duration: null,
      source: 'error'
    }));
  }
}

/**
 * Get detailed route with directions using Google Directions API
 * @param {string} origin - Starting location
 * @param {string} destination - Ending location
 * @param {Array<string>} waypoints - Optional intermediate waypoints
 * @param {string} mode - Travel mode (driving, walking, bicycling, transit)
 * @returns {Promise<{routes: Array, distance: number, duration: string, error: string|null}>}
 */
async function getDirectionsFromGoogleMaps(origin, destination, waypoints = [], mode = 'driving') {
  try {
    const directionsMode = normalizeDirectionsMode(mode);
    const waypointText = waypoints.length ? ` via ${waypoints.length} waypoint(s)` : '';
    const modeText = directionsMode !== mode ? ` (${mode} mapped to ${directionsMode})` : ` (${directionsMode})`;
    console.log(`🗺️ Google Directions API: Getting route from ${origin} to ${destination}${waypointText}${modeText}`);

    if (!GOOGLE_MAPS_API_KEY) {
      return {
        routes: [],
        distance: null,
        duration: null,
        error: 'Google Maps API key not configured'
      };
    }

    const params = {
      origin,
      destination,
      key: GOOGLE_MAPS_API_KEY,
      mode: directionsMode,
      units: 'metric',
      alternatives: true // Get alternative routes
    };

    if (waypoints.length > 0) {
      params.waypoints = waypoints.join('|');
    }

    const response = await axios.get(DIRECTIONS_URL, {
      params,
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      return {
        routes: [],
        distance: null,
        duration: null,
        error: `Directions API error: ${response.data.status}`
      };
    }

    const routes = response.data.routes.map(route => {
      const distanceMeters = route.legs.reduce((total, leg) => total + (leg.distance?.value || 0), 0);
      const durationSeconds = route.legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0);
      const steps = route.legs.flatMap(leg => leg.steps || []);

      return {
        summary: route.summary,
        distance: Math.round(distanceMeters / 1000),
        duration: formatDuration(durationSeconds),
        durationValue: durationSeconds,
        steps: steps.map(step => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
          distance: step.distance.text,
          distanceValue: step.distance?.value || 0,
          duration: step.duration.text,
          durationValue: step.duration?.value || 0,
          startLocation: step.start_location || null,
          endLocation: step.end_location || null
        })),
        polyline: route.overview_polyline.points
      };
    });

    // Return the primary route details
    const primaryRoute = routes[0] || {};

    return {
      routes,
      distance: primaryRoute.distance || null,
      duration: primaryRoute.duration || null,
      error: null
    };
  } catch (error) {
    console.error('Directions API error:', error.message);
    return {
      routes: [],
      distance: null,
      duration: null,
      error: `API request failed: ${error.message}`
    };
  }
}

function formatDuration(totalSeconds) {
  const totalMinutes = Math.round(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) {
    parts.push(`${days} day${days === 1 ? '' : 's'}`);
  }
  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }
  if (minutes || parts.length === 0) {
    parts.push(`${minutes} min${minutes === 1 ? '' : 's'}`);
  }

  return parts.join(' ');
}

/**
 * Find places along a route using Google Places API
 * @param {string} location - Location to search around
 * @param {string} type - Place type (restaurant, tourist_attraction, etc.)
 * @param {number} radius - Search radius in meters
 * @param {string} keyword - Optional keyword to filter results
 * @returns {Promise<Array<{name: string, location: Object, rating: number, types: Array}>>}
 */
async function getLatLngForLocation(location) {
  if (!location || typeof location !== 'string') {
    return null;
  }

  // If location is already lat,lng, use it directly
  const coordMatch = location.match(/^\s*([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)\s*$/);
  if (coordMatch) {
    return `${coordMatch[1]},${coordMatch[2]}`;
  }

  const cacheKey = location.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    console.log(`🔍 Geocoding location for Places search: ${location}`);
    const response = await axios.get(GEOCODE_URL, {
      params: {
        address: location,
        key: GOOGLE_MAPS_API_KEY
      },
      timeout: 5000
    });

    if (response.data.status !== 'OK' || !response.data.results?.length) {
      console.log('❌ Geocoding failed:', response.data.status);
      return null;
    }

    const { lat, lng } = response.data.results[0].geometry.location;
    const resolvedLocation = `${lat},${lng}`;
    geocodeCache.set(cacheKey, resolvedLocation);
    return resolvedLocation;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
}

async function findPlacesNearby(location, type = 'tourist_attraction', radius = 50000, keyword = '') {
  try {
    console.log(`🏛️ Google Places API: Finding ${type} near ${location}`);

    if (!GOOGLE_MAPS_API_KEY) {
      return [];
    }

    const resolvedLocation = await getLatLngForLocation(location);
    if (!resolvedLocation) {
      console.log(`❌ Google Places API: Cannot resolve location for nearby search: ${location}`);
      return [];
    }

    const nearbyTypeWhitelist = new Set([
      'amusement_park', 'aquarium', 'art_gallery', 'bakery', 'bank', 'bar',
      'beauty_salon', 'bicycle_store', 'book_store', 'bowling_alley', 'bus_station',
      'cafe', 'campground', 'car_dealer', 'car_rental', 'car_repair', 'car_wash',
      'casino', 'cemetery', 'church', 'city_hall', 'clothing_store', 'convenience_store',
      'courthouse', 'dentist', 'department_store', 'doctor', 'electrician',
      'electronics_store', 'embassy', 'fire_station', 'florist', 'funeral_home',
      'furniture_store', 'gas_station', 'gym', 'hair_care', 'hardware_store',
      'hindu_temple', 'home_goods_store', 'hospital', 'insurance_agency',
      'jewelry_store', 'laundry', 'lawyer', 'library', 'liquor_store',
      'local_government_office', 'locksmith', 'lodging', 'meal_delivery',
      'meal_takeaway', 'mosque', 'movie_rental', 'movie_theater', 'moving_company',
      'museum', 'night_club', 'park', 'parking', 'pet_store', 'pharmacy',
      'physiotherapist', 'plumber', 'police', 'post_office', 'real_estate_agency',
      'restaurant', 'roofing_contractor', 'rv_park', 'school', 'shoe_store',
      'shopping_mall', 'spa', 'stadium', 'storage', 'store', 'subway_station',
      'supermarket', 'synagogue', 'taxi_stand', 'train_station', 'transit_station',
      'travel_agency', 'university', 'veterinary_care', 'zoo'
    ]);

    const params = {
      location: resolvedLocation,
      radius,
      key: GOOGLE_MAPS_API_KEY
    };

    if (nearbyTypeWhitelist.has(type)) {
      params.type = type;
    } else {
      params.keyword = type.replace(/_/g, ' ');
      console.log(`ℹ️ Places Nearby: using keyword search for unsupported type '${type}'`);
    }

    if (keyword) {
      params.keyword = keyword;
    }

    const response = await axios.get(PLACES_NEARBY_URL, {
      params,
      timeout: 5000
    });

    if (response.data.status !== 'OK') {
      console.log(`Places API error: ${response.data.status}`);
      return [];
    }

    const places = response.data.results.map(place => ({
      name: place.name,
      placeId: place.place_id,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      rating: place.rating || 0,
      userRatingsTotal: place.user_ratings_total || 0,
      types: place.types || [],
      vicinity: place.vicinity || '',
      priceLevel: place.price_level || null,
      photos: place.photos ? place.photos.map(photo => ({
        photoReference: photo.photo_reference,
        width: photo.width,
        height: photo.height
      })) : []
    }));

    // Sort by rating (highest first)
    places.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return places;
  } catch (error) {
    console.error('Places API error:', error.message);
    return [];
  }
}

/**
 * Search for places by text query using Google Places Text Search API
 * @param {string} query - Text search query
 * @param {string} location - Optional location bias
 * @returns {Promise<Array<{name: string, location: Object, rating: number}>>}
 */
async function searchPlacesByText(query, location = '') {
  try {
    console.log(`🔍 Google Places Text Search: "${query}"`);

    if (!GOOGLE_MAPS_API_KEY) {
      return [];
    }

    const params = {
      query,
      key: GOOGLE_MAPS_API_KEY
    };

    if (location) {
      params.location = location;
    }

    const response = await axios.get(PLACES_TEXT_SEARCH_URL, {
      params,
      timeout: 5000
    });

    if (response.data.status !== 'OK') {
      console.log(`Places Text Search API error: ${response.data.status}`);
      return [];
    }

    const places = response.data.results.map(place => ({
      name: place.name,
      placeId: place.place_id,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      rating: place.rating || 0,
      userRatingsTotal: place.user_ratings_total || 0,
      types: place.types || [],
      formattedAddress: place.formatted_address || '',
      priceLevel: place.price_level || null
    }));

    return places;
  } catch (error) {
    console.error('Places Text Search API error:', error.message);
    return [];
  }
}

module.exports = {
  getDistanceFromGoogleMaps,
  getDistancesToMultipleLocations,
  getDirectionsFromGoogleMaps,
  findPlacesNearby,
  searchPlacesByText,
  validateGoogleMapsApiKey,
  hasGoogleMapsAPI: () => {
    const hasKey = !!GOOGLE_MAPS_API_KEY;
    console.log(`🔑 Google Maps API Key Check: ${hasKey ? '✅ Present' : '❌ Missing'}`);
    if (hasKey) {
      console.log(`🔑 API Key (first 20 chars): ${GOOGLE_MAPS_API_KEY.substring(0, 20)}...`);
    }
    return hasKey;
  }
};
