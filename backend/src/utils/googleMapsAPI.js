const axios = require('axios');

/**
 * Google Maps APIs utility
 * Supports Distance Matrix, Directions, and Places APIs
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

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
    const response = await axios.get(GOOGLE_MAPS_BASE_URL, {
      params: {
        origins: origin,
        destinations: destination,
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving', // Use driving mode for road distance
        units: 'metric'  // Use kilometers
      },
      timeout: 5000 // 5 second timeout
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

    const response = await axios.get(GOOGLE_MAPS_BASE_URL, {
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
    console.log(`🗺️ Google Directions API: Getting route from ${origin} to ${destination}`);

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
      mode,
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

    const routes = response.data.routes.map(route => ({
      summary: route.summary,
      distance: Math.round(route.legs[0].distance.value / 1000),
      duration: route.legs[0].duration.text,
      durationValue: route.legs[0].duration.value,
      steps: route.legs[0].steps.map(step => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        distance: step.distance.text,
        duration: step.duration.text
      })),
      polyline: route.overview_polyline.points
    }));

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

/**
 * Find places along a route using Google Places API
 * @param {string} location - Location to search around
 * @param {string} type - Place type (restaurant, tourist_attraction, etc.)
 * @param {number} radius - Search radius in meters
 * @param {string} keyword - Optional keyword to filter results
 * @returns {Promise<Array<{name: string, location: Object, rating: number, types: Array}>>}
 */
async function findPlacesNearby(location, type = 'tourist_attraction', radius = 50000, keyword = '') {
  try {
    console.log(`🏛️ Google Places API: Finding ${type} near ${location}`);

    if (!GOOGLE_MAPS_API_KEY) {
      return [];
    }

    const params = {
      location,
      type,
      radius,
      key: GOOGLE_MAPS_API_KEY
    };

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
  hasGoogleMapsAPI: () => {
    const hasKey = !!GOOGLE_MAPS_API_KEY;
    console.log(`🔑 Google Maps API Key Check: ${hasKey ? '✅ Present' : '❌ Missing'}`);
    if (hasKey) {
      console.log(`🔑 API Key (first 20 chars): ${GOOGLE_MAPS_API_KEY.substring(0, 20)}...`);
    }
    return hasKey;
  }
};
