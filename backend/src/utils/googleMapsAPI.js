const axios = require("axios");

/* ============================================================
 * GOOGLE MAPS INTELLIGENT ROUTE RECOMMENDATION ENGINE
 * Version: 2.0
 * ============================================================
 *
 * Features
 * --------
 * ✓ Route Sampling
 * ✓ Search Zone Generation
 * ✓ Intelligent Attraction Ranking
 * ✓ Places Cache
 * ✓ Geocode Cache
 * ✓ Recommendation Score
 * ✓ Duplicate Removal
 * ✓ Parallel API Requests
 * ✓ Popularity Based Ranking
 * ✓ Detour Estimation
 * ✓ Route Compatibility
 *
 * ============================================================
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const DISTANCE_MATRIX_URL =
    "https://maps.googleapis.com/maps/api/distancematrix/json";

const DIRECTIONS_URL =
    "https://maps.googleapis.com/maps/api/directions/json";

const ROUTES_API_URL =
    "https://routes.googleapis.com/directions/v2:computeRoutes";

const GEOCODE_URL =
    "https://maps.googleapis.com/maps/api/geocode/json";

const PLACES_NEARBY_URL =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

const PLACES_TEXT_SEARCH_URL =
    "https://maps.googleapis.com/maps/api/place/textsearch/json";

/* ============================================================
 * CONFIGURATION
 * ============================================================
 */

const CONFIG = {

    // Sample route every 60km
    ROUTE_SAMPLE_DISTANCE_KM: 60,

    // Search radius
    SEARCH_RADIUS: 30000,

    // Max search radius
    MAX_RADIUS: 40000,

    // Minimum rating
    MIN_RATING: 4.2,

    // Minimum reviews
    MIN_REVIEWS: 100,

    // Maximum recommendations
    MAX_RESULTS_PER_ZONE: 3,

    // Parallel searches
    MAX_PARALLEL_SEARCHES: 5,

    // Cache Time
    CACHE_TIME: 1000 * 60 * 60,

    // Retry count
    MAX_RETRIES: 2
};

/* ============================================================
 * MEMORY CACHES
 * ============================================================
 */

const geocodeCache = new Map();

const placesCache = new Map();

const directionsCache = new Map();

/* ============================================================
 * HIGH PRIORITY CATEGORIES
 * ============================================================
 */

const CATEGORY_WEIGHTS = {

    waterfall: 100,

    national_park: 95,

    wildlife: 92,

    hill_station: 90,

    scenic_viewpoint: 88,

    unesco: 87,

    fort: 86,

    palace: 84,

    temple: 82,

    cave: 80,

    beach: 78,

    lake: 76,

    dam: 74,

    trekking: 72,

    adventure: 70,

    amusement_park: 65,

    museum: 40,

    art_gallery: 20,

    park: 10
};

/* ============================================================
 * SEARCH KEYWORDS
 * ============================================================
 */

const SEARCH_KEYWORDS = [

    "tourist attractions",

    "places to visit",

    "famous places",

    "sightseeing",

    "waterfalls",

    "hill station",

    "view point",

    "national park",

    "wildlife sanctuary",

    "fort",

    "heritage",

    "temple",

    "beach",

    "lake",

    "cave"
];

/* ============================================================
 * UTILITY FUNCTIONS
 * ============================================================
 */

function sleep(ms){

    return new Promise(resolve=>setTimeout(resolve,ms));

}

function cacheGet(cache,key){

    const value=cache.get(key);

    if(!value) return null;

    if(Date.now()>value.expiry){

        cache.delete(key);

        return null;

    }

    return value.data;

}

function cacheSet(cache,key,data){

    cache.set(key,{

        data,

        expiry:Date.now()+CONFIG.CACHE_TIME

    });

}

function normalizeText(text){

    return String(text)

        .trim()

        .toLowerCase();

}

function logScore(place){

    const reviews=place.userRatingsTotal||0;

    return Math.log10(reviews+1)*10;

}

function categoryWeight(types=[]){

    let weight=0;

    types.forEach(type=>{

        if(CATEGORY_WEIGHTS[type]){

            weight=Math.max(weight,CATEGORY_WEIGHTS[type]);

        }

    });

    return weight;

}
/* ============================================================
 * POLYLINE DECODER
 * ============================================================
 */

function decodePolyline(encoded) {

    if (!encoded) return [];

    let index = 0;
    let lat = 0;
    let lng = 0;

    const coordinates = [];

    while (index < encoded.length) {

        let b;
        let shift = 0;
        let result = 0;

        do {

            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;

        } while (b >= 0x20);

        const deltaLat = ((result & 1)
            ? ~(result >> 1)
            : (result >> 1));

        lat += deltaLat;

        shift = 0;
        result = 0;

        do {

            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;

        } while (b >= 0x20);

        const deltaLng = ((result & 1)
            ? ~(result >> 1)
            : (result >> 1));

        lng += deltaLng;

        coordinates.push({

            lat: lat / 1e5,
            lng: lng / 1e5

        });

    }

    return coordinates;

}

/* ============================================================
 * HAVERSINE DISTANCE
 * ============================================================
 */

function haversineDistance(lat1, lng1, lat2, lng2) {

    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;

    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

}

/* ============================================================
 * POLYLINE LENGTH
 * ============================================================
 */

