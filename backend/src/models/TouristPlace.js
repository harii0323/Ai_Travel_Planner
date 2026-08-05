const mongoose = require('mongoose');

const touristPlaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  region: {
    type: String,
    required: true,
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
  },
  categories: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  bestTimeToVisit: {
    months: [String],
    season: String,
    reason: String
  },
  suitableFor: [{
    type: String,
    enum: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly', 'large-group']
  }],
  recommendedTransport: [{
    type: String,
    enum: ['flight', 'train', 'bus', 'car', 'bike', 'ship']
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

touristPlaceSchema.index({ city: 1, state: 1 });
touristPlaceSchema.index({ region: 1 });
touristPlaceSchema.index({ categories: 1 });
touristPlaceSchema.index({ suitableFor: 1 });
touristPlaceSchema.index({ recommendedTransport: 1 });

module.exports = mongoose.model('TouristPlace', touristPlaceSchema);
