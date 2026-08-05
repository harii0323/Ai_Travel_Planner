const mongoose = require('mongoose');

const placeDistanceSchema = new mongoose.Schema({
  fromPlace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TouristPlace',
    required: true
  },
  toPlace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TouristPlace',
    required: true
  },
  fromName: {
    type: String,
    required: true,
    trim: true
  },
  toName: {
    type: String,
    required: true,
    trim: true
  },
  straightLineDistanceKm: {
    type: Number,
    required: true
  },
  estimatedRoadDistanceKm: {
    type: Number,
    required: true
  },
  recommendedModes: [{
    mode: {
      type: String,
      enum: ['flight', 'train', 'bus', 'car', 'bike', 'ship']
    },
    estimatedDuration: String,
    suitability: String
  }],
  distanceSource: {
    type: String,
    enum: ['coordinate_estimate', 'manual', 'google_maps'],
    default: 'coordinate_estimate'
  }
}, {
  timestamps: true
});

placeDistanceSchema.index({ fromPlace: 1, toPlace: 1 }, { unique: true });
placeDistanceSchema.index({ fromName: 1, toName: 1 });
placeDistanceSchema.index({ estimatedRoadDistanceKm: 1 });

module.exports = mongoose.model('PlaceDistance', placeDistanceSchema);