function polylineLength(points) {

    let total = 0;

    for (let i = 1; i < points.length; i++) {

        total += haversineDistance(
            points[i - 1].lat,
            points[i - 1].lng,
            points[i].lat,
            points[i].lng
        );

    }

    return total;

}

/* ============================================================
 * SAMPLE ROUTE EVERY 60 KM
 * ============================================================
 */

function sampleRoute(points) {

    if (points.length === 0)
        return [];

    const samples = [points[0]];

    let accumulated = 0;

    for (let i = 1; i < points.length; i++) {

        accumulated += haversineDistance(
            points[i - 1].lat,
            points[i - 1].lng,
            points[i].lat,
            points[i].lng
        );

        if (accumulated >= CONFIG.ROUTE_SAMPLE_DISTANCE_KM) {

            samples.push(points[i]);

            accumulated = 0;

        }

    }

    if (
        samples[samples.length - 1] !==
        points[points.length - 1]
    ) {

        samples.push(points[points.length - 1]);

    }

    return samples;

}

/* ============================================================
 * CREATE SEARCH ZONES
 * ============================================================
 */

function createSearchZones(samples) {

    return samples.map((point, index) => ({

        id: index + 1,

        center: point,

        radius: CONFIG.SEARCH_RADIUS,

        searched: false

    }));

}

/* ============================================================
 * DISTANCE FROM ROUTE
 * ============================================================
 */

function distanceFromRoute(place, routePoints) {

    let minimum = Infinity;

    for (const point of routePoints) {

        const d = haversineDistance(
            place.location.lat,
            place.location.lng,
            point.lat,
            point.lng
        );

        if (d < minimum)
            minimum = d;

    }

    return minimum;

}

/* ============================================================
 * DETOUR TIME
 * ============================================================
 */

function estimateDetour(distanceKm) {

    const averageSpeed = 50;

    return Math.round((distanceKm * 2 / averageSpeed) * 60);

}

/* ============================================================
 * DUPLICATE DETECTION
 * ============================================================
 */

function removeDuplicatePlaces(places) {

    const unique = new Map();

    for (const place of places) {

        const key = normalizeText(place.placeId || place.name);

        if (!unique.has(key)) {

            unique.set(key, place);

            continue;

        }

        const existing = unique.get(key);

        if (
            place.recommendationScore >
            existing.recommendationScore
        ) {

            unique.set(key, place);

        }

    }

    return [...unique.values()];

}

/* ============================================================
 * RECOMMENDATION SCORE
 * ============================================================
 */

function calculateRecommendationScore(place, distanceKm = 0) {

    const rating = (place.rating || 0) * 20;

    const popularity = logScore(place);

    const category = categoryWeight(place.types);

    const distanceScore =
        Math.max(0, 40 - distanceKm);

    const score =
        rating * 0.35 +
        popularity * 0.30 +
        category * 0.20 +
        distanceScore * 0.15;

    return Number(score.toFixed(2));

}

/* ============================================================
 * SORT BY SCORE
 * ============================================================
 */

function rankPlaces(places) {

    return places

        .map(place => ({

            ...place,

            recommendationScore:
                calculateRecommendationScore(place)

        }))

        .sort(

            (a, b) =>
                b.recommendationScore -
                a.recommendationScore

        );

}
/* ============================================================
 * INTELLIGENT PLACES SEARCH ENGINE
 * ============================================================
 */

/**
 * Search one route zone intelligently.
 * Only ONE Google Places request is made.
 */
async function intelligentZoneSearch(zone) {

    const cacheKey =
        `${zone.center.lat},${zone.center.lng}`;

    const cached = cacheGet(
        placesCache,
        cacheKey
    );

    if (cached)
        return cached;

    try {

        const query =
            `${SEARCH_KEYWORDS[0]} near ${zone.center.lat},${zone.center.lng}`;

        console.log(
            `🌍 Intelligent Search Zone ${zone.id}`
        );

        const response = await axios.get(
            PLACES_TEXT_SEARCH_URL,
            {

                params: {

                    query,

                    location:
                        `${zone.center.lat},${zone.center.lng}`,

                    radius: zone.radius,

                    key: GOOGLE_MAPS_API_KEY

                },

                timeout: 8000

            }
        );

        if (
            response.data.status !== "OK" &&
            response.data.status !== "ZERO_RESULTS"
        ) {

            console.log(
                "Places Search Error:",
                response.data.status
            );

            return [];

        }

        const places = (response.data.results || [])

            .map(place => ({

                name: place.name,

                placeId: place.place_id,

                rating: place.rating || 0,

                userRatingsTotal:
                    place.user_ratings_total || 0,

                location: {

                    lat: place.geometry.location.lat,

                    lng: place.geometry.location.lng

                },

                formattedAddress:
                    place.formatted_address || "",

                vicinity:
                    place.vicinity || "",

                types:
                    place.types || []

            }))

            .filter(place =>

                place.rating >= CONFIG.MIN_RATING &&

                place.userRatingsTotal >=
                CONFIG.MIN_REVIEWS

            );

        cacheSet(
            placesCache,
            cacheKey,
            places
        );

        return places;

    }

    catch (err) {

        console.error(err.message);

        return [];

    }

}

/* ============================================================
 * SEARCH MULTIPLE ROUTE ZONES
 * ============================================================
 */

async function searchRouteZones(zones) {

    const batches = [];

    for (

        let i = 0;

        i < zones.length;

        i += CONFIG.MAX_PARALLEL_SEARCHES

    ) {

        batches.push(

            zones.slice(
                i,
                i + CONFIG.MAX_PARALLEL_SEARCHES
            )

        );

    }

    let allPlaces = [];

    for (const batch of batches) {

        const results =
            await Promise.all(

                batch.map(
                    intelligentZoneSearch
                )

            );

        allPlaces.push(
            ...results.flat()
        );

    }

    return allPlaces;

}

/* ============================================================
 * REMOVE LOW QUALITY PLACES
 * ============================================================
 */

function filterLowQualityPlaces(places) {

    const blacklist = [

        "park",

        "art_gallery",

        "school",

        "hospital",

        "bank",

        "store",

        "shopping_mall",

        "gas_station",

        "pharmacy",

        "post_office",

        "gym"

    ];

    return places.filter(place => {

        if (
            place.rating <
            CONFIG.MIN_RATING
        )
            return false;

        if (
            place.userRatingsTotal <
            CONFIG.MIN_REVIEWS
        )
            return false;

        const types =
            place.types || [];

        const rejected =
            blacklist.some(type =>
                types.includes(type)
            );

        return !rejected;

    });

}

/* ============================================================
 * ENRICH RESULTS
 * ============================================================
 */

function enrichRoutePlaces(
    places,
    routePoints
) {

    return places.map(place => {

        const distance =
            distanceFromRoute(
                place,
                routePoints
            );

        return {

            ...place,

            distanceFromRoute:
                Number(distance.toFixed(2)),

            detourMinutes:
                estimateDetour(distance),

            recommendationScore:
                calculateRecommendationScore(
                    place,
                    distance
                )

        };

    });

}

/* ============================================================
 * FINAL ROUTE RECOMMENDATION
 * ============================================================
 */

async function getRouteRecommendations(
    polyline
) {

    console.log(
        "🚀 Starting Intelligent Recommendation Engine..."
    );

    const routePoints =
        decodePolyline(polyline);

    const samples =
        sampleRoute(routePoints);

    console.log(
        `📍 Route Samples: ${samples.length}`
    );

    const zones =
        createSearchZones(samples);

    console.log(
        `🌍 Search Zones: ${zones.length}`
    );

    let places =
        await searchRouteZones(zones);

    console.log(
        `🏛 Places Found: ${places.length}`
    );

    places =
        filterLowQualityPlaces(
            places
        );

    places =
        enrichRoutePlaces(
            places,
            routePoints
        );

    places =
        removeDuplicatePlaces(
            places
        );

    places =
        rankPlaces(places);

    return places.slice(
        0,
        zones.length *
        CONFIG.MAX_RESULTS_PER_ZONE
    );

}

/* ============================================================
 * GOOGLE MAPS COMPATIBILITY HELPERS
 * ============================================================
 */

function normalizeDirectionsMode(mode = "driving") {

    const allowedModes =
        new Set([
            "driving",
            "walking",
            "bicycling",
            "transit"
        ]);

    const normalized =
        String(mode || "driving")
            .toLowerCase();

    return allowedModes.has(normalized)
        ? normalized
        : "driving";

}

function formatDuration(seconds = 0) {

    const totalMinutes =
        Math.max(
            0,
            Math.round(seconds / 60)
        );

    const hours =
        Math.floor(totalMinutes / 60);

    const minutes =
        totalMinutes % 60;

    if (hours && minutes)
        return `${hours} hr ${minutes} min`;

    if (hours)
        return `${hours} hr`;

    return `${minutes} min`;

}

function missingApiKeyResult() {

    return {

        error: "Google Maps API key is not configured"

    };

}

async function resolveLocation(location) {

    if (
        location &&
        typeof location === "object" &&
        typeof location.lat === "number" &&
        typeof location.lng === "number"
    ) {

        return location;

    }

    const cacheKey =
        String(location || "")
            .trim()
            .toLowerCase();

    if (!cacheKey)
        throw new Error("Location is required");

    if (geocodeCache.has(cacheKey))
        return geocodeCache.get(cacheKey);

    if (!GOOGLE_MAPS_API_KEY)
        throw new Error("Google Maps API key is not configured");

    const response =
        await axios.get(
            GEOCODE_URL,
            {

                params: {

                    address: location,
                    key: GOOGLE_MAPS_API_KEY

                },

                timeout: 10000

            }
        );

    if (
        response.data.status !== "OK" ||
        !response.data.results.length
    ) {

        throw new Error(
            response.data.status ||
            "Location could not be resolved"
        );

    }

    const resolved =
        response.data.results[0].geometry.location;

    geocodeCache.set(
        cacheKey,
        resolved
    );

    return resolved;

}

