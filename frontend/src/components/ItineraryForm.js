import React, { useState } from 'react';
import '../styles/ItineraryForm.css';

function ItineraryForm({ onSubmit }) {
  const [form, setForm] = useState({
    budget: '',
    travelDates: '',
    startLocation: '',
    destination: '',
    activities: '',
    accommodation: 'hostel',
    transport: 'bus',
    travelCompanionType: 'solo',
    numberOfTravelers: 1,
    // New fields for own transportation
    vehicleType: 'car',
    fuelType: 'petrol',
    vehicleMileage: ''
  });

  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const activityOptions = [
    { label: 'Adventure (Hiking, Rock climbing, Kayaking)', value: 'adventure' },
    { label: 'Cultural (Museums, Temples, Street art)', value: 'cultural' },
    { label: 'Food (Street food, Cooking classes, Markets)', value: 'food' },
    { label: 'Nature (Beaches, Parks, Waterfalls)', value: 'nature' }
  ];

  const accommodationOptions = [
    { label: 'Hostel (₹150-250/night)', value: 'hostel' },
    { label: 'Budget Hotel (₹350-600/night)', value: 'budgetHotel' },
    { label: 'Homestay (₹200-400/night)', value: 'homestay' },
    { label: 'Airbnb (₹300-500/night)', value: 'airbnb' },
    { label: 'Guest House (₹2500-4000/night)', value: 'guesthouse' }
  ];

  const transportOptions = [
    { label: 'Flight (Fastest)', value: 'flight' },
    { label: 'Train (Comfortable)', value: 'train' },
    { label: 'Bus (Budget-friendly)', value: 'bus' },
    { label: 'Own Transportation', value: 'ownTransport' }
  ];

  const vehicleOptions = [
    { label: 'Car', value: 'car' },
    { label: 'Bike', value: 'bike' }
  ];

  const fuelOptions = [
    { label: 'Petrol', value: 'petrol' },
    { label: 'Diesel', value: 'diesel' },
    { label: 'Electric', value: 'electric' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!form.budget || parseFloat(form.budget) <= 0) {
      newErrors.budget = 'Please enter a valid budget amount';
    }

    if (!form.travelDates || !form.travelDates.includes(' to ')) {
      newErrors.travelDates = 'Please enter dates in format: YYYY-MM-DD to YYYY-MM-DD';
    }

    if (!form.startLocation.trim()) {
      newErrors.startLocation = 'Please enter your starting location';
    }

    if (!form.destination.trim()) {
      newErrors.destination = 'Please enter your destination';
    }

    if (!form.accommodation) {
      newErrors.accommodation = 'Please select accommodation type';
    }

    if (!form.transport) {
      newErrors.transport = 'Please select transport mode';
    }

    // Validate vehicle details if own transport is selected
    if (form.transport === 'ownTransport') {
      if (!form.vehicleType) {
        newErrors.vehicleType = 'Please select vehicle type';
      }
      if (!form.fuelType) {
        newErrors.fuelType = 'Please select fuel type';
      }
      if (!form.vehicleMileage || parseFloat(form.vehicleMileage) <= 0) {
        newErrors.vehicleMileage = 'Please enter valid vehicle mileage/efficiency';
      }
    }

    if (!form.travelCompanionType) {
      newErrors.travelCompanionType = 'Please select travel companion type';
    }

    if (!form.numberOfTravelers || parseInt(form.numberOfTravelers) < 1) {
      newErrors.numberOfTravelers = 'Please enter number of travelers (minimum 1)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));

    // Show/hide vehicle details based on transport selection
    if (name === 'transport') {
      setShowVehicleDetails(value === 'ownTransport');
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleActivityToggle = (value) => {
    const activities = form.activities.split(',').map(a => a.trim()).filter(a => a);
    const index = activities.indexOf(value);

    if (index > -1) {
      activities.splice(index, 1);
    } else {
      activities.push(value);
    }

    setForm(prev => ({
      ...prev,
      activities: activities.join(', ')
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  };

  const isActivitySelected = (value) => {
    return form.activities.split(',').map(a => a.trim()).includes(value);
  };

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit} className="itinerary-form">
        {/* Budget Section */}
        <div className="form-section">
          <h3>Travel Budget & Dates</h3>

          <div className="form-group">
            <label htmlFor="budget">
              Total Budget (INR) *
              <span className="tooltip">💡 This is your total budget for the entire trip</span>
            </label>
            <input
              id="budget"
              type="number"
              name="budget"
              placeholder="e.g., 1500"
              value={form.budget}
              onChange={handleChange}
              className={errors.budget ? 'input-error' : ''}
              min="1"
              step="10"
            />
            {errors.budget && <span className="error-message">{errors.budget}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="travelDates">
              Travel Dates *
              <span className="tooltip">💡 Format: YYYY-MM-DD to YYYY-MM-DD</span>
            </label>
            <input
              id="travelDates"
              type="text"
              name="travelDates"
              placeholder="2024-03-15 to 2024-03-22"
              value={form.travelDates}
              onChange={handleChange}
              className={errors.travelDates ? 'input-error' : ''}
            />
            {errors.travelDates && <span className="error-message">{errors.travelDates}</span>}
          </div>
        </div>

        {/* Location Section */}
        <div className="form-section">
          <h3>Travel Locations</h3>

          <div className="form-group">
            <label htmlFor="startLocation">
              Starting Location *
              <span className="tooltip">💡 Where you're traveling from</span>
            </label>
            <input
              id="startLocation"
              type="text"
              name="startLocation"
              placeholder="e.g., Hyderabad"
              value={form.startLocation}
              onChange={handleChange}
              className={errors.startLocation ? 'input-error' : ''}
            />
            {errors.startLocation && <span className="error-message">{errors.startLocation}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="destination">
              Destination *
              <span className="tooltip">💡 Your main travel destination</span>
            </label>
            <input
              id="destination"
              type="text"
              name="destination"
              placeholder="e.g., kerala"
              value={form.destination}
              onChange={handleChange}
              className={errors.destination ? 'input-error' : ''}
            />
            {errors.destination && <span className="error-message">{errors.destination}</span>}
          </div>
        </div>

        {/* Activities Section */}
        <div className="form-section">
          <h3>Preferred Activities</h3>
          <p className="section-info">Select activities you're interested in (optional - all selected for recommendations)</p>

          <div className="activity-grid">
            {activityOptions.map(option => (
              <label key={option.value} className="activity-checkbox">
                <input
                  type="checkbox"
                  checked={isActivitySelected(option.value)}
                  onChange={() => handleActivityToggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Accommodation Section */}
        <div className="form-section">
          <h3>Accommodation Type</h3>

          <div className="form-group">
            <label htmlFor="accommodation">
              Choose Your Accommodation *
              <span className="tooltip">💡 Select based on comfort level and budget</span>
            </label>
            <select
              id="accommodation"
              name="accommodation"
              value={form.accommodation}
              onChange={handleChange}
              className={errors.accommodation ? 'input-error' : ''}
            >
              <option value="">Select accommodation type...</option>
              {accommodationOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.accommodation && <span className="error-message">{errors.accommodation}</span>}
          </div>
        </div>

        {/* Transport Section */}
        <div className="form-section">
          <h3>Transportation Mode</h3>

          <div className="form-group">
            <label htmlFor="transport">
              Choose Primary Transport *
              <span className="tooltip">💡 Student discounts apply to all options</span>
            </label>
            <select
              id="transport"
              name="transport"
              value={form.transport}
              onChange={handleChange}
              className={errors.transport ? 'input-error' : ''}
            >
              <option value="">Select transport mode...</option>
              {transportOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.transport && <span className="error-message">{errors.transport}</span>}
          </div>

          {/* Vehicle Details Section - Only show if Own Transportation is selected */}
          {showVehicleDetails && (
            <div className="vehicle-details-section">
              <h4>🚗 Vehicle Details</h4>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="vehicleType">
                    Vehicle Type *
                    <span className="tooltip">💡 Car or Bike</span>
                  </label>
                  <select
                    id="vehicleType"
                    name="vehicleType"
                    value={form.vehicleType}
                    onChange={handleChange}
                    className={errors.vehicleType ? 'input-error' : ''}
                  >
                    <option value="">Select vehicle type...</option>
                    {vehicleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.vehicleType && <span className="error-message">{errors.vehicleType}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="fuelType">
                    Fuel Type *
                    <span className="tooltip">💡 Type of fuel your vehicle uses</span>
                  </label>
                  <select
                    id="fuelType"
                    name="fuelType"
                    value={form.fuelType}
                    onChange={handleChange}
                    className={errors.fuelType ? 'input-error' : ''}
                  >
                    <option value="">Select fuel type...</option>
                    {fuelOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.fuelType && <span className="error-message">{errors.fuelType}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="vehicleMileage">
                  Vehicle Mileage/Efficiency *
                  <span className="tooltip">
                    💡 {form.fuelType === 'electric' ? 'km per kWh charge' : 'km per litre'}
                  </span>
                </label>
                <input
                  id="vehicleMileage"
                  type="number"
                  name="vehicleMileage"
                  placeholder={form.fuelType === 'electric' ? 'e.g., 5' : 'e.g., 15'}
                  value={form.vehicleMileage}
                  onChange={handleChange}
                  className={errors.vehicleMileage ? 'input-error' : ''}
                  min="1"
                  step="0.1"
                />
                {errors.vehicleMileage && <span className="error-message">{errors.vehicleMileage}</span>}
                <small className="help-text">
                  {form.fuelType === 'electric'
                    ? 'Kilometers per kWh (e.g., Tesla Model 3: ~5 km/kWh)'
                    : 'Kilometers per litre (e.g., Swift: 18-22 km/l)'}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Travel Companion Section */}
        <div className="form-section">
          <h3>Travel Companion Type & Group Size</h3>

          <div className="form-group">
            <label htmlFor="travelCompanionType">
              Who are you traveling with? *
              <span className="tooltip">💡 Helps us personalize activity recommendations</span>
            </label>
            <select
              id="travelCompanionType"
              name="travelCompanionType"
              value={form.travelCompanionType}
              onChange={handleChange}
              className={errors.travelCompanionType ? 'input-error' : ''}
            >
              <option value="">Select companion type...</option>
              <option value="solo">Solo Traveler 🚶</option>
              <option value="couple">Couple 💑</option>
              <option value="friends">Friends Group 👥</option>
              <option value="family">Family 👨‍👩‍👧‍👦</option>
            </select>
            {errors.travelCompanionType && <span className="error-message">{errors.travelCompanionType}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="numberOfTravelers">
              Number of Travelers *
              <span className="tooltip">💡 Used to calculate total costs</span>
            </label>
            <input
              id="numberOfTravelers"
              type="number"
              name="numberOfTravelers"
              value={form.numberOfTravelers}
              onChange={handleChange}
              className={errors.numberOfTravelers ? 'input-error' : ''}
              min="1"
              max="20"
            />
            {errors.numberOfTravelers && <span className="error-message">{errors.numberOfTravelers}</span>}
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-generate"
            disabled={loading}
          >
            {loading ? 'Generating Itinerary...' : '✈️ Generate My Itinerary'}
          </button>
          <p className="form-note">
            💡 All prices are approximate and may vary. Student IDs are eligible for 15-25% discounts.
          </p>
        </div>
      </form>
    </div>
  );
}

export default ItineraryForm;