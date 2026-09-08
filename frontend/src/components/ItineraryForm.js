import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../api';
import '../styles/ItineraryForm.css';
import {
  MapPin,
  Calendar,
  Compass,
  DollarSign,
  Users,
  Car,
  Plane,
  Train,
  Bus,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Clock,
  Fuel,
  Bed,
  Hotel,
  Home,
  Flame,
  Camera,
  Trees,
  Snowflake,
  Coffee,
  Heart,
  Tent,
  Footprints,
  Landmark,
  Utensils,
  Palmtree,
  Wallet,
  Bike,
  KeyRound,
  Briefcase,
  Search,
  CheckCircle2,
  ExternalLink,
  CreditCard,
  QrCode,
  ShieldCheck,
  X,
  RefreshCw,
  Smartphone
} from 'lucide-react';

const ACTIVITY_ITEMS = [
  { id: 'adventure', label: 'Adventure', icon: '🧗', desc: 'Hiking, Kayaking, Rafting' },
  { id: 'cultural', label: 'Cultural', icon: '🏛️', desc: 'Temples, Heritage, Museums' },
  { id: 'food', label: 'Food & Dining', icon: '🍲', desc: 'Street food, Cafes, Markets' },
  { id: 'nature', label: 'Nature & Scenic', icon: '🌴', desc: 'Beaches, Waterfalls, Lakes' },
  { id: 'trekking', label: 'Trekking', icon: '🥾', desc: 'Summit trails, Forest hikes' },
  { id: 'camping', label: 'Camping', icon: '⛺', desc: 'Bonfires, Stargazing, Tents' },
  { id: 'wildlife', label: 'Wildlife & Safari', icon: '🐅', desc: 'National parks, Sanctuaries' },
  { id: 'photography', label: 'Photography', icon: '📸', desc: 'Viewpoints, Sunsets, Vistas' },
  { id: 'snow', label: 'Snow Destinations', icon: '❄️', desc: 'Snow sports, Glacier views' },
  { id: 'relaxation', label: 'Chill & Relax', icon: '☕', desc: 'Resorts, Spa, Sunset cafes' }
];

const ACCOMMODATION_ITEMS = [
  { id: 'hostel', label: 'Hostel / Dorm', price: '₹300 - 600/night', icon: Bed, desc: 'Social vibe & backpacker favorite' },
  { id: 'budgetHotel', label: 'Budget Hotel', price: '₹800 - 1,500/night', icon: Hotel, desc: 'Private room with essential comfort' },
  { id: 'homestay', label: 'Homestay', price: '₹600 - 1,200/night', icon: Home, desc: 'Authentic local stay & home food' },
  { id: 'airbnb', label: 'Airbnb Apartment', price: '₹1,200 - 2,500/night', icon: Sparkles, desc: 'Private flat with kitchen & space' },
  { id: 'guesthouse', label: 'Premium Guest House', price: '₹2,500 - 4,500/night', icon: Hotel, desc: 'Upgraded amenities & scenic views' }
];

const TRANSPORT_ITEMS = [
  { id: 'bus', label: 'Bus', icon: Bus, desc: 'Affordable intercity travel' },
  { id: 'ownTransport', label: 'Car', icon: Car, desc: 'Use your own vehicle' },
  { id: 'train', label: 'Train', icon: Train, desc: 'Scenic, sleeper & budget friendly' },
  { id: 'flight', label: 'Flight', icon: Plane, desc: 'Fastest for long distances' },
  { id: 'taxiCab', label: 'Taxi/Cab', icon: Car, desc: 'Door-to-door hired rides' },
  { id: 'walking', label: 'Walking', icon: Footprints, desc: 'Best for compact local plans' },
  { id: 'bike', label: 'Bike', icon: Bike, desc: 'Flexible short road travel' },
  { id: 'selfDriveRentalCar', label: 'Self-Drive Rental Car', icon: KeyRound, desc: 'Search & book cars via A6 Cars' }
];

const COMPANION_ITEMS = [
  { id: 'solo', label: 'Solo Adventurer', icon: Users, desc: 'Free-spirited personal journey' },
  { id: 'couple', label: 'Couple Trip', icon: Heart, desc: 'Romantic spots & quiet corners' },
  { id: 'friends', label: 'Friends Squad', icon: Users, desc: 'Group fun, nightlife & adventures' },
  { id: 'family', label: 'Family Vacation', icon: Home, desc: 'Comfortable, safe & relaxed pace' }
];

const BUDGET_PRESETS = [
  { label: 'Backpacker (~₹3k)', amount: 3500 },
  { label: 'Student Standard (~₹7k)', amount: 7500 },
  { label: 'Comfort Explorer (~₹14k)', amount: 14000 },
  { label: 'Premium (~₹25k)', amount: 25000 }
];

const toDateInputValue = (date) => date ? date.toISOString().split('T')[0] : '';

const buildDefaultRentalDetails = (form) => ({
  pickupLocation: form.startLocation || '',
  dropoffLocation: form.destination || form.startLocation || '',
  pickupDate: toDateInputValue(form.startDate),
  pickupTime: '10:00',
  returnDate: toDateInputValue(form.endDate),
  returnTime: '18:00',
  passengers: form.numberOfTravelers || 1,
  vehicleCategory: 'compact',
  travelDistanceKm: '',
  luggageCapacity: ''
});