async function getDistanceFromGoogleMaps(
    origin,
    destination,
    mode = "driving"
) {

    if (!GOOGLE_MAPS_API_KEY)
        return missingApiKeyResult();

    try {

        const response =
            await axios.get(
                DISTANCE_MATRIX_URL,
                {

                    params: {

                        origins: origin,
                        destinations: destination,
                        mode: normalizeDirectionsMode(mode),
                        units: "metric",
                        key: GOOGLE_MAPS_API_KEY

                    },

                    timeout: 10000

                }
            );

        if (response.data.status !== "OK")
            return {

                error: response.data.status,
                distance: null,
                duration: null

            };

        const element =
            response.data.rows?.[0]?.elements?.[0];

        if (!element || element.status !== "OK")
            return {

                error: element?.status || "NO_ROUTE",
                distance: null,
                duration: null

            };

        return {

            distance:
                Math.round(element.distance.value / 1000),

            duration:
                element.duration.text,

            distanceText:
                element.distance.text,

            durationValue:
                element.duration.value,

            origin:
                response.data.origin_addresses?.[0] || origin,

            destination:
                response.data.destination_addresses?.[0] || destination,

            error: null

        };

    }

    catch (err) {

        return {

            error: err.message,
            distance: null,
            duration: null

        };

    }

}

async function getDistancesToMultipleLocations(
    origin,
    destinations,
    mode = "driving"
) {

    const destinationList =
        Array.isArray(destinations)
            ? destinations
            : [destinations];

    if (!destinationList.length)
        return [];

    if (!GOOGLE_MAPS_API_KEY)
        return destinationList.map(destination => ({

            destination,
            ...missingApiKeyResult()

        }));

    try {

        const response =
            await axios.get(
                DISTANCE_MATRIX_URL,
                {

                    params: {

                        origins: origin,
                        destinations: destinationList.join("|"),
                        mode: normalizeDirectionsMode(mode),
                        units: "metric",
                        key: GOOGLE_MAPS_API_KEY

                    },

                    timeout: 15000

                }
            );

        if (response.data.status !== "OK")
            return destinationList.map(destination => ({

                destination,
                error: response.data.status

            }));

        const elements =
            response.data.rows?.[0]?.elements || [];

        return destinationList.map((destination, index) => {

            const element =
                elements[index];

            if (!element || element.status !== "OK")
                return {

                    destination,
                    error: element?.status || "NO_ROUTE"

                };

            return {

                destination,
                resolvedDestination:
                    response.data.destination_addresses?.[index] ||
                    destination,
                distance:
                    Math.round(element.distance.value / 1000),
                duration:
                    element.duration.text,
                distanceText:
                    element.distance.text,
                durationValue:
                    element.duration.value,
                error: null

            };

        });

    }

    catch (err) {

        return destinationList.map(destination => ({

            destination,
            error: err.message

        }));

    }

}

async function validateGoogleMapsApiKey() {

    if (!GOOGLE_MAPS_API_KEY)
        return {

            ok: false,
            status: "missing_key",
            error: "Google Maps API key is not configured"

        };

    const result =
        await getDistanceFromGoogleMaps(
            "Delhi, India",
            "Agra, India"
        );

    return {

        ok:
            !result.error &&
            typeof result.distance === "number",
        status:
            result.error ? "error" : "ok",
        error:
            result.error || null,
        distance:
            result.distance,
        duration:
            result.duration

    };

}

/* ============================================================
 * BACKWARD COMPATIBILITY
 * ============================================================
 *
 * Existing code calling:
 *
 * findPlacesNearby(...)
 *
 * will automatically use
 * the new recommendation engine.
 * ============================================================
 */

async function findPlacesNearby(
    location,
    type = "tourist_attraction",
    radius = CONFIG.SEARCH_RADIUS
) {

    const zone = {

        id: 1,

        center:
            typeof location === "string"
                ? await resolveLocation(location)
                : location,

        radius

    };

    return intelligentZoneSearch(zone);

}

async function searchPlacesByText(
    query,
    location = null,
    radius = CONFIG.SEARCH_RADIUS
) {

    if (!GOOGLE_MAPS_API_KEY)
        return [];

    try {

        const params = {

            query,
            key: GOOGLE_MAPS_API_KEY

        };

        if (location) {

            const resolvedLocation =
                typeof location === "string"
                    ? await resolveLocation(location)
                    : location;

            params.location =
                `${resolvedLocation.lat},${resolvedLocation.lng}`;

            params.radius =
                radius;

        }

        const response =
            await axios.get(
                PLACES_TEXT_SEARCH_URL,
                {

                    params,
                    timeout: 8000

                }
            );

        if (
            response.data.status !== "OK" &&
            response.data.status !== "ZERO_RESULTS"
        ) {

            return [];

        }

        return (response.data.results || [])
            .map(place => ({

                name: place.name,
                placeId: place.place_id,
                rating: place.rating || 0,
                userRatingsTotal:
                    place.user_ratings_total || 0,
                location:
                    place.geometry?.location || null,
                formattedAddress:
                    place.formatted_address || "",
                vicinity:
                    place.vicinity || "",
                types:
                    place.types || [],
                priceLevel:
                    place.price_level,
                openNow:
                    place.opening_hours?.open_now

            }));

    }

    catch (err) {

        console.error(
            "Text search error:",
            err.message
        );

        return [];

    }

}
/* ============================================================
 * INTELLIGENT ROUTE GENERATOR
 * ============================================================
 */

async function getDirectionsFromGoogleMaps(
    origin,
    destination,
    waypoints = [],
    mode = "driving",
    options = {}
) {

    try {

        const directionsMode =
            normalizeDirectionsMode(mode);

        console.log(
            `🗺️ Generating Intelligent Route`
        );

        const params = {

            origin,

            destination,

            key: GOOGLE_MAPS_API_KEY,

            mode: directionsMode,

            units: "metric",

            alternatives: true,

            optimizeWaypoints: true

        };

        if (options.avoid) {

            const avoidValue =
                Array.isArray(options.avoid)
                    ? options.avoid.join("|")
                    : options.avoid;

            if (avoidValue)
                params.avoid =
                    avoidValue;

        }

        if (waypoints.length) {

            params.waypoints =
                "optimize:true|" +
                waypoints.join("|");

        }

        const response =
            await axios.get(
                DIRECTIONS_URL,
                {

                    params,

                    timeout: 15000

                }
            );

        if (response.data.status !== "OK") {

            return {

                error:
                    response.data.status,

                routes: []

            };

        }

        const routes =
            response.data.routes.map(route => {

                const distance =
                    route.legs.reduce(

                        (sum, leg) =>
                            sum +
                            leg.distance.value,

                        0

                    );

                const duration =
                    route.legs.reduce(

                        (sum, leg) =>
                            sum +
                            leg.duration.value,

                        0

                    );

                return {

                    summary:
                        route.summary,

                    distance:
                        Math.round(distance / 1000),

                    duration:
                        formatDuration(duration),

                    durationValue:
                        duration,

                    polyline:
                        route.overview_polyline.points,

                    bounds:
                        route.bounds,

                    waypointOrder:
                        route.waypoint_order || [],

                    legs:
                        route.legs,

                    warnings:
                        route.warnings || []

                };

            });

        const primary =
            routes[0];

        console.log(
            `✅ Route Distance : ${primary.distance} km`
        );

        console.log(
            `✅ Route Duration : ${primary.duration}`
        );

        return {

            routes,

            distance:
                primary.distance,

            duration:
                primary.duration,

            polyline:
                primary.polyline,

            waypointOrder:
                primary.waypointOrder,

            bounds:
                primary.bounds,

            error: null

        };

    }

    catch (err) {

        console.error(
            err.message
        );

        return {

            routes: [],

            error:
                err.message

        };

    }

}

async function getRouteFromGoogleRoutesAPI(
    origin,
    destination,
    waypoints = [],
    mode = "driving",
    options = {}
) {

    if (!GOOGLE_MAPS_API_KEY)
        return missingApiKeyResult();

    try {

        const normalizedMode =
            normalizeDirectionsMode(mode);

        const travelMode =
            normalizedMode === "walking"
                ? "WALK"
                : normalizedMode === "bicycling"
                    ? "BICYCLE"
                    : normalizedMode === "transit"
                        ? "TRANSIT"
                        : "DRIVE";

        const avoidSet =
            new Set(
                Array.isArray(options.avoid)
                    ? options.avoid.map(item => String(item).toLowerCase())
                    : String(options.avoid || "")
                        .split("|")
                        .map(item => item.trim().toLowerCase())
                        .filter(Boolean)
            );

        const body = {

            origin: {
                address: origin
            },

            destination: {
                address: destination
            },

            travelMode,

            computeAlternativeRoutes: false,

            units: "METRIC",

            polylineQuality: "HIGH_QUALITY"

        };

        if (travelMode === "DRIVE") {

            body.routeModifiers = {
                avoidTolls: avoidSet.has("tolls"),
                avoidHighways: avoidSet.has("highways"),
                avoidFerries: avoidSet.has("ferries")
            };

        }

        if (waypoints.length) {

            body.intermediates =
                waypoints.map(waypoint => ({

                    address: waypoint

                }));

            body.optimizeWaypointOrder = true;

        }

        const response =
            await axios.post(
                ROUTES_API_URL,
                body,
                {

                    headers: {

                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                        "X-Goog-FieldMask": [
                            "routes.distanceMeters",
                            "routes.duration",
                            "routes.polyline.encodedPolyline",
                            "routes.optimizedIntermediateWaypointIndex"
                        ].join(",")

                    },

                    timeout: 15000

                }
            );

        const route =
            response.data.routes?.[0];

        if (!route)
            return {

                routes: [],
                error: "NO_ROUTE"

            };

        const durationSeconds =
            Number.parseInt(
                String(route.duration || "0s").replace("s", ""),
                10
            ) || 0;

        const polyline =
            route.polyline?.encodedPolyline || "";

        return {

            routes: [{

                summary: "Google Routes API route",
                distance: Math.round((route.distanceMeters || 0) / 1000),
                duration: formatDuration(durationSeconds),
                durationValue: durationSeconds,
                polyline,
                waypointOrder:
                    route.optimizedIntermediateWaypointIndex || []

            }],

            distance:
                Math.round((route.distanceMeters || 0) / 1000),

            duration:
                formatDuration(durationSeconds),

            durationValue:
                durationSeconds,

            polyline,

            waypointOrder:
                route.optimizedIntermediateWaypointIndex || [],

            error: null,

            source: "google_routes_api"

        };

    }

    catch (err) {

        return {

            routes: [],
            error:
                err.response?.data?.error?.message ||
                err.message

        };

    }

}
/* ============================================================
 * BUILD COMPLETE ROUTE
 * ============================================================
 */

