// Sample test cases and expected results for the AI Travel Planner API

// Test Case 1: Standard Budget Trip (Within Budget)
const testCase1 = {
  name: "Standard Barcelona Budget Trip",
  input: {
    budget: 1500,
    travelDates: "2024-06-15 to 2024-06-22",
    startLocation: "New York",
    destination: "Barcelona",
    activities: "cultural, food, nature",
    accommodation: "hostel",
    transport: "flight"
  },
  expectedResults: {
    success: true,
    withinBudget: true,
    minCost: 1000,
    maxCost: 1400,
    dayCount: 8,
    hasAlternatives: false,
    hasTips: true
  }
};

// Test Case 2: Limited Budget Trip (May Exceed)
const testCase2 = {
  name: "Low Budget City Trip",
  input: {
    budget: 500,
    travelDates: "2024-07-01 to 2024-07-05",
    startLocation: "Boston",
    destination: "New York",
    activities: "cultural",
    accommodation: "hostel",
    transport: "bus"
  },
  expectedResults: {
    success: true,
    minCost: 300,
    maxCost: 700,
    dayCount: 5,
    hasWarnings: true
  }
};

// Test Case 3: Luxury Budget with Multiple Activities
const testCase3 = {
  name: "Generous Budget Adventure Trip",
  input: {
    budget: 3000,
    travelDates: "2024-08-01 to 2024-08-15",
    startLocation: "Los Angeles",
    destination: "Denver",
    activities: "adventure, nature, food",
    accommodation: "budgetHotel",
    transport: "flight"
  },
  expectedResults: {
    success: true,
    withinBudget: true,
    minCost: 1500,
    maxCost: 2800,
    dayCount: 15,
    minActivities: 5
  }
};

// Test Case 4: International Trip
const testCase4 = {
  name: "International Summer Travel",
  input: {
    budget: 2500,
    travelDates: "2024-06-01 to 2024-06-21",
    startLocation: "Toronto",
    destination: "Paris",
    activities: "cultural, food",
    accommodation: "airbnb",
    transport: "flight"
  },
  expectedResults: {
    success: true,
    dayCount: 21,
    shouldHaveAlternatives: true
  }
};

// Test Case 5: Short Weekend Trip
const testCase5 = {
  name: "Weekend Getaway",
  input: {
    budget: 400,
    travelDates: "2024-03-15 to 2024-03-17",
    startLocation: "Philadelphia",
    destination: "Washington DC",
    activities: "cultural",
    accommodation: "hostel",
    transport: "bus"
  },
  expectedResults: {
    success: true,
    dayCount: 3,
    withinBudget: true
  }
};

// Test Case 6: Invalid Input - Missing Required Field
const testCase6 = {
  name: "Missing Budget (Should Fail)",
  input: {
    budget: "",
    travelDates: "2024-07-01 to 2024-07-08",
    startLocation: "New York",
    destination: "Boston",
    activities: "cultural",
    accommodation: "hostel",
    transport: "bus"
  },
  expectedResults: {
    success: false,
    hasError: true
  }
};

// Test Case 7: Invalid Date Format
const testCase7 = {
  name: "Invalid Date Format (Should Handle)",
  input: {
    budget: 1000,
    travelDates: "invalid-date",
    startLocation: "New York",
    destination: "Boston",
    activities: "cultural",
    accommodation: "hostel",
    transport: "bus"
  },
  expectedResults: {
    success: false,
    hasError: true
  }
};

// Test Case 8: All Activity Types
const testCase8 = {
  name: "All Activity Types Selected",
  input: {
    budget: 2000,
    travelDates: "2024-05-10 to 2024-05-17",
    startLocation: "San Francisco",
    destination: "Los Angeles",
    activities: "adventure, cultural, food, nature",
    accommodation: "guesthouse",
    transport: "train"
  },
  expectedResults: {
    success: true,
    withinBudget: true,
    minActivities: 10,
    hasAllActivityTypes: true
  }
};

// Test Case 9: No Activities Specified (Should Get Defaults)
const testCase9 = {
  name: "No Activities Specified",
  input: {
    budget: 1500,
    travelDates: "2024-04-01 to 2024-04-08",
    startLocation: "Miami",
    destination: "Key West",
    activities: "",
    accommodation: "hostel",
    transport: "bus"
  },
  expectedResults: {
    success: true,
    withinBudget: true,
    hasDefaultActivities: true,
    minActivities: 3
  }
};

// Test Case 10: Premium Preferences (Expensive)
const testCase10 = {
  name: "Premium Accommodation & Activities",
  input: {
    budget: 1000,
    travelDates: "2024-09-01 to 2024-09-07",
    startLocation: "Chicago",
    destination: "Las Vegas",
    activities: "food, adventure",
    accommodation: "airbnb",
    transport: "flight"
  },
  expectedResults: {
    success: true,
    shouldShowWarnings: true,
    hasAlternatives: true
  }
};

// Verification Function
function verifyTestCase(testCase, result) {
  console.log(`\n\n========== Testing: ${testCase.name} ==========`);
  console.log('Status:', result.success ? '✓ PASS' : '✗ FAIL');

  if (testCase.expectedResults.withinBudget !== undefined) {
    const withinBudget = result.summary.withinBudget;
    console.log(`Within Budget: ${withinBudget ? '✓' : '✗'} (expected: ${testCase.expectedResults.withinBudget})`);
  }

  if (testCase.expectedResults.dayCount !== undefined) {
    const dayCount = result.summary.totalDays;
    console.log(`Day Count: ${dayCount} (expected: ${testCase.expectedResults.dayCount})`);
  }

  if (testCase.expectedResults.minCost && testCase.expectedResults.maxCost) {
    const cost = result.estimatedCosts.total;
    const inRange = cost >= testCase.expectedResults.minCost && cost <= testCase.expectedResults.maxCost;
    console.log(`Cost: $${cost} (expected range: $${testCase.expectedResults.minCost}-$${testCase.expectedResults.maxCost}) ${inRange ? '✓' : '✗'}`);
  }

  if (testCase.expectedResults.hasWarnings !== undefined && result.warnings) {
    console.log(`Warnings: ${result.warnings.length > 0 ? '✓' : '✗'} (${result.warnings.length})`);
  }

  if (testCase.expectedResults.hasError !== undefined) {
    console.log(`Error Handling: ${!result.success ? '✓ Error detected' : '✗ No error'}`);
  }

  console.log('Full Response:', JSON.stringify(result, null, 2));
}

module.exports = {
  testCase1,
  testCase2,
  testCase3,
  testCase4,
  testCase5,
  testCase6,
  testCase7,
  testCase8,
  testCase9,
  testCase10,
  verifyTestCase,
  allTests: [
    testCase1,
    testCase2,
    testCase3,
    testCase4,
    testCase5,
    testCase6,
    testCase7,
    testCase8,
    testCase9,
    testCase10
  ]
};
