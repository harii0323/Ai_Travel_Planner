// Example usage of the AI Travel Planner API

// Example 1: Budget Travel to Barcelona
const barcelonaTrip = {
  budget: 1500,
  travelDates: "2024-07-01 to 2024-07-08",
  startLocation: "New York",
  destination: "Barcelona",
  activities: "cultural, food",
  accommodation: "hostel",
  transport: "flight"
};

// Example 2: Adventure Trip to Colorado
const coloradoTrip = {
  budget: 1000,
  travelDates: "2024-05-15 to 2024-05-20",
  startLocation: "Los Angeles",
  destination: "Denver",
  activities: "adventure, nature",
  accommodation: "budgetHotel",
  transport: "bus"
};

// Example 3: Cultural Tour of Southeast Asia
const asiaTour = {
  budget: 2000,
  travelDates: "2024-12-01 to 2024-12-21",
  startLocation: "Singapore",
  destination: "Bangkok",
  activities: "cultural, food, nature",
  accommodation: "homestay",
  transport: "train"
};

// Example 4: Food Adventure in Mexico
const mexicoFood = {
  budget: 800,
  travelDates: "2024-10-01 to 2024-10-07",
  startLocation: "San Diego",
  destination: "Mexico City",
  activities: "food, cultural",
  accommodation: "guesthouse",
  transport: "bus"
};

// Example 5: Europe Multi-City (using single destination as example)
const europeTrip = {
  budget: 2500,
  travelDates: "2024-06-01 to 2024-06-30",
  startLocation: "London",
  destination: "Paris",
  activities: "cultural, food, adventure",
  accommodation: "airbnb",
  transport: "train"
};

// How to use with fetch API
async function generateItinerary(tripData) {
  try {
    const response = await fetch('http://localhost:5000/api/itinerary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tripData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const itinerary = await response.json();
    console.log('Generated Itinerary:', itinerary);
    return itinerary;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    throw error;
  }
}

// How to use with axios (as in React app)
const axios = require('axios');

async function generateItineraryWithAxios(tripData) {
  try {
    const response = await axios.post('http://localhost:5000/api/itinerary', tripData);
    console.log('Generated Itinerary:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    throw error;
  }
}

// Usage examples
async function runExamples() {
  // Example 1: Barcelona trip
  console.log('\n========== Barcelona Trip ==========');
  const barcelona = await generateItinerary(barcelonaTrip);
  console.log('Total Cost:', barcelona.estimatedCosts.total);
  console.log('Within Budget:', barcelona.summary.withinBudget);

  // Example 2: Colorado trip
  console.log('\n========== Colorado Trip ==========');
  const colorado = await generateItinerary(coloradoTrip);
  console.log('Day Plans:', colorado.dayPlans.length, 'days');
  console.log('Money Tips:', colorado.moneyTips.length, 'tips');

  // Example 3: Asia tour
  console.log('\n========== Asia Tour ==========');
  const asia = await generateItinerary(asiaTour);
  console.log('Accommodation Cost:', asia.estimatedCosts.accommodation);
  console.log('Food Cost:', asia.estimatedCosts.food);

  // Example 4: Mexico food
  console.log('\n========== Mexico Food ==========');
  const mexico = await generateItinerary(mexicoFood);
  console.log('Activities:', mexico.costBreakdown.activities.length);
  console.log('Suggestions:', mexico.accommodationSuggestions.length);
}

// For testing in Node.js
// Uncomment to run:
// runExamples().catch(console.error);

module.exports = {
  barcelonaTrip,
  coloradoTrip,
  asiaTour,
  mexicoFood,
  europeTrip,
  generateItinerary,
  generateItineraryWithAxios
};