async function buildIntelligentRoute(

    origin,

    destination,

    waypoints=[],

    mode="driving"

){

    console.log(
        "🚀 Building AI Route..."
    );

    const route=
        await getDirectionsFromGoogleMaps(

            origin,

            destination,

            waypoints,

            mode

        );

    if(route.error)
        return route;

    const recommendations=

        await getRouteRecommendations(

            route.polyline

        );

    return{

        ...route,

        recommendations

    };

}
async function withRetry(fn,retries=2){

    let lastError;

    for(

        let i=0;

        i<=retries;

        i++

    ){

        try{

            return await fn();

        }

        catch(err){

            lastError=err;

            console.log(
                `Retry ${i+1}`
            );

            await sleep(1000);

        }

    }

    throw lastError;

}
function whyRecommended(place){
    const reasons=[];

    if(place.rating>=4.7)

        reasons.push(
            "Highly Rated"
        );

    if(place.userRatingsTotal>=5000)

        reasons.push(
            "Very Popular"
        );

    if(place.distanceFromRoute<10)

        reasons.push(
            "Minimal Detour"
        );

    if(categoryWeight(place.types)>80)

        reasons.push(
            "Iconic Attraction"
        );

    return reasons.join(", ");

}
/* ============================================================
 * HYBRID GOOGLE PLACES SEARCH
 * ============================================================
 */

const SEARCH_STRATEGIES = [

    {
        query: "top tourist attractions",
        weight: 100
    },

    {
        query: "best places to visit",
        weight: 95
    },

    {
        query: "famous tourist places",
        weight: 90
    },

    {
        query: "waterfalls",
        weight: 88
    },

    {
        query: "hill station",
        weight: 87
    },

    {
        query: "view point",
        weight: 86
    },

    {
        query: "fort",
        weight: 84
    },

    {
        query: "wildlife sanctuary",
        weight: 82
    }

];

async function performTextSearch(query, location, radius){

    try{

        const response=await axios.get(

            PLACES_TEXT_SEARCH_URL,

            {

                params:{

                    query,

                    location:`${location.lat},${location.lng}`,

                    radius,

                    key:GOOGLE_MAPS_API_KEY

                },

                timeout:7000

            }

        );

        if(response.data.status!=="OK")

            return [];

        return response.data.results;

    }

    catch(err){

        return [];

    }

}
async function performNearbySearch(location,radius){

    try{

        const response=

        await axios.get(

            PLACES_NEARBY_URL,

            {

                params:{

                    location:

                    `${location.lat},${location.lng}`,

                    radius,

                    keyword:"tourist attractions",

                    key:GOOGLE_MAPS_API_KEY

                }

            }

        );

        if(response.data.status!=="OK")

            return [];

        return response.data.results;

    }

    catch(err){

        return [];

    }

}
async function hybridSearch(zone){

    let results=[];

    const nearby=

    await performNearbySearch(

        zone.center,

        zone.radius

    );

    results.push(...nearby);

    const topQueries=

    SEARCH_STRATEGIES.slice(0,3);

    const searches=

    await Promise.all(

        topQueries.map(q=>

            performTextSearch(

                q.query,

                zone.center,

                zone.radius

            )

        )

    );

    searches.forEach(list=>

        results.push(...list)

    );

    return results;

}
function normalizeGooglePlace(place){

    return{

        name:place.name,

        placeId:place.place_id,

        rating:place.rating||0,

        userRatingsTotal:

        place.user_ratings_total||0,

        types:place.types||[],

        formattedAddress:

        place.formatted_address||

        place.vicinity||

        "",

        location:{

            lat:place.geometry.location.lat,

            lng:place.geometry.location.lng

        }

    };

}
function adaptiveRadius(routeLength){

    if(routeLength<300)

        return 20000;

    if(routeLength<600)

        return 30000;

    if(routeLength<1000)

        return 35000;

    return 40000;

}
function popularityScore(place){

    const rating=

    place.rating||0;

    const reviews=

    place.userRatingsTotal||0;

    return(

        rating*20+

        Math.log10(

            reviews+1

        )*15

    );

}
function buildReason(place){

    const reasons=[];

    if(place.rating>=4.7)

        reasons.push("Highly Rated");

    if(place.userRatingsTotal>5000)

        reasons.push("Very Popular");

    if(place.types.includes("museum"))

        reasons.push("Cultural Attraction");

    if(place.types.includes("park"))

        reasons.push("Nature Spot");

    if(place.types.includes("tourist_attraction"))

        reasons.push("Must Visit");

    return reasons.join(", ");

}
function rankPlaces(places){

    return places

    .map(place=>{

        place.recommendationScore=

            calculateRecommendationScore(

                place,

                place.distanceFromRoute||0

            )+

            popularityScore(place);

        place.whyRecommended=

            buildReason(place);

        return place;

    })

    .sort(

        (a,b)=>

        b.recommendationScore-

        a.recommendationScore

    );

}
function clusterDuplicates(places){

    const clusters=[];

    places.forEach(place=>{

        let duplicate=false;

        for(const cluster of clusters){

            const d=

            haversineDistance(

                place.location.lat,

                place.location.lng,

                cluster.location.lat,

                cluster.location.lng

            );

            if(d<0.5){

                duplicate=true;

                if(

                    place.recommendationScore>

                    cluster.recommendationScore

                ){

                    Object.assign(

                        cluster,

                        place

                    );

                }

                break;

            }

        }

        if(!duplicate)

            clusters.push(place);

    });

    return clusters;

}
/* ============================================================
 * AI ITINERARY GENERATOR
 * ============================================================
 */

