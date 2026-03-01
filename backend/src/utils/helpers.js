// Utility functions for the Travel Planner service

/**
 * Calculate distance between two locations (approximate)
 * Uses simplified distance calculation
 * In production, use actual mapping APIs
 */
function calculateDistance(location1, location2) {
  // Approximate distances between major tourist destinations (in km)
  const distanceDb = {
    'newyork-boston': 350,
    'boston-newyork': 350,
    'new york-boston': 350,
    'boston-new york': 350,
    'newyork-philadelphia': 150,
    'philadelphia-newyork': 150,
    'losangeles-sandiego': 150,
    'sandiego-losangeles': 150,
    'sanfrancisco-losangeles': 600,
    'losangeles-sanfrancisco': 600,
    'chicago-newyork': 1200,
    'newyork-chicago': 1200,
    'london-paris': 340,
    'paris-london': 340,
    'paris-barcelona': 700,
    'barcelona-paris': 700,
    'berlin-prague': 350,
    'prague-berlin': 350,
    'tokyo-kyoto': 500,
    'kyoto-tokyo': 500,
    'bangkok-phuket': 850,
    'phuket-bangkok': 850,
    'sydney-melbourne': 900,
    'melbourne-sydney': 900,
  };

  const key1 = `${location1.toLowerCase()}-${location2.toLowerCase()}`;
  const key2 = location1.toLowerCase() + location2.toLowerCase();

  if (distanceDb[key1]) return distanceDb[key1];

  // Default to medium distance if not found
  return 500;
}

/**
 * Validate date format
 */
function isValidDateFormat(dateStr) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Get season type (affects pricing)
 */
function getSeasonType(date) {
  const month = new Date(date).getMonth() + 1;

  if (month >= 6 && month <= 8) return 'peak';
  if (month >= 12 || month <= 2) return 'winter';
  return 'moderate';
}

/**
 * Adjust costs based on season
 */
function adjustForSeason(baseCost, seasonType) {
  const seasonMultiplier = {
    'peak': 1.3,
    'winter': 1.1,
    'moderate': 1.0
  };

  return baseCost * (seasonMultiplier[seasonType] || 1.0);
}

/**
 * Get destination difficulty level
 */
function getDestinationDifficulty(destination) {
  const easy = [
    'paris', 'london', 'barcelona', 'rome', 'amsterdam',
    'tokyo', 'bangkok', 'singapore', 'sydney', 'melbourne'
  ];
  const moderate = [
    'istanbul', 'delhi', 'cairo', 'marrakech', 'hanoi'
  ];

  const dest = destination.toLowerCase();
  if (easy.some(d => dest.includes(d))) return 'easy';
  if (moderate.some(d => dest.includes(d))) return 'moderate';
  return 'challenging';
}

/**
 * Validate user input
 */
function validateInput(data) {
  const errors = [];

  if (!data.budget || parseFloat(data.budget) <= 0) {
    errors.push('Invalid budget');
  }

  if (!data.destination || !data.destination.trim()) {
    errors.push('Destination is required');
  }

  if (!data.startLocation || !data.startLocation.trim()) {
    errors.push('Start location is required');
  }

  if (!data.travelDates) {
    errors.push('Travel dates are required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return `$${(Math.round(amount * 100) / 100).toFixed(2)}`;
}

module.exports = {
  calculateDistance,
  isValidDateFormat,
  getSeasonType,
  adjustForSeason,
  getDestinationDifficulty,
  validateInput,
  formatCurrency
};