function ItineraryForm({ onSubmit, initialPreset, userPreferences }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    budget: '6000',
    startDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
    endDate: new Date(Date.now() + 86400000 * 7),   // 7 days from now (4 days trip)
    startLocation: 'Mumbai',
    destination: '',
    activities: 'nature, food, adventure',
    preferredPlaceType: '',
    travelStyle: 'balanced',
    accommodation: 'hostel',
    transport: 'train',
    destinationArrivalDay: '',
    destinationArrivalDate: null,
    travelCompanionType: userPreferences?.companionType || 'friends',
    numberOfTravelers: 2,
    vehicleType: 'car',
    fuelType: 'petrol',
    vehicleMileage: '18',
    rentalDetails: {
      pickupLocation: 'Mumbai',
      dropoffLocation: '',
      pickupDate: toDateInputValue(new Date(Date.now() + 86400000 * 3)),
      pickupTime: '10:00',
      returnDate: toDateInputValue(new Date(Date.now() + 86400000 * 7)),
      returnTime: '18:00',
      passengers: 2,
      vehicleCategory: 'compact',
      travelDistanceKm: '',
      luggageCapacity: ''
    },
    rentalVehicle: null,
    rentalBooking: null
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [rentalBookingLoading, setRentalBookingLoading] = useState(false);
  const [rentalVehicles, setRentalVehicles] = useState([]);
  const [rentalError, setRentalError] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('reservation'); // 'reservation' (deposit) or 'full'
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi', 'card', 'netbanking'
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [upiId, setUpiId] = useState('');
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [selectedBank, setSelectedBank] = useState('hdfc');

  // Sync preset if selected from Dashboard
  useEffect(() => {
    if (initialPreset) {
      setForm((prev) => ({
        ...prev,
        destination: initialPreset.destination || prev.destination,
        startLocation: initialPreset.startLocation || prev.startLocation,
        budget: initialPreset.budget ? String(initialPreset.budget) : prev.budget,
        activities: initialPreset.activities || prev.activities,
        travelCompanionType: initialPreset.companion || prev.travelCompanionType,
        transport: initialPreset.transport || prev.transport,
        accommodation: initialPreset.accommodation || prev.accommodation
      }));
    }
  }, [initialPreset]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      rentalDetails: {
        ...buildDefaultRentalDetails(prev),
        ...prev.rentalDetails,
        pickupLocation: prev.rentalDetails.pickupLocation || prev.startLocation || '',
        dropoffLocation: prev.rentalDetails.dropoffLocation || prev.destination || prev.startLocation || '',
        pickupDate: prev.rentalDetails.pickupDate || toDateInputValue(prev.startDate),
        returnDate: prev.rentalDetails.returnDate || toDateInputValue(prev.endDate),
        passengers: prev.numberOfTravelers || 1
      }
    }));
  }, [form.startLocation, form.destination, form.startDate, form.endDate, form.numberOfTravelers]);

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!form.startLocation.trim()) newErrors.startLocation = 'Starting location is required';
      if (!form.destination.trim()) newErrors.destination = 'Destination is required';
      if (!form.startDate || !form.endDate) {
        newErrors.dates = 'Please choose start and end dates';
      } else if (form.startDate >= form.endDate) {
        newErrors.dates = 'End date must be after start date';
      }
    }

    if (step === 3) {
      if (!form.accommodation) newErrors.accommodation = 'Select an accommodation type';
      if (!form.transport) newErrors.transport = 'Select a transportation mode';
      if (form.transport === 'ownTransport') {
        if (!form.vehicleMileage || parseFloat(form.vehicleMileage) <= 0) {
          newErrors.vehicleMileage = 'Enter valid vehicle mileage';
        }
      }
      if (form.transport === 'selfDriveRentalCar') {
        const details = form.rentalDetails || {};
        if (!details.pickupLocation?.trim()) newErrors.pickupLocation = 'Pickup location is required';
        if (!details.dropoffLocation?.trim()) newErrors.dropoffLocation = 'Drop-off location is required';
        if (!details.pickupDate || !details.pickupTime || !details.returnDate || !details.returnTime) {
          newErrors.rentalDates = 'Pickup and return date/time are required';
        } else if (new Date(`${details.pickupDate}T${details.pickupTime}`) >= new Date(`${details.returnDate}T${details.returnTime}`)) {
          newErrors.rentalDates = 'Return must be after pickup';
        }
        if (!form.rentalVehicle) newErrors.rentalVehicle = 'Search and select an available rental car';
        if (!form.rentalBooking) newErrors.rentalBooking = 'Book or initiate the selected rental car first';
      }
    }

    if (step === 4) {
      if (!form.budget || parseFloat(form.budget) <= 0) {
        newErrors.budget = 'Please enter a valid budget';
      }
      if (!form.numberOfTravelers || parseInt(form.numberOfTravelers) < 1) {
        newErrors.numberOfTravelers = 'Min 1 traveler required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(4, prev + 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRentalDetailChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      rentalDetails: {
        ...prev.rentalDetails,
        [name]: value
      },
      rentalVehicle: ['vehicleCategory', 'pickupLocation', 'dropoffLocation', 'pickupDate', 'pickupTime', 'returnDate', 'returnTime'].includes(name)
        ? null
        : prev.rentalVehicle,
      rentalBooking: ['vehicleCategory', 'pickupLocation', 'dropoffLocation', 'pickupDate', 'pickupTime', 'returnDate', 'returnTime'].includes(name)
        ? null
        : prev.rentalBooking
    }));
    setRentalError('');
  };

  const handleRentalSearch = async () => {
    setRentalLoading(true);
    setRentalError('');
    setRentalVehicles([]);
    setForm((prev) => ({ ...prev, rentalVehicle: null, rentalBooking: null }));

    const searchParams = {
      pickupLocation: form.rentalDetails.pickupLocation || form.startLocation || 'Bangalore',
      dropoffLocation: form.rentalDetails.dropoffLocation || form.destination || form.startLocation || 'Bangalore',
      pickupDate: form.rentalDetails.pickupDate || toDateInputValue(form.startDate || new Date(Date.now() + 86400000 * 2)),
      pickupTime: form.rentalDetails.pickupTime || '09:00',
      returnDate: form.rentalDetails.returnDate || toDateInputValue(form.endDate || new Date(Date.now() + 86400000 * 5)),
      returnTime: form.rentalDetails.returnTime || '18:00',
      vehicleCategory: form.rentalDetails.vehicleCategory || 'compact',
      passengers: form.numberOfTravelers || 2,
      travelDistanceKm: form.rentalDetails.travelDistanceKm || undefined
    };

    try {
      const res = await api.get('/api/rentals/search', { params: searchParams });
      const vehicles = res.data.vehicles || [];
      setRentalVehicles(vehicles);
      if (vehicles.length === 0) {
        setRentalError('No rental cars are available for these details from A6 Cars. Try another category or date.');
      }
    } catch (err) {
      setRentalError(err.response?.data?.error || 'Car rentals are unavailable right now. Please try again.');
    } finally {
      setRentalLoading(false);
    }
  };

  useEffect(() => {
    if (form.transport === 'selfDriveRentalCar' && rentalVehicles.length === 0 && !rentalLoading) {
      handleRentalSearch();
    }
  }, [form.transport]);

  const handleSelectRentalVehicle = (vehicle) => {
    if (!vehicle.availability) {
      setRentalError(`Vehicle "${vehicle.name}" is already booked for your dates (${vehicle.availabilityReason}). Please pick an available car.`);
      return;
    }

    setForm((prev) => ({
      ...prev,
      rentalVehicle: vehicle,
      rentalBooking: null,
      fuelType: String(vehicle.fuelType || 'petrol').toLowerCase() === 'electric' ? 'electric' : String(vehicle.fuelType || 'petrol').toLowerCase()
    }));
    setRentalError('');
  };

  const handleOpenPaymentModal = async () => {
    if (!form.rentalVehicle) {
      setRentalError('Please select an available rental vehicle first.');
      return;
    }

    if (!form.rentalVehicle.availability) {
      setRentalError(`Vehicle is unavailable: ${form.rentalVehicle.availabilityReason}`);
      return;
    }

    setRentalError('');
    setPaymentSuccessData(null);
    setPaymentModalOpen(true);
  };

  const handleExecutePayment = async () => {
    if (!form.rentalVehicle) return;

    setPaymentProcessing(true);
    try {
      // 1. Ensure booking is created/initiated
      let currentBooking = form.rentalBooking;
      if (!currentBooking) {
        const initRes = await api.post('/api/rentals/booking', {
          ...form.rentalDetails,
          vehicleId: form.rentalVehicle.id,
          paymentPlan: selectedPlan,
          passengers: form.numberOfTravelers,
          returnUrl: window.location.href
        });
        currentBooking = initRes.data.booking;
      }

      // 2. Process payment
      const payableAmount = selectedPlan === 'full'
        ? form.rentalVehicle.fullPaymentAmount
        : form.rentalVehicle.reservationDeposit;

      const payRes = await api.post('/api/rentals/payment/process', {
        bookingId: currentBooking.bookingId,
        vehicleId: form.rentalVehicle.id,
        paymentPlan: selectedPlan,
        paymentMethod,
        amount: payableAmount,
        pickupDate: form.rentalDetails.pickupDate,
        returnDate: form.rentalDetails.returnDate,
        pickupLocation: form.rentalDetails.pickupLocation,
        dropoffLocation: form.rentalDetails.dropoffLocation
      });

      const confirmedBooking = payRes.data.booking;
      setPaymentSuccessData(confirmedBooking);
      setForm((prev) => ({ ...prev, rentalBooking: confirmedBooking }));
    } catch (err) {
      setRentalError(err.response?.data?.error || 'Payment processing failed. Please check your payment details or try another method.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleActivityToggle = (id) => {
    const activeList = form.activities ? form.activities.split(',').map((a) => a.trim()).filter(Boolean) : [];
    const idx = activeList.indexOf(id);
    if (idx > -1) {
      activeList.splice(idx, 1);
    } else {
      activeList.push(id);
    }
    setForm((prev) => ({ ...prev, activities: activeList.join(', ') }));
  };

  const isActivitySelected = (id) => {
    if (!form.activities) return false;
    return form.activities.split(',').map((a) => a.trim()).includes(id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setLoading(true);
    try {
      const formattedForm = {
        ...form,
        transportType: form.transport === 'selfDriveRentalCar' ? 'own' : form.transport === 'ownTransport' ? 'own' : 'public',
        vehicleType: form.transport === 'selfDriveRentalCar' ? 'car' : form.vehicleType,
        rentalDetails: form.transport === 'selfDriveRentalCar' ? form.rentalDetails : undefined,
        rentalVehicle: form.transport === 'selfDriveRentalCar' ? form.rentalVehicle : undefined,
        rentalBooking: form.transport === 'selfDriveRentalCar' ? form.rentalBooking : undefined,
        travelDates: `${form.startDate.toISOString().split('T')[0]} to ${form.endDate.toISOString().split('T')[0]}`,
        destinationArrivalDate: form.destinationArrivalDate
          ? form.destinationArrivalDate.toISOString().split('T')[0]
          : ''
      };
      await onSubmit(formattedForm);
    } finally {
      setLoading(false);
    }
  };

  // Calculate live trip length
  const tripDays = form.startDate && form.endDate
    ? Math.max(1, Math.ceil((form.endDate - form.startDate) / (1000 * 60 * 60 * 24)))
    : 1;

  const perPersonPerDay = form.budget && tripDays && form.numberOfTravelers
    ? Math.round(parseFloat(form.budget) / (tripDays * parseInt(form.numberOfTravelers || 1)))
    : 0;

  return (
    <div className="planner-form-card">
      {/* Multi-Step Tracker */}
      <div className="form-step-tracker">
        <div
          className={`step-tab ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
          onClick={() => setCurrentStep(1)}
        >
          <span className="step-number">{currentStep > 1 ? <Check size={14} /> : '1'}</span>
          <div className="step-info">
            <span className="step-title">Where & When</span>
            <span className="step-subtitle">{form.destination || 'Destination'}</span>
          </div>
        </div>

        <div
          className={`step-tab ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
          onClick={() => validateStep(1) && setCurrentStep(2)}
        >
          <span className="step-number">{currentStep > 2 ? <Check size={14} /> : '2'}</span>
          <div className="step-info">
            <span className="step-title">Vibe & Activities</span>
            <span className="step-subtitle">{form.travelStyle}</span>
          </div>
        </div>

        <div
          className={`step-tab ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
          onClick={() => validateStep(1) && setCurrentStep(3)}
        >
          <span className="step-number">{currentStep > 3 ? <Check size={14} /> : '3'}</span>
          <div className="step-info">
            <span className="step-title">Stay & Travel</span>
            <span className="step-subtitle">{form.transport} • {form.accommodation}</span>
          </div>
        </div>

        <div
          className={`step-tab ${currentStep === 4 ? 'active' : ''}`}
          onClick={() => validateStep(1) && validateStep(3) && setCurrentStep(4)}
        >
          <span className="step-number">4</span>
          <div className="step-info">
            <span className="step-title">Group & Budget</span>
            <span className="step-subtitle">₹{form.budget || 0}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Destination & Dates */}
        {currentStep === 1 && (
          <div className="form-step-content">
            <div className="step-header">
              <h3>
                <MapPin size={22} color="#14b8a6" />
                Where are you heading?
              </h3>
              <p>Enter your origin, dream destination, and travel window to begin route optimization.</p>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>
                  Starting City / Origin *
                  <span className="label-hint">(Where you depart from)</span>
                </label>
                <div className="input-with-icon">
                  <MapPin size={16} className="input-icon" />
                  <input
                    type="text"
                    name="startLocation"
                    placeholder="e.g., Delhi, Mumbai, Bangalore"
                    value={form.startLocation}
                    onChange={handleChange}
                    className={errors.startLocation ? 'input-error' : ''}
                  />
                </div>
                {errors.startLocation && (
                  <span className="error-badge">
                    <AlertCircle size={12} /> {errors.startLocation}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>
                  Destination *
                  <span className="label-hint">(Your primary stop)</span>
                </label>
                <div className="input-with-icon">
                  <Compass size={16} className="input-icon" />
                  <input
                    type="text"
                    name="destination"
                    placeholder="e.g., Goa, Manali, Kerala, Jaipur"
                    value={form.destination}
                    onChange={handleChange}
                    className={errors.destination ? 'input-error' : ''}
                  />
                </div>
                {errors.destination && (
                  <span className="error-badge">
                    <AlertCircle size={12} /> {errors.destination}
                  </span>
                )}
                {/* Quick Destination Chips */}
                <div className="quick-preset-chips">
                  <span className="quick-preset-label">Quick picks:</span>
                  {['Goa', 'Manali', 'Kerala', 'Jaipur', 'Rishikesh', 'Ladakh'].map((city) => (
                    <button
                      key={city}
                      type="button"
                      className="quick-chip"
                      onClick={() => setForm((prev) => ({ ...prev, destination: city }))}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>
                  Start Date *
                </label>
                <div className="input-with-icon date-picker-wrap">
                  <Calendar size={16} className="input-icon" />
                  <DatePicker
                    selected={form.startDate}
                    onChange={(date) => setForm((prev) => ({ ...prev, startDate: date }))}
                    dateFormat="dd MMM yyyy"
                    minDate={new Date()}
                    placeholderText="Select departure date"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  End Date *
                  <span className="label-hint">({tripDays} days total)</span>
                </label>
                <div className="input-with-icon date-picker-wrap">
                  <Calendar size={16} className="input-icon" />
                  <DatePicker
                    selected={form.endDate}
                    onChange={(date) => setForm((prev) => ({ ...prev, endDate: date }))}
                    dateFormat="dd MMM yyyy"
                    minDate={form.startDate || new Date()}
                    placeholderText="Select return date"
                  />
                </div>
                {errors.dates && (
                  <span className="error-badge">
                    <AlertCircle size={12} /> {errors.dates}
                  </span>
                )}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>
                  Target Destination Arrival Day (Optional)
                  <span className="label-hint">e.g. Reach on Day 2</span>
                </label>
                <input
                  type="number"
                  name="destinationArrivalDay"
                  placeholder="e.g., 2"
                  value={form.destinationArrivalDay}
                  onChange={handleChange}
                  min="1"
                  max={tripDays}
                />
              </div>

              <div className="form-group">
                <label>Preferred Place Category</label>
                <select
                  name="preferredPlaceType"
                  value={form.preferredPlaceType}
                  onChange={handleChange}
                >
                  <option value="">Any category (balanced mix)</option>
                  <option value="mountain">🏔️ Mountains & Hills</option>
                  <option value="beach">🏖️ Beaches & Coasts</option>
                  <option value="heritage">🏰 Historical & Heritage</option>
                  <option value="wildlife">🐅 Forests & Wildlife</option>
                  <option value="resort">💆 Relaxation & Wellness</option>
                  <option value="adventure">🧗 Adventure Hubs</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Vibe & Activities */}
        {currentStep === 2 && (
          <div className="form-step-content">
            <div className="step-header">
              <h3>
                <Sparkles size={22} color="#f59e0b" />
                Choose Your Vibe & Activities
              </h3>
              <p>Select what excites you most. The AI will curate personalized recommendations and weather-safe timing.</p>
            </div>

            <div className="form-group">
              <label>What do you love doing? (Select all that apply)</label>
              <div className="activities-selection-grid">
                {ACTIVITY_ITEMS.map((item) => {
                  const selected = isActivitySelected(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`activity-chip-card ${selected ? 'selected' : ''}`}
                      onClick={() => handleActivityToggle(item.id)}
                    >
                      <span className="activity-chip-icon">{item.icon}</span>
                      <div className="activity-chip-label">
                        <strong>{item.label}</strong>
                        <span>{item.desc}</span>
                      </div>
                      {selected && <Check size={16} color="#14b8a6" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '14px' }}>
              <label>Travel Pace & Style</label>
              <div className="options-cards-grid">
                {[
                  { id: 'balanced', label: 'Balanced Pace', desc: 'Mix of sights, local food & leisure' },
                  { id: 'relaxed', label: 'Slow & Relaxed', desc: 'Unhurried mornings, cafes & viewpoints' },
                  { id: 'adventure', label: 'Action Packed', desc: 'Maximum treks, thrills & sports' },
                  { id: 'sightseeing', label: 'Sightseeing Heavy', desc: 'Cover top landmarks & photo spots' }
                ].map((style) => (
                  <div
                    key={style.id}
                    className={`option-select-card ${form.travelStyle === style.id ? 'selected' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, travelStyle: style.id }))}
                  >
                    <span className="option-card-title">{style.label}</span>
                    <span className="option-card-subtitle">{style.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Stay & Travel Mode */}
        {currentStep === 3 && (
          <div className="form-step-content">
            <div className="step-header">
              <h3>
                <Bed size={22} color="#38bdf8" />
                Stay & Transportation
              </h3>
              <p>Choose where to sleep and how to get around. Student discounts automatically apply to estimates.</p>
            </div>

            <div className="form-group">
              <label>Preferred Accommodation</label>
              <div className="options-cards-grid">
                {ACCOMMODATION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const selected = form.accommodation === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`option-select-card ${selected ? 'selected' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, accommodation: item.id }))}
                    >
                      <div className="option-card-header">
                        <div className="option-card-icon">
                          <Icon size={18} />
                        </div>
                        <span className="option-card-title">{item.label}</span>
                      </div>
                      <span className="option-card-subtitle">{item.desc}</span>
                      <span className="option-card-badge">{item.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Primary Transportation Mode</label>
              <div className="options-cards-grid">
                {TRANSPORT_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const selected = form.transport === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`option-select-card ${selected ? 'selected' : ''}`}
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        transport: item.id,
                        rentalDetails: item.id === 'selfDriveRentalCar'
                          ? { ...buildDefaultRentalDetails(prev), ...prev.rentalDetails }
                          : prev.rentalDetails
                      }))}
                    >
                      <div className="option-card-header">
                        <div className="option-card-icon">
                          <Icon size={18} />
                        </div>
                        <span className="option-card-title">{item.label}</span>
                      </div>
                      <span className="option-card-subtitle">{item.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Own Transport Dynamic Calculator */}
            {form.transport === 'ownTransport' && (
              <div className="vehicle-calculator-box">
                <div className="vehicle-calculator-header">
                  <Fuel size={18} color="#14b8a6" />
                  <span>Vehicle Fuel & Toll Calculator</span>
                </div>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Vehicle Type</label>
                    <select
                      name="vehicleType"
                      value={form.vehicleType}
                      onChange={handleChange}
                    >
                      <option value="car">🚗 Car (Hatchback/Sedan/SUV)</option>
                      <option value="bike">🏍️ Motorcycle / Scooter</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Fuel Type</label>
                    <select
                      name="fuelType"
                      value={form.fuelType}
                      onChange={handleChange}
                    >
                      <option value="petrol">Petrol (~₹100/L)</option>
                      <option value="diesel">Diesel (~₹90/L)</option>
                      <option value="electric">Electric EV (~₹8/kWh)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Vehicle Mileage (km/L or km/kWh)</label>
                    <input
                      type="number"
                      name="vehicleMileage"
                      placeholder="e.g. 18"
                      value={form.vehicleMileage}
                      onChange={handleChange}
                      min="1"
                      step="0.5"
                    />
                    {errors.vehicleMileage && (
                      <span className="error-badge">
                        <AlertCircle size={12} /> {errors.vehicleMileage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {form.transport === 'selfDriveRentalCar' && (
              <div className="rental-workflow-box">
                <div className="vehicle-calculator-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <KeyRound size={18} color="#14b8a6" />
                    <span>Self-Drive Rental Car (A6 Cars)</span>
                  </div>
                  <a
                    href="https://a6cars-frontend-zv4g.onrender.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: '12px',
                      color: 'var(--brand, #c26d38)',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Visit A6 Cars</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Pickup Location</label>
                    <input
                      type="text"
                      name="pickupLocation"
                      value={form.rentalDetails.pickupLocation}
                      onChange={handleRentalDetailChange}
                      className={errors.pickupLocation ? 'input-error' : ''}
                    />
                    {errors.pickupLocation && <span className="error-badge"><AlertCircle size={12} /> {errors.pickupLocation}</span>}
                  </div>

                  <div className="form-group">
                    <label>Drop-off Location</label>
                    <input
                      type="text"
                      name="dropoffLocation"
                      value={form.rentalDetails.dropoffLocation}
                      onChange={handleRentalDetailChange}
                      className={errors.dropoffLocation ? 'input-error' : ''}
                    />
                    {errors.dropoffLocation && <span className="error-badge"><AlertCircle size={12} /> {errors.dropoffLocation}</span>}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-grid-2 compact-grid">
                    <div className="form-group">
                      <label>Pickup Date</label>
                      <input type="date" name="pickupDate" value={form.rentalDetails.pickupDate} onChange={handleRentalDetailChange} />
                    </div>
                    <div className="form-group">
                      <label>Pickup Time</label>
                      <input type="time" name="pickupTime" value={form.rentalDetails.pickupTime} onChange={handleRentalDetailChange} />
                    </div>
                  </div>

                  <div className="form-grid-2 compact-grid">
                    <div className="form-group">
                      <label>Return Date</label>
                      <input type="date" name="returnDate" value={form.rentalDetails.returnDate} onChange={handleRentalDetailChange} />
                    </div>
                    <div className="form-group">
                      <label>Return Time</label>
                      <input type="time" name="returnTime" value={form.rentalDetails.returnTime} onChange={handleRentalDetailChange} />
                    </div>
                  </div>
                </div>
                {errors.rentalDates && <span className="error-badge"><AlertCircle size={12} /> {errors.rentalDates}</span>}

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Vehicle Category</label>
                    <select name="vehicleCategory" value={form.rentalDetails.vehicleCategory} onChange={handleRentalDetailChange}>
                      <option value="economy">Economy</option>
                      <option value="compact">Compact</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="premium">Premium</option>
                      <option value="ev">EV</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Approx. Distance (km)</label>
                    <input
                      type="number"
                      name="travelDistanceKm"
                      min="0"
                      placeholder="Optional"
                      value={form.rentalDetails.travelDistanceKm}
                      onChange={handleRentalDetailChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Luggage Capacity</label>
                    <div className="input-with-icon">
                      <Briefcase size={16} className="input-icon" />
                      <input
                        type="number"
                        name="luggageCapacity"
                        min="0"
                        placeholder="Bags"
                        value={form.rentalDetails.luggageCapacity}
                        onChange={handleRentalDetailChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="rental-actions-row">
                  <button type="button" className="btn-secondary" onClick={handleRentalSearch} disabled={rentalLoading}>
                    <Search size={16} />
                    <span>{rentalLoading ? 'Checking Availability...' : 'Search Available Cars'}</span>
                  </button>
                  {form.rentalVehicle && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleOpenPaymentModal}
                      disabled={rentalBookingLoading || !form.rentalVehicle.availability}
                      style={{ background: form.rentalBooking?.paymentStatus === 'paid' ? '#10b981' : undefined }}
                    >
                      <ShieldCheck size={16} />
                      <span>
                        {form.rentalBooking?.paymentStatus === 'paid'
                          ? '✓ Reserved & Paid • Manage'
                          : `Reserve / Pay (${form.rentalVehicle.name.split(' ')[0]} - ₹${selectedPlan === 'full' ? form.rentalVehicle.fullPaymentAmount : form.rentalVehicle.reservationDeposit})`}
                      </span>
                    </button>
                  )}
                </div>

                {(rentalError || errors.rentalVehicle || errors.rentalBooking) && (
                  <div className="rental-message error">
                    <AlertCircle size={15} />
                    <span>{rentalError || errors.rentalVehicle || errors.rentalBooking}</span>
                  </div>
                )}

                {form.rentalBooking && (
                  <div className="rental-message success">
                    <CheckCircle2 size={15} />
                    <span>
                      Booking {form.rentalBooking.bookingId} ({form.rentalBooking.paymentStatus === 'paid' ? 'Paid & Confirmed' : 'Initiated'}) attached to itinerary.
                    </span>
                    {form.rentalBooking.bookingUrl && (
                      <a href={form.rentalBooking.bookingUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} /> View on A6 Cars
                      </a>
                    )}
                  </div>
                )}

                {rentalVehicles.length > 0 && (
                  <div className="rental-vehicles-grid">
                    {rentalVehicles.map((vehicle) => {
                      const selected = form.rentalVehicle?.id === vehicle.id;
                      const isAvailable = vehicle.availability !== false;
                      return (
                        <button
                          type="button"
                          key={vehicle.id}
                          className={`rental-vehicle-card ${selected ? 'selected' : ''} ${!isAvailable ? 'disabled-card' : ''}`}
                          onClick={() => handleSelectRentalVehicle(vehicle)}
                          style={{ opacity: isAvailable ? 1 : 0.6 }}
                        >
                          {vehicle.image && <img src={vehicle.image} alt={vehicle.name} />}
                          <div className="rental-vehicle-body">
                            <div className="rental-vehicle-title-row">
                              <strong>{vehicle.name}</strong>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isAvailable ? '#059669' : '#dc2626'
                              }}>
                                {isAvailable ? '🟢 Available' : '🔴 Booked'}
                              </span>
                            </div>
                            <p>{vehicle.category.toUpperCase()} • {vehicle.transmissionType} • {vehicle.fuelType}</p>
                            <div className="rental-vehicle-specs">
                              <span><Users size={13} /> {vehicle.seatingCapacity} seats</span>
                              <span><Briefcase size={13} /> {vehicle.luggageCapacity} bags</span>
                            </div>
                            <div className="rental-vehicle-price">
                              <span>₹{vehicle.pricePerDay}/day</span>
                              <div style={{ textAlign: 'right' }}>
                                <strong>Est. ₹{vehicle.estimatedTotalCost}</strong>
                                <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>
                                  Deposit: ₹{vehicle.reservationDeposit || 2500}
                                </small>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Group & Budget */}
        {currentStep === 4 && (
          <div className="form-step-content">
            <div className="step-header">
              <h3>
                <Wallet size={22} color="#10b981" />
                Companions & Budget
              </h3>
              <p>Customize group size and total trip funds. VISTA will balance costs realistically across all days.</p>
            </div>

            <div className="form-group">
              <label>Who are you traveling with?</label>
              <div className="options-cards-grid">
                {COMPANION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const selected = form.travelCompanionType === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`option-select-card ${selected ? 'selected' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, travelCompanionType: item.id }))}
                    >
                      <div className="option-card-header">
                        <div className="option-card-icon">
                          <Icon size={18} />
                        </div>
                        <span className="option-card-title">{item.label}</span>
                      </div>
                      <span className="option-card-subtitle">{item.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>Number of Travelers</label>
                <div className="stepper-container">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        numberOfTravelers: Math.max(1, parseInt(prev.numberOfTravelers || 1) - 1)
                      }))
                    }
                    disabled={parseInt(form.numberOfTravelers) <= 1}
                  >
                    -
                  </button>
                  <span className="stepper-value">{form.numberOfTravelers}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        numberOfTravelers: Math.min(20, parseInt(prev.numberOfTravelers || 1) + 1)
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Total Trip Budget (INR) *
                  <span className="label-hint">(All travelers combined)</span>
                </label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ fontWeight: 800, color: 'var(--brand-light)' }}>₹</span>
                  <input
                    type="number"
                    name="budget"
                    placeholder="e.g. 8000"
                    value={form.budget}
                    onChange={handleChange}
                    min="500"
                    step="100"
                    className={errors.budget ? 'input-error' : ''}
                  />
                </div>
                {errors.budget && (
                  <span className="error-badge">
                    <AlertCircle size={12} /> {errors.budget}
                  </span>
                )}

                {/* Quick Budget Tiers */}
                <div className="budget-tier-chips">
                  {BUDGET_PRESETS.map((tier) => (
                    <button
                      key={tier.label}
                      type="button"
                      className={`budget-tier-chip ${parseInt(form.budget) === tier.amount ? 'active' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, budget: String(tier.amount) }))}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Trip Summary Preview Bar */}
            <div className="trip-preview-bar">
              <div className="trip-preview-info">
                <span>Trip Breakdown:</span>
                <span className="trip-preview-pill">
                  <Clock size={13} /> {tripDays} Days
                </span>
                <span className="trip-preview-pill">
                  <Users size={13} /> {form.numberOfTravelers} Travelers
                </span>
                <span className="trip-preview-pill">
                  <Wallet size={13} /> ~₹{perPersonPerDay} / person / day
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation & Action Bar */}
        <div className="form-step-actions">
          {currentStep > 1 ? (
            <button type="button" className="btn-secondary" onClick={handlePrev}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button type="button" className="btn-primary" onClick={handleNext}>
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              className="btn-generate-big"
              disabled={loading}
            >
              <Sparkles size={20} />
              <span>{loading ? 'Crafting Itinerary...' : 'Generate AI Itinerary'}</span>
            </button>
          )}
        </div>

        {/* A6 Cars Payment & Reservation Modal */}
        {paymentModalOpen && form.rentalVehicle && (
          <div className="payment-modal-backdrop" onClick={() => !paymentProcessing && setPaymentModalOpen(false)}>
            <div className="payment-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="payment-modal-header">
                <h3>
                  <KeyRound size={18} color="#c26d38" />
                  <span>{paymentSuccessData ? 'Reservation Confirmed' : 'Reserve & Pay • A6 Cars'}</span>
                </h3>
                {!paymentProcessing && (
                  <button type="button" className="payment-close-btn" onClick={() => setPaymentModalOpen(false)}>
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="payment-modal-body">
                {paymentSuccessData ? (
                  <div className="payment-success-card">
                    <div className="payment-success-icon">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 style={{ margin: 0, color: 'var(--ink-heading)' }}>Payment Confirmed!</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
                      Your vehicle <strong>{paymentSuccessData.vehicleName || form.rentalVehicle.name}</strong> is reserved and linked to your itinerary.
                    </p>

                    <div className="payment-receipt-grid">
                      <div>
                        <span>Booking ID</span>
                        <strong>{paymentSuccessData.bookingId}</strong>
                      </div>
                      <div>
                        <span>Transaction ID</span>
                        <strong>{paymentSuccessData.transactionId}</strong>
                      </div>
                      <div>
                        <span>Amount Paid</span>
                        <strong style={{ color: '#10b981' }}>₹{paymentSuccessData.paidAmount}</strong>
                      </div>
                      <div>
                        <span>Collection PIN</span>
                        <strong>{paymentSuccessData.collectionPin || '4928'}</strong>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span>Pickup Dates</span>
                        <strong>{paymentSuccessData.pickupDate} to {paymentSuccessData.returnDate}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setPaymentModalOpen(false)}
                      >
                        <Check size={16} />
                        <span>Done • Continue Trip Planning</span>
                      </button>
                      {paymentSuccessData.bookingUrl && (
                        <a
                          href={paymentSuccessData.bookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                        >
                          <ExternalLink size={14} />
                          <span>A6 Portal</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Vehicle summary */}
                    <div className="payment-vehicle-summary">
                      {form.rentalVehicle.image && <img src={form.rentalVehicle.image} alt={form.rentalVehicle.name} />}
                      <div className="payment-vehicle-info">
                        <strong>{form.rentalVehicle.name}</strong>
                        <span>{form.rentalVehicle.category.toUpperCase()} • ₹{form.rentalVehicle.pricePerDay}/day • {form.rentalVehicle.rentalDays || 1} days</span>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          Pickup: {form.rentalDetails.pickupLocation} ({form.rentalDetails.pickupDate})
                        </div>
                      </div>
                    </div>

                    {/* Plan Selector */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                        Select Payment Option
                      </label>
                      <div className="payment-plan-selector">
                        <div
                          className={`payment-plan-card ${selectedPlan === 'reservation' ? 'active' : ''}`}
                          onClick={() => setSelectedPlan('reservation')}
                        >
                          <div className="payment-plan-title">
                            <ShieldCheck size={15} color="#c26d38" />
                            <span>Reserve (Advance)</span>
                          </div>
                          <span className="payment-plan-amount">₹{form.rentalVehicle.reservationDeposit}</span>
                          <span className="payment-plan-sub">Pay security deposit now; balance at vehicle pickup.</span>
                        </div>

                        <div
                          className={`payment-plan-card ${selectedPlan === 'full' ? 'active' : ''}`}
                          onClick={() => setSelectedPlan('full')}
                        >
                          <div className="payment-plan-title">
                            <CreditCard size={15} color="#c26d38" />
                            <span>Full Trip Payment</span>
                          </div>
                          <span className="payment-plan-amount">₹{form.rentalVehicle.fullPaymentAmount}</span>
                          <span className="payment-plan-sub">Total rental + refundable deposit included upfront.</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Method Tabs */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                        Payment Method
                      </label>
                      <div className="payment-method-tabs">
                        <button
                          type="button"
                          className={`payment-method-tab ${paymentMethod === 'upi' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('upi')}
                        >
                          <QrCode size={14} />
                          <span>UPI / QR</span>
                        </button>
                        <button
                          type="button"
                          className={`payment-method-tab ${paymentMethod === 'card' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('card')}
                        >
                          <CreditCard size={14} />
                          <span>Cards</span>
                        </button>
                        <button
                          type="button"
                          className={`payment-method-tab ${paymentMethod === 'netbanking' ? 'active' : ''}`}
                          onClick={() => setPaymentMethod('netbanking')}
                        >
                          <Landmark size={14} />
                          <span>Net Banking</span>
                        </button>
                      </div>
                    </div>

                    {/* Method Details */}
                    {paymentMethod === 'upi' && (
                      <div className="qr-container">
                        <div className="qr-box">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi://pay?pa=a6cars@upi%26pn=A6%20Cars%20Rentals%26am=${selectedPlan === 'full' ? form.rentalVehicle.fullPaymentAmount : form.rentalVehicle.reservationDeposit}%26cu=INR`}
                            alt="Payment QR"
                            style={{ width: '130px', height: '130px', display: 'block' }}
                          />
                        </div>
                        <div className="qr-merchant-info">
                          <strong>Scan to pay with any UPI App</strong>
                          <span>GPay • PhonePe • Paytm • BHIM • CRED</span>
                        </div>
                        <div style={{ width: '100%' }}>
                          <input
                            type="text"
                            placeholder="Or enter UPI ID (e.g. name@okhdfcbank)"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'card' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                          type="text"
                          placeholder="Card Number (16 Digits)"
                          maxLength="19"
                          value={cardData.number}
                          onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                          style={{ fontSize: '13px', padding: '8px 12px' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            maxLength="5"
                            value={cardData.expiry}
                            onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                            style={{ fontSize: '13px', padding: '8px 12px' }}
                          />
                          <input
                            type="password"
                            placeholder="CVV (3 Digits)"
                            maxLength="3"
                            value={cardData.cvv}
                            onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                            style={{ fontSize: '13px', padding: '8px 12px' }}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Name on Card"
                          value={cardData.name}
                          onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                          style={{ fontSize: '13px', padding: '8px 12px' }}
                        />
                      </div>
                    )}

                    {paymentMethod === 'netbanking' && (
                      <div>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
                        >
                          <option value="hdfc">HDFC Bank</option>
                          <option value="icici">ICICI Bank</option>
                          <option value="sbi">State Bank of India (SBI)</option>
                          <option value="axis">Axis Bank</option>
                          <option value="kotak">Kotak Mahindra Bank</option>
                          <option value="pnb">Punjab National Bank</option>
                        </select>
                      </div>
                    )}

                    {/* Payment CTA */}
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '6px' }}
                      onClick={handleExecutePayment}
                      disabled={paymentProcessing}
                    >
                      {paymentProcessing ? (
                        <>
                          <RefreshCw size={16} className="spinner" />
                          <span>Processing Payment Securely...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          <span>
                            Pay ₹{selectedPlan === 'full' ? form.rentalVehicle.fullPaymentAmount : form.rentalVehicle.reservationDeposit} & Confirm {selectedPlan === 'full' ? 'Booking' : 'Reservation'}
                          </span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default ItineraryForm;