const VISIT_DURATION = {

    waterfall:120,

    beach:180,

    hill_station:240,

    scenic_viewpoint:45,

    museum:90,

    fort:120,

    palace:120,

    cave:120,

    temple:60,

    wildlife:240,

    amusement_park:360,

    national_park:300,

    lake:90,

    dam:60,

    default:90

};

function estimateVisitDuration(place){

    const types=place.types||[];

    for(const type of types){

        if(VISIT_DURATION[type])

            return VISIT_DURATION[type];

    }

    return VISIT_DURATION.default;

}
function bestVisitTime(place){

    const types=place.types||[];

    if(types.includes("waterfall"))

        return "Early Morning";

    if(types.includes("hill_station"))

        return "Morning";

    if(types.includes("beach"))

        return "Evening";

    if(types.includes("temple"))

        return "Morning";

    if(types.includes("wildlife"))

        return "Sunrise";

    return "Anytime";

}
function attractionPriority(place){

    let priority=0;

    priority+=place.recommendationScore||0;

    priority+=place.rating*20;

    priority+=Math.log10(

        place.userRatingsTotal+1

    )*15;

    return priority;

}
function generateTravelDays(

    attractions,

    totalDays

){

    attractions.sort(

        (a,b)=>

        attractionPriority(b)-

        attractionPriority(a)

    );

    const itinerary=[];

    for(

        let day=1;

        day<=totalDays;

        day++

    ){

        itinerary.push({

            day,

            attractions:[],

            totalMinutes:0

        });

    }

    let currentDay=0;

    attractions.forEach(place=>{

        const duration=

        estimateVisitDuration(place);

        if(

            itinerary[currentDay]

            .totalMinutes+

            duration>

            480

        ){

            currentDay++;

            if(

                currentDay>=

                itinerary.length

            )

                currentDay=

                itinerary.length-1;

        }

        itinerary[currentDay]

        .attractions

        .push({

            ...place,

            visitDuration:

            duration,

            bestVisitTime:

            bestVisitTime(place)

        });

        itinerary[currentDay]

        .totalMinutes+=

        duration;

    });

    return itinerary;

}
function filterWorthStopping(

    attractions

){

    return attractions.filter(place=>{

        if(

            place.rating<4.3

        )

            return false;

        if(

            place.userRatingsTotal<300

        )

            return false;

        if(

            place.distanceFromRoute>

            35

        )

            return false;

        return true;

    });

}
function createSchedule(

    itinerary

){

    itinerary.forEach(day=>{

        let currentTime=8*60;

        day.attractions.forEach(place=>{

            place.startTime=

            formatClock(

                currentTime

            );

            currentTime+=

            place.visitDuration;

            place.endTime=

            formatClock(

                currentTime

            );

        });

    });

    return itinerary;

}
function formatClock(minutes){

    const h=Math.floor(minutes/60);

    const m=minutes%60;

    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;

}
function buildItinerary(

    attractions,

    totalDays

){

    attractions=

    filterWorthStopping(

        attractions

    );

    let itinerary=

    generateTravelDays(

        attractions,

        totalDays

    );

    itinerary=

    createSchedule(

        itinerary

    );

    return itinerary;

}

/* ============================================================
 * SMART OVERNIGHT STOP PLANNER
 * ============================================================
 */

const MAX_DRIVING_HOURS = 8;
const AVERAGE_SPEED = 60;

function estimateDrivingHours(distanceKm){

    return distanceKm / AVERAGE_SPEED;

}

function calculateNightStops(routeDistance){

    const totalHours = estimateDrivingHours(routeDistance);

    return Math.max(
        0,
        Math.ceil(totalHours / MAX_DRIVING_HOURS) - 1
    );

}

function splitRouteIntoDays(routeDistance,totalDays){

    const kmPerDay = Math.ceil(routeDistance / totalDays);

    const stops=[];

    let covered=0;

    for(let day=1;day<=totalDays;day++){

        covered+=kmPerDay;

        stops.push({

            day,

            expectedDistance:covered

        });

    }

    return stops;

}
function chooseNightStops(itinerary){

    const stops=[];

    itinerary.forEach(day=>{

        if(day.attractions.length===0)
            return;

        const lastPlace=

            day.attractions[
                day.attractions.length-1
            ];

        stops.push({

            day:day.day,

            location:lastPlace,

            checkIn:"18:00",

            checkOut:"08:00"

        });

    });

    return stops;

}
async function searchHotels(location){

    return performNearbySearch(

        location,

        5000,

        "hotel"

    );

}
async function searchRestaurants(location){

    return performNearbySearch(

        location,

        3000,

        "restaurant"

    );

}
async function searchFuelStations(location){

    return performNearbySearch(

        location,

        5000,

        "gas_station"

    );

}
async function searchEVStations(location){

    return performNearbySearch(

        location,

        5000,

        "electric vehicle charging station"

    );

}
async function enrichNightStops(stops){

    for(const stop of stops){

        stop.hotels=

        await searchHotels(

            stop.location.location

        );

        stop.restaurants=

        await searchRestaurants(

            stop.location.location

        );

    }

    return stops;

}
async function enrichFuelStops(itinerary){

    for(const day of itinerary){

        for(const attraction of day.attractions){

            attraction.fuelStations=

            await searchFuelStations(

                attraction.location

            );

            attraction.evStations=

            await searchEVStations(

                attraction.location

            );

        }

    }

    return itinerary;

}
function buildReturnTrip(

    outwardAttractions

){

    const reverse=

    [...outwardAttractions]

    .reverse();

    reverse.forEach(place=>{

        place.returnJourney=true;

    });

    return reverse;

}
function buildCompleteJourney(

    outward,

    returnTrip

)
{

    return{

        onward:outward,

        return:returnTrip

    };

}
async function generateTravelPlan(

    route,

    days

){

    const recommendations=

    await getRouteRecommendations(

        route.polyline

    );

    const itinerary=

    buildItinerary(

        recommendations,

        days

    );

    let nightStops=

    chooseNightStops(

        itinerary

    );

    nightStops=

    await enrichNightStops(

        nightStops

    );

    await enrichFuelStops(

        itinerary

    );

    return{

        itinerary,

        nightStops

    };

}
/* ============================================================
 * WEATHER & SEASON ENGINE
 * ============================================================
 */

