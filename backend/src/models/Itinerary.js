// Itinerary schema for MongoDB - stores saved travel plans

const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  
  // Trip Details
  destination: {
    type: String,
    required: true
  },
  startLocation: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    required: true
  },
  
  // Budget Info
  budget: {
    type: Number,
    required: true
  },
  estimatedCost: {
    type: Number,
    required: true
  },
  withoutBudget: {
    type: Boolean,
    default: false
  },
  
  // Preferences
  activities: [String],
  accommodation: String,
  transport: String,
  travelCompanionType: {
    type: String,
    enum: ['solo', 'couple', 'friends', 'family', 'large-group'],
    default: 'solo'
  },
  numberOfTravelers: {
    type: Number,
    default: 1
  },
  
  // Generated Content
  estimatedCosts: {
    mainTransport: Number,
    accommodation: Number,
    food: Number,
    activities: Number,
    miscellaneous: Number,
    total: Number
  },
  dayPlans: [{
    day: Number,
    plan: String,
    activities: [{
      name: String,
      cost: Number,
      category: String
    }]
  }],
  moneyTips: [String],
  
  // Recommendations based on companion type
  recommendations: {
    bestTime: {
      season: String,
      reason: String,
      priceLevel: String
    },
    bestTimeDescription: String,
    companionSuggestions: [String],
    groupActivities: [String],
    budgetTips: [String],
    safetyTips: [String],
    soloActivities: [String],
    coupleActivities: [String]
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'saved', 'completed', 'archived'],
    default: 'saved'
  },
  
  tags: [String],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  plannedTravelDate: Date // When they plan to actually take the trip
});

// Index for faster queries
itinerarySchema.index({ userId: 1, createdAt: -1 });
itinerarySchema.index({ destination: 1 });

module.exports = mongoose.model('Itinerary', itinerarySchema);