const SEASONS = {

    WINTER: ["November","December","January","February"],

    SUMMER: ["March","April","May"],

    MONSOON: ["June","July","August","September"],

    POST_MONSOON:["October"]

};

function getCurrentSeason(){

    const month=new Date().toLocaleString(

        "en-US",

        {month:"long"}

    );

    for(const season in SEASONS){

        if(SEASONS[season].includes(month))

            return season;

    }

    return "WINTER";

}

function seasonScore(place){

    if(!place.bestSeason)

        return 20;

    if(place.bestSeason===getCurrentSeason())

        return 100;

    return 40;

}

/* ============================================================
 * USER PREFERENCE ENGINE
 * ============================================================
 */

function preferenceScore(place,user){

    let score=0;

    if(!user)

        return score;

    const suitable=

    place.suitableFor||[];

    const categories=

    place.types||[];

    if(

        suitable.includes(user.travelType)

    )

        score+=30;

    if(

        user.interests

    ){

        user.interests.forEach(i=>{

            if(categories.includes(i))

                score+=20;

        });

    }

    return score;

}
/* ============================================================
 * FUEL COST
 * ============================================================
 */

function estimateFuelCost(

    distanceKm,

    mileage,

    fuelPrice

){

    const litres=

    distanceKm/mileage;

    return Math.round(

        litres*fuelPrice

    );

}
/* ============================================================
 * TOLL ESTIMATION
 * ============================================================
 */

function estimateToll(distanceKm){

    if(distanceKm<100)

        return 0;

    return Math.round(

        distanceKm*1.8

    );

}
/* ============================================================
 * AI RECOMMENDATION
 * ============================================================
 */

function explain(place){

    const reasons=[];

    if(place.rating>=4.7)

        reasons.push(

            "Highly Rated"

        );

    if(place.userRatingsTotal>5000)

        reasons.push(

            "Popular Among Tourists"

        );

    if(

        place.distanceFromRoute<10

    )

        reasons.push(

            "Minimal Detour"

        );

    if(

        seasonScore(place)>80

    )

        reasons.push(

            "Best Season"

        );

    return reasons.join(", ");

}
function finalScore(

    place,

    user

){

    return(

        calculateRecommendationScore(

            place,

            place.distanceFromRoute

        )

        +

        popularityScore(place)

        +

        seasonScore(place)

        +

        preferenceScore(

            place,

            user

        )

    );

}
/* ============================================================
 * ROUTE REOPTIMIZATION
 * ============================================================
 */

function optimizeSelectedPlaces(

    selected

){

    return selected.sort(

        (a,b)=>

        a.distanceFromRoute-

        b.distanceFromRoute

    );

}
/* ============================================================
 * COMPLETE AI PLANNER
 * ============================================================
 */

async function planTrip({

    origin,

    destination,

    days,

    user,

    mileage,

    fuelPrice

}){

    const route=

    await buildIntelligentRoute(

        origin,

        destination

    );

    let attractions=

    route.recommendations;

    attractions.forEach(place=>{

        place.aiScore=

        finalScore(

            place,

            user

        );

        place.aiReason=

        explain(place);

    });

    attractions.sort(

        (a,b)=>

        b.aiScore-a.aiScore

    );

    const itinerary=

    buildItinerary(

        attractions,

        days

    );

    const fuel=

    estimateFuelCost(

        route.distance,

        mileage,

        fuelPrice

    );

    const toll=

    estimateToll(

        route.distance

    );

    return{

        route,

        itinerary,

        fuelCost:fuel,

        tollCost:toll,

        totalTripCost:

        fuel+toll

    };

}
const user={

    travelType:"family",

    interests:[

        "waterfall",

        "wildlife",

        "hill_station"

    ]

};
function hasGoogleMapsAPI() {

    const hasKey = !!GOOGLE_MAPS_API_KEY;

    console.log(
        `🔑 Google Maps API Key Check: ${hasKey ? "✅ Present" : "❌ Missing"}`
    );

    return hasKey;
}

module.exports = {
    getDistanceFromGoogleMaps,
    getDistancesToMultipleLocations,
    getDirectionsFromGoogleMaps,
    getRouteFromGoogleRoutesAPI,
    validateGoogleMapsApiKey,
    findPlacesNearby,
    searchPlacesByText,
    buildIntelligentRoute,
    getRouteRecommendations,
    planTrip,
    hasGoogleMapsAPI
};
