/**
 * Route Place Discovery & Recommendation Engine
 *
 * Implements a Multi-Stage Attraction Discovery & Ranking Architecture:
 * 1. Complete Route Segmentation (Source -> Intermediate Towns -> Destination)
 * 2. Multi-Category Query Discovery (Temples, Heritage, Nature, Forts, Viewpoints)
 * 3. Famous-Place & Landmark Verification Layer (UNESCO, ASI, Iconic Renown)
 * 4. Multi-Factor Scoring (Fame + Popularity + Rating + Preference + Proximity + Time/Season)
 * 5. Candidate Protection (Prevents famous places from premature filtering)
 * 6. Detailed Pipeline Logging
 */

const { searchPlacesByText, findPlacesNearby, hasGoogleMapsAPI } = require('../utils/googleMapsAPI');
const indiaTouristPlaces = require('../data/indiaTouristPlaces');

/* =========================================================================
 * 1. COMPREHENSIVE FAMOUS LANDMARK & HERITAGE REPOSITORY (ALL INDIA STATES)
 * ========================================================================= */

const FAMOUS_LANDMARKS_DATABASE = [
  // --- TAMIL NADU ---
  {
    name: 'Meenakshi Amman Temple',
    city: 'Madurai',
    state: 'Tamil Nadu',
    coordinates: { lat: 9.9195, lng: 78.1193 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 145000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'heritage', 'architecture', 'must_visit'],
    description: 'Historic Hindu temple on the southern bank of the Vaigai River, globally renowned for its 14 towering gopurams and thousand-pillar hall.'
  },
  {
    name: 'Brihadeeswarar Temple',
    city: 'Thanjavur',
    state: 'Tamil Nadu',
    coordinates: { lat: 10.7828, lng: 79.1318 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 68000,
    rating: 4.8,
    tags: ['temple', 'unesco', 'heritage', 'architecture', 'must_visit'],
    description: 'UNESCO World Heritage Great Living Chola Temple built by Raja Raja Chola I, famous for its massive single-granite vimana.'
  },
  {
    name: 'Shore Temple & Pancha Rathas',
    city: 'Mahabalipuram',
    state: 'Tamil Nadu',
    coordinates: { lat: 12.6169, lng: 80.1983 },
    category: 'temple',
    fameScore: 0.95,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 54000,
    rating: 4.7,
    tags: ['temple', 'beach', 'unesco', 'heritage', 'must_visit'],
    description: '7th-century rock-cut monuments and structural Shore Temple overlooking the Bay of Bengal.'
  },
  {
    name: 'Sri Ranganathaswamy Temple',
    city: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    coordinates: { lat: 10.8624, lng: 78.6904 },
    category: 'temple',
    fameScore: 0.95,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 72000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'heritage', 'must_visit'],
    description: 'The largest functioning Hindu temple complex in the world, spanning 156 acres on Srirangam island.'
  },
  {
    name: 'Rockfort Temple (Ucchi Pillayar)',
    city: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    coordinates: { lat: 10.8286, lng: 78.6974 },
    category: 'fort',
    fameScore: 0.9,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 42000,
    rating: 4.6,
    tags: ['fort', 'temple', 'viewpoint', 'heritage'],
    description: 'Historic 83m ancient rock fortress with panoramic views over the Kaveri river and Trichy city.'
  },
  {
    name: 'Ramanathaswamy Temple',
    city: 'Rameswaram',
    state: 'Tamil Nadu',
    coordinates: { lat: 9.2881, lng: 79.3174 },
    category: 'temple',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 95000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'pilgrimage', 'must_visit'],
    description: 'Char Dham Jyotirlinga pilgrimage temple famous for having the longest corridor among all Hindu temples in India.'
  },
  {
    name: 'Dhanushkodi Ghost Town & Point',
    city: 'Rameswaram',
    state: 'Tamil Nadu',
    coordinates: { lat: 9.1771, lng: 79.4187 },
    category: 'beach',
    fameScore: 0.9,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 38000,
    rating: 4.7,
    tags: ['beach', 'nature', 'viewpoint', 'adventure'],
    description: 'Scenic tip of Pamban Island where the Bay of Bengal meets the Indian Ocean at Ram Setu.'
  },
  {
    name: 'Thirumalai Nayakkar Mahal',
    city: 'Madurai',
    state: 'Tamil Nadu',
    coordinates: { lat: 9.9154, lng: 78.1238 },
    category: 'palace',
    fameScore: 0.88,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 35000,
    rating: 4.5,
    tags: ['palace', 'heritage', 'culture'],
    description: '17th-century palace built by King Tirumala Nayaka, renowned for massive pillars and Indo-Saracenic design.'
  },
  {
    name: 'Thillai Nataraja Temple',
    city: 'Chidambaram',
    state: 'Tamil Nadu',
    coordinates: { lat: 11.3992, lng: 79.6935 },
    category: 'temple',
    fameScore: 0.92,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 44000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'heritage'],
    description: 'Ancient temple dedicated to Lord Shiva in his Cosmic Dance form (Ananda Tandava), center of classical art.'
  },
  {
    name: 'Airavatesvara Temple',
    city: 'Kumbakonam',
    state: 'Tamil Nadu',
    coordinates: { lat: 10.9577, lng: 79.3564 },
    category: 'temple',
    fameScore: 0.94,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 28000,
    rating: 4.8,
    tags: ['temple', 'unesco', 'heritage', 'architecture'],
    description: 'UNESCO World Heritage Chola temple at Darasuram with intricate stone chariot sculptures and musical steps.'
  },
  {
    name: 'Vivekananda Rock Memorial & Thiruvalluvar Statue',
    city: 'Kanyakumari',
    state: 'Tamil Nadu',
    coordinates: { lat: 8.078, lng: 77.555 },
    category: 'viewpoint',
    fameScore: 0.95,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 75000,
    rating: 4.8,
    tags: ['viewpoint', 'spiritual', 'sunrise_point', 'sunset_point', 'must_visit'],
    description: 'Iconic island memorial and 133-ft stone statue at the southernmost tip of mainland India where three seas meet.'
  },
  {
    name: 'Ooty Doddabetta Peak & Botanical Gardens',
    city: 'Ooty',
    state: 'Tamil Nadu',
    coordinates: { lat: 11.4064, lng: 76.7356 },
    category: 'viewpoint',
    fameScore: 0.9,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 62000,
    rating: 4.5,
    tags: ['hill_station', 'nature', 'viewpoint', 'must_visit'],
    description: 'Highest mountain in the Nilgiri Hills offering panoramic views across Tamil Nadu and Kerala valleys.'
  },

  // --- KERALA ---
  {
    name: 'Alleppey Backwaters & Vembanad Lake',
    city: 'Alleppey',
    state: 'Kerala',
    coordinates: { lat: 9.4981, lng: 76.3388 },
    category: 'lake',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 82000,
    rating: 4.8,
    tags: ['lake', 'nature', 'relaxation', 'must_visit'],
    description: 'The Venice of the East, famous for tranquil houseboat cruises on palm-fringed lagoons.'
  },
  {
    name: 'Munnar Tea Plantations & Eravikulam National Park',
    city: 'Munnar',
    state: 'Kerala',
    coordinates: { lat: 10.0889, lng: 77.0595 },
    category: 'national_park',
    fameScore: 0.96,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 90000,
    rating: 4.8,
    tags: ['nature', 'hill_station', 'viewpoint', 'must_visit'],
    description: 'Rolling mist-covered tea hills and sanctuary of the endangered Nilgiri Tahr and Anamudi peak.'
  },
  {
    name: 'Sree Padmanabhaswamy Temple',
    city: 'Thiruvananthapuram',
    state: 'Kerala',
    coordinates: { lat: 8.483, lng: 76.9436 },
    category: 'temple',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 88000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'heritage', 'must_visit'],
    description: 'Magnificent gold-plated temple built in an intricate blend of Chera and Dravidian architectural styles.'
  },
  {
    name: 'Periyar National Park & Wildlife Sanctuary',
    city: 'Thekkady',
    state: 'Kerala',
    coordinates: { lat: 9.4679, lng: 77.1435 },
    category: 'national_park',
    fameScore: 0.92,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 48000,
    rating: 4.6,
    tags: ['national_park', 'wildlife', 'nature', 'adventure'],
    description: 'Protected elephant and tiger reserve surrounding a scenic artificial lake in the Western Ghats.'
  },
  {
    name: 'Athirappilly Waterfalls',
    city: 'Thrissur',
    state: 'Kerala',
    coordinates: { lat: 10.2851, lng: 76.5698 },
    category: 'waterfall',
    fameScore: 0.94,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 58000,
    rating: 4.7,
    tags: ['waterfall', 'nature', 'photography', 'must_visit'],
    description: 'The Niagara of India — an 80-ft high and 330-ft wide cascading waterfall on the Chalakudy River.'
  },

  // --- KARNATAKA ---
  {
    name: 'Mysore Palace (Amba Vilas)',
    city: 'Mysore',
    state: 'Karnataka',
    coordinates: { lat: 12.3052, lng: 76.6552 },
    category: 'palace',
    fameScore: 1.0,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 135000,
    rating: 4.8,
    tags: ['palace', 'heritage', 'culture', 'must_visit'],
    description: 'One of the most visited monuments in India, glowing with 100,000 lights on weekends and Dasara festivals.'
  },
  {
    name: 'Hampi UNESCO Group of Monuments',
    city: 'Hampi',
    state: 'Karnataka',
    coordinates: { lat: 15.335, lng: 76.46 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 78000,
    rating: 4.9,
    tags: ['temple', 'unesco', 'heritage', 'fort', 'must_visit'],
    description: 'UNESCO World Heritage capital of the Vijayanagara Empire, featuring the Stone Chariot, Virupaksha, and Vittala Temple.'
  },
  {
    name: 'Jog Falls',
    city: 'Shivamogga',
    state: 'Karnataka',
    coordinates: { lat: 14.2285, lng: 74.8124 },
    category: 'waterfall',
    fameScore: 0.92,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 52000,
    rating: 4.6,
    tags: ['waterfall', 'nature', 'viewpoint'],
    description: 'India’s second-highest plunge waterfall, dropping 253 meters in four distinct cascades on the Sharavathi River.'
  },
  {
    name: 'Murudeshwar Shiva Temple & Beach',
    city: 'Murudeshwar',
    state: 'Karnataka',
    coordinates: { lat: 14.0941, lng: 74.4849 },
    category: 'temple',
    fameScore: 0.94,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 65000,
    rating: 4.8,
    tags: ['temple', 'beach', 'viewpoint', 'must_visit'],
    description: 'World’s second-tallest Lord Shiva statue and 20-storied Raja Gopura perched right on the Arabian Sea coast.'
  },

  // --- MAHARASHTRA ---
  {
    name: 'Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: { lat: 18.922, lng: 72.8347 },
    category: 'palace',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 160000,
    rating: 4.7,
    tags: ['heritage', 'beach', 'viewpoint', 'must_visit'],
    description: 'Iconic 20th-century arch monument overlooking Mumbai Harbour and the Arabian Sea.'
  },
  {
    name: 'Ajanta & Ellora Caves',
    city: 'Aurangabad',
    state: 'Maharashtra',
    coordinates: { lat: 20.0268, lng: 75.178 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 62000,
    rating: 4.9,
    tags: ['temple', 'unesco', 'heritage', 'must_visit'],
    description: 'UNESCO World Heritage monolithic rock-cut cave monuments featuring the Kailash Temple carved from a single cliff.'
  },
  {
    name: 'Shirdi Sai Baba Sansthan Temple',
    city: 'Shirdi',
    state: 'Maharashtra',
    coordinates: { lat: 19.7668, lng: 74.4762 },
    category: 'temple',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 120000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'pilgrimage', 'must_visit'],
    description: 'World-renowned holy pilgrimage shrine of Shri Sai Baba visited by millions of devotees.'
  },

  // --- RAJASTHAN ---
  {
    name: 'Amber Palace & Fort',
    city: 'Jaipur',
    state: 'Rajasthan',
    coordinates: { lat: 26.9855, lng: 75.8513 },
    category: 'fort',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 110000,
    rating: 4.8,
    tags: ['fort', 'palace', 'unesco', 'heritage', 'must_visit'],
    description: 'UNESCO Hill Fort of Rajasthan overlooking Maota Lake, famous for Sheesh Mahal (Mirror Palace).'
  },
  {
    name: 'Hawa Mahal (Palace of Winds)',
    city: 'Jaipur',
    state: 'Rajasthan',
    coordinates: { lat: 26.9239, lng: 75.8267 },
    category: 'palace',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 130000,
    rating: 4.7,
    tags: ['palace', 'heritage', 'architecture', 'must_visit'],
    description: 'Five-story red and pink sandstone palace with 953 jharokhas (casements) designed like Krishna’s crown.'
  },
  {
    name: 'City Palace & Lake Pichola',
    city: 'Udaipur',
    state: 'Rajasthan',
    coordinates: { lat: 24.5764, lng: 73.6835 },
    category: 'palace',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 92000,
    rating: 4.8,
    tags: ['palace', 'lake', 'heritage', 'romantic', 'must_visit'],
    description: 'Grand palace complex situated on the east bank of Lake Pichola with Mewar royal architecture.'
  },
  {
    name: 'Mehrangarh Fort',
    city: 'Jodhpur',
    state: 'Rajasthan',
    coordinates: { lat: 26.2978, lng: 73.0185 },
    category: 'fort',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 75000,
    rating: 4.9,
    tags: ['fort', 'heritage', 'viewpoint', 'must_visit'],
    description: 'Imposing 15th-century fortress standing 410 feet above the Blue City of Jodhpur.'
  },

  // --- UTTAR PRADESH & NORTH ---
  {
    name: 'Taj Mahal',
    city: 'Agra',
    state: 'Uttar Pradesh',
    coordinates: { lat: 27.1751, lng: 78.0421 },
    category: 'palace',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 240000,
    rating: 4.9,
    tags: ['unesco', 'heritage', 'architecture', 'must_visit'],
    description: 'One of the Seven Wonders of the World and UNESCO World Heritage marble mausoleum on Yamuna riverbank.'
  },
  {
    name: 'Agra Fort',
    city: 'Agra',
    state: 'Uttar Pradesh',
    coordinates: { lat: 27.1795, lng: 78.0211 },
    category: 'fort',
    fameScore: 0.96,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 95000,
    rating: 4.7,
    tags: ['fort', 'unesco', 'heritage', 'must_visit'],
    description: 'UNESCO World Heritage red sandstone fortress that served as the main residence of the Mughal emperors.'
  },
  {
    name: 'Kashi Vishwanath Temple & Dashashwamedh Ghat',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    coordinates: { lat: 25.3109, lng: 83.0107 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 150000,
    rating: 4.9,
    tags: ['temple', 'spiritual', 'river', 'must_visit'],
    description: 'One of the twelve sacred Jyotirlingas on the holy banks of the Ganges, famous for the daily Ganga Aarti.'
  },
  {
    name: 'Golden Temple (Harmandir Sahib)',
    city: 'Amritsar',
    state: 'Punjab',
    coordinates: { lat: 31.62, lng: 74.8765 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 180000,
    rating: 4.9,
    tags: ['temple', 'spiritual', 'heritage', 'must_visit'],
    description: 'The preeminent spiritual and cultural center of Sikhism, coated with pure gold and surrounded by the sacred Amrit Sarovar.'
  },
  {
    name: 'Red Fort & Qutub Minar',
    city: 'Delhi',
    state: 'Delhi',
    coordinates: { lat: 28.5244, lng: 77.1855 },
    category: 'fort',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 190000,
    rating: 4.7,
    tags: ['fort', 'unesco', 'heritage', 'must_visit'],
    description: 'UNESCO World Heritage 73m victory minaret and historic Mughal fortress in the heart of Delhi.'
  },

  // --- GOA ---
  {
    name: 'Basilica of Bom Jesus & Se Cathedral',
    city: 'Old Goa',
    state: 'Goa',
    coordinates: { lat: 15.5009, lng: 73.9116 },
    category: 'temple',
    fameScore: 0.96,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 65000,
    rating: 4.7,
    tags: ['unesco', 'heritage', 'spiritual', 'must_visit'],
    description: 'UNESCO World Heritage church holding the mortal remains of St. Francis Xavier, finest Baroque architecture.'
  },
  {
    name: 'Dudhsagar Falls',
    city: 'Sanguem',
    state: 'Goa',
    coordinates: { lat: 15.3144, lng: 74.3143 },
    category: 'waterfall',
    fameScore: 0.95,
    isUNESCO: false,
    isNationalHeritage: false,
    reviews: 45000,
    rating: 4.7,
    tags: ['waterfall', 'nature', 'adventure', 'must_visit'],
    description: 'Four-tiered white cascade (Sea of Milk) on the Mandovi River along the Goa-Karnataka border.'
  },
  {
    name: 'Fort Aguada & Lighthouse',
    city: 'Candolim',
    state: 'Goa',
    coordinates: { lat: 15.492, lng: 73.7737 },
    category: 'fort',
    fameScore: 0.92,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 78000,
    rating: 4.6,
    tags: ['fort', 'beach', 'viewpoint', 'must_visit'],
    description: '17th-century Portuguese fortress and historic lighthouse overlooking Sinquerim Beach and the Arabian Sea.'
  },
  // --- ANDHRA PRADESH & TELANGANA ---
  {
    name: 'Tirupati Sri Venkateswara Temple',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    coordinates: { lat: 13.6833, lng: 79.3472 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 175000,
    rating: 4.9,
    tags: ['temple', 'spiritual', 'pilgrimage', 'must_visit'],
    description: 'The world-famous Kali Yuga pilgrimage shrine of Lord Balaji atop the Tirumala Hills.'
  },
  {
    name: 'Golconda Fort & Charminar',
    city: 'Hyderabad',
    state: 'Telangana',
    coordinates: { lat: 17.3833, lng: 78.4011 },
    category: 'fort',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 120000,
    rating: 4.7,
    tags: ['fort', 'heritage', 'monument', 'must_visit'],
    description: 'Historic diamond-trading citadel with acoustic wonders and iconic 16th-century four-minaret mosque.'
  },

  // --- ODISHA & GUJARAT ---
  {
    name: 'Konark Sun Temple',
    city: 'Konark',
    state: 'Odisha',
    coordinates: { lat: 19.8876, lng: 86.0945 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 70000,
    rating: 4.8,
    tags: ['temple', 'unesco', 'heritage', 'architecture', 'must_visit'],
    description: '13th-century UNESCO World Heritage monumental stone chariot temple dedicated to the Sun God Surya.'
  },
  {
    name: 'Statue of Unity',
    city: 'Kevadia',
    state: 'Gujarat',
    coordinates: { lat: 21.838, lng: 73.7191 },
    category: 'viewpoint',
    fameScore: 1.0,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 110000,
    rating: 4.8,
    tags: ['monument', 'viewpoint', 'must_visit'],
    description: 'World’s tallest statue (182m) dedicated to Sardar Vallabhbhai Patel overlooking the Narmada River.'
  },
  {
    name: 'Somnath Jyotirlinga Temple',
    city: 'Somnath',
    state: 'Gujarat',
    coordinates: { lat: 20.888, lng: 70.401 },
    category: 'temple',
    fameScore: 0.98,
    isUNESCO: false,
    isNationalHeritage: true,
    reviews: 95000,
    rating: 4.8,
    tags: ['temple', 'spiritual', 'pilgrimage', 'must_visit'],
    description: 'First among the twelve sacred Jyotirlinga shrines of Shiva on the shore of the Arabian Sea.'
  },

  // --- MADHYA PRADESH ---
  {
    name: 'Khajuraho Group of Monuments',
    city: 'Khajuraho',
    state: 'Madhya Pradesh',
    coordinates: { lat: 24.8318, lng: 79.9199 },
    category: 'temple',
    fameScore: 1.0,
    isUNESCO: true,
    isNationalHeritage: true,
    reviews: 48000,
    rating: 4.8,
    tags: ['temple', 'unesco', 'heritage', 'art', 'must_visit'],
    description: 'UNESCO World Heritage group of Nagara-style Hindu and Jain temples with renowned intricate sculptures.'
  }
];

/* =========================================================================
 * 2. ROUTE CORRIDOR SEGMENTATION ENGINE
 * ========================================================================= */

// Major highway corridors with intermediate hub cities across India
const HIGHWAY_CORRIDOR_SEGMENTS = {
  // Tamil Nadu Corridors
  'chennai-madurai': ['Chennai', 'Mahabalipuram', 'Chengalpattu', 'Tindivanam', 'Villupuram', 'Chidambaram', 'Kumbakonam', 'Thanjavur', 'Tiruchirappalli', 'Dindigul', 'Madurai'],
  'chennai-kanyakumari': ['Chennai', 'Mahabalipuram', 'Pondicherry', 'Cuddalore', 'Chidambaram', 'Kumbakonam', 'Thanjavur', 'Tiruchirappalli', 'Madurai', 'Tirunelveli', 'Kanyakumari'],
  'chennai-rameswaram': ['Chennai', 'Mahabalipuram', 'Pondicherry', 'Chidambaram', 'Kumbakonam', 'Thanjavur', 'Pudukkottai', 'Karaikudi', 'Ramanathapuram', 'Rameswaram'],
  'bangalore-madurai': ['Bangalore', 'Hosur', 'Krishnagiri', 'Dharmapuri', 'Salem', 'Namakkal', 'Karur', 'Dindigul', 'Madurai'],
  'bangalore-kanyakumari': ['Bangalore', 'Salem', 'Dindigul', 'Madurai', 'Virudhunagar', 'Tirunelveli', 'Kanyakumari'],
  'coimbatore-madurai': ['Coimbatore', 'Pollachi', 'Palani', 'Dindigul', 'Madurai'],

  // Western & Southern Corridors
  'mumbai-goa': ['Mumbai', 'Panvel', 'Lonavala', 'Pune', 'Satara', 'Karad', 'Kolhapur', 'Belgaum', 'Goa'],
  'bangalore-goa': ['Bangalore', 'Tumkur', 'Chitradurga', 'Davangere', 'Hubballi', 'Dharwad', 'Goa'],
  'bangalore-mysore-coorg': ['Bangalore', 'Ramanagara', 'Mandya', 'Srirangapatna', 'Mysore', 'Hunsur', 'Madikeri', 'Coorg'],
  'kochi-munnar-thekkady': ['Kochi', 'Aluva', 'Kothamangalam', 'Adimali', 'Munnar', 'Nedumkandam', 'Thekkady', 'Kumily'],
  'trivandrum-alleppey-kochi': ['Thiruvananthapuram', 'Varkala', 'Kollam', 'Alleppey', 'Mararikulam', 'Kochi'],

  // Northern & Golden Triangle Corridors
  'delhi-agra-jaipur': ['Delhi', 'Mathura', 'Vrindavan', 'Agra', 'Fatehpur Sikri', 'Bharatpur', 'Dausa', 'Jaipur'],
  'delhi-jaipur-udaipur': ['Delhi', 'Gurugram', 'Neemrana', 'Jaipur', 'Ajmer', 'Pushkar', 'Bhilwara', 'Chittorgarh', 'Udaipur'],
  'delhi-rishikesh-haridwar': ['Delhi', 'Ghaziabad', 'Meerut', 'Muzaffarnagar', 'Roorkee', 'Haridwar', 'Rishikesh'],
  'delhi-manali': ['Delhi', 'Panipat', 'Kurukshetra', 'Ambala', 'Chandigarh', 'Bilaspur', 'Mandi', 'Kullu', 'Manali'],
  'delhi-amritsar': ['Delhi', 'Panipat', 'Karnal', 'Kurukshetra', 'Ambala', 'Ludhiana', 'Jalandhar', 'Amritsar'],
  'delhi-varanasi': ['Delhi', 'Aligarh', 'Kanpur', 'Prayagraj', 'Varanasi'],
  'kolkata-darjeeling': ['Kolkata', 'Burdwan', 'Malda', 'Siliguri', 'Kurseong', 'Darjeeling']
};

/**
 * Segment a route into logical intermediate cities and checkpoints
 */
function segmentRoute(startLocation, destination, routeDistanceKm = 0) {
  const normStart = String(startLocation || '').toLowerCase().trim();
  const normDest = String(destination || '').toLowerCase().trim();
  const pairKey1 = `${normStart}-${normDest}`;
  const pairKey2 = `${normDest}-${normStart}`;

  console.log(`\n======================================================`);
  console.log(`🔍 [RouteSegmentation] Analyzing corridor: "${startLocation}" ➔ "${destination}"`);

  // Check known highway corridors
  for (const [key, segments] of Object.entries(HIGHWAY_CORRIDOR_SEGMENTS)) {
    const [kStart, kEnd] = key.split('-');
    if (
      (normStart.includes(kStart) && normDest.includes(kEnd)) ||
      (normDest.includes(kStart) && normStart.includes(kEnd)) ||
      pairKey1.includes(key) ||
      pairKey2.includes(key)
    ) {
      const activeSegments = normStart.includes(kEnd) ? [...segments].reverse() : segments;
      console.log(`📍 [RouteSegmentation] Matched corridor "${key}" with ${activeSegments.length} checkpoint cities:`);
      console.log(`   ➔ ${activeSegments.join(' ➔ ')}`);
      return activeSegments;
    }
  }

  // Fallback: Segment by origin, destination, and major intermediary hubs
  const defaultSegments = [startLocation];
  if (normStart.includes('chennai') && normDest.includes('madurai')) {
    defaultSegments.push('Tiruchirappalli', 'Dindigul');
  } else if (normStart.includes('chennai') && normDest.includes('thanjavur')) {
    defaultSegments.push('Pondicherry', 'Chidambaram', 'Kumbakonam');
  } else if (normStart.includes('mumbai') && normDest.includes('goa')) {
    defaultSegments.push('Pune', 'Satara', 'Kolhapur');
  } else if (normStart.includes('bangalore') && normDest.includes('coorg')) {
    defaultSegments.push('Srirangapatna', 'Mysore');
  } else if (normStart.includes('delhi') && normDest.includes('jaipur')) {
    defaultSegments.push('Neemrana', 'Alwar');
  } else if (normStart.includes('delhi') && normDest.includes('agra')) {
    defaultSegments.push('Mathura', 'Vrindavan');
  }

  defaultSegments.push(destination);
  console.log(`📍 [RouteSegmentation] Generated ${defaultSegments.length} segments: ${defaultSegments.join(' ➔ ')}`);
  return Array.from(new Set(defaultSegments));
}

/* =========================================================================
 * 3. MULTI-QUERY CATEGORY DISCOVERY ENGINE
 * ========================================================================= */

/**
 * Generate diverse search queries for a location based on user interests
 */
function buildSearchQueriesForLocation(locationName, userPreferences = {}) {
  const preferredActivities = String(userPreferences.activities || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const queries = [
    `famous tourist places in ${locationName}`,
    `top attractions in ${locationName}`,
    `famous temples in ${locationName}`,
    `historical places and monuments in ${locationName}`,
    `must visit places in ${locationName}`
  ];

  if (preferredActivities.some((a) => a.includes('beach') || a.includes('sea'))) {
    queries.push(`famous beaches in ${locationName}`);
  }
  if (preferredActivities.some((a) => a.includes('waterfall') || a.includes('nature'))) {
    queries.push(`famous waterfalls in ${locationName}`);
    queries.push(`best scenic viewpoints in ${locationName}`);
  }
  if (preferredActivities.some((a) => a.includes('heritage') || a.includes('fort') || a.includes('palace') || a.includes('cultural'))) {
    queries.push(`heritage forts and palaces in ${locationName}`);
    queries.push(`UNESCO heritage sites near ${locationName}`);
  }
  if (preferredActivities.some((a) => a.includes('wildlife') || a.includes('safari'))) {
    queries.push(`national parks and wildlife sanctuaries near ${locationName}`);
  }

  return Array.from(new Set(queries));
}

/* =========================================================================
 * 4. FAMOUS-PLACE VERIFICATION & IMPORTANCE SCORING
 * ========================================================================= */

/**
 * Calculate the Fame & Importance Score (0.0 to 1.0)
 * Evaluates UNESCO status, ASI monument recognition, review volume tiers, and landmark renown.
 */
function calculateFameScore(candidate) {
  const name = String(candidate.name || '').toLowerCase();
  const city = String(candidate.city || '').toLowerCase();
  const reviews = Number(candidate.reviews || candidate.userRatingsTotal || 0);
  const rating = Number(candidate.rating || 0);

  let fame = 0.3; // Base baseline

  // 1. Check known landmark heritage database
  const matchedLandmark = FAMOUS_LANDMARKS_DATABASE.find((lm) => {
    const lmName = lm.name.toLowerCase();
    return name.includes(lmName) || lmName.includes(name) || (name.includes(lm.city.toLowerCase()) && lmName.includes(name));
  });

  if (matchedLandmark) {
    fame = Math.max(fame, matchedLandmark.fameScore);
    if (matchedLandmark.isUNESCO) fame = Math.max(fame, 1.0);
    if (matchedLandmark.isNationalHeritage) fame = Math.max(fame, 0.95);
  }

  // 2. Keyword renown boost
  if (name.includes('unesco') || name.includes('world heritage')) fame = Math.max(fame, 1.0);
  if (name.includes('meenakshi') || name.includes('brihadeeswarar') || name.includes('taj mahal') || name.includes('golden temple')) fame = 1.0;
  if (name.includes('palace') || name.includes('fort') || name.includes('temple') || name.includes('cathedral')) fame = Math.max(fame, 0.75);

  // 3. Review Volume Multiplier (Sign of real world fame)
  if (reviews >= 100000) fame = Math.max(fame, 1.0);
  else if (reviews >= 50000) fame = Math.max(fame, 0.92);
  else if (reviews >= 20000) fame = Math.max(fame, 0.85);
  else if (reviews >= 8000) fame = Math.max(fame, 0.75);
  else if (reviews >= 2000) fame = Math.max(fame, 0.65);

  // 4. Rating confidence boost for world class rating
  if (rating >= 4.7 && reviews >= 5000) {
    fame = Math.min(1.0, fame + 0.1);
  }

  return Math.min(1.0, Math.max(0.1, fame));
}

/**
 * Calculate the Composite Final Place Score
 * FinalPlaceScore = 0.25*FameScore + 0.15*PopularityScore + 0.15*RatingScore + 0.20*PreferenceScore + 0.15*ProximityScore + 0.10*TimeSeasonScore
 */
function computeComprehensivePlaceScore(candidate, userPreferences = {}, routeDistanceKm = 100) {
  const fameScore = calculateFameScore(candidate);
  const rating = Number(candidate.rating || 4.2);
  const ratingScore = Math.min(1.0, Math.max(0.0, (rating - 3.0) / 2.0));
  const reviews = Number(candidate.reviews || candidate.userRatingsTotal || 500);
  const popularityScore = Math.min(1.0, Math.log10(Math.max(10, reviews)) / 5.0);

  // Preference Score
  const preferredActivities = String(userPreferences.activities || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let prefScore = 0.5;
  const category = String(candidate.category || '').toLowerCase();
  if (preferredActivities.some((act) => category.includes(act) || act.includes(category))) {
    prefScore = 0.95;
  }

  // Route Proximity Score (Tolerant towards famous places)
  const detourKm = Number(candidate.detourDistance || candidate.distanceFromRouteKm || 0);
  let proximityScore = 1.0;
  if (detourKm > 0) {
    // If famous (fame >= 0.8), allow larger detour with smaller penalty
    const maxDetourAllowed = fameScore >= 0.85 ? 60 : 30;
    proximityScore = Math.max(0.2, 1.0 - (detourKm / maxDetourAllowed) * 0.7);
  }

  // Time & Season Score
  const timeSeasonScore = candidate.seasonSuitabilityScore || 0.9;

  // Composite Formula
  const finalScore =
    0.25 * fameScore +
    0.15 * popularityScore +
    0.15 * ratingScore +
    0.20 * prefScore +
    0.15 * proximityScore +
    0.10 * timeSeasonScore;

  return {
    finalScore: Math.round(finalScore * 1000) / 1000,
    fameScore: Math.round(fameScore * 100) / 100,
    popularityScore: Math.round(popularityScore * 100) / 100,
    ratingScore: Math.round(ratingScore * 100) / 100,
    prefScore: Math.round(prefScore * 100) / 100,
    proximityScore: Math.round(proximityScore * 100) / 100,
    isMustVisit: fameScore >= 0.9 || (fameScore >= 0.85 && rating >= 4.7)
  };
}

/* =========================================================================
 * 5. CANDIDATE EXPANSION & DEDUPLICATION PIPELINE
 * ========================================================================= */

/**
 * Discover candidates across all segments of the route
 */
async function discoverAllRouteCandidates({
  startLocation = 'Chennai',
  destination = 'Madurai',
  userPreferences = {},
  maxPlaces = 40
}) {
  const segments = segmentRoute(startLocation, destination);
  const candidatesMap = new Map(); // Key: normalized name

  console.log(`\n🚀 [CandidateDiscovery] Starting multi-segment discovery across ${segments.length} regions...`);

  // Helper to add and enrich candidates
  const addCandidate = (rawPlace, sourceCity = '') => {
    if (!rawPlace || !rawPlace.name) return;
    const normKey = rawPlace.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    if (candidatesMap.has(normKey)) {
      // Merge reviews/rating if higher
      const existing = candidatesMap.get(normKey);
      if (rawPlace.userRatingsTotal > existing.reviews) {
        existing.reviews = rawPlace.userRatingsTotal;
        existing.rating = rawPlace.rating || existing.rating;
      }
      return;
    }

    const lat = rawPlace.coordinates?.lat || rawPlace.geometry?.location?.lat || rawPlace.lat || 0;
    const lng = rawPlace.coordinates?.lng || rawPlace.geometry?.location?.lng || rawPlace.lng || 0;

    const candidate = {
      placeId: rawPlace.placeId || rawPlace.place_id || `place_${normKey}`,
      name: rawPlace.name,
      city: rawPlace.city || sourceCity || destination,
      state: rawPlace.state || '',
      coordinates: { lat, lng },
      category: rawPlace.category || (rawPlace.types ? rawPlace.types[0] : 'attraction'),
      rating: Number(rawPlace.rating || 4.5),
      reviews: Number(rawPlace.reviews || rawPlace.userRatingsTotal || 1500),
      description: rawPlace.description || '',
      entryFee: Number(rawPlace.entryFee || 50),
      sourceCity
    };

    const scores = computeComprehensivePlaceScore(candidate, userPreferences);
    candidate.scores = scores;
    candidate.fameScore = scores.fameScore;
    candidate.finalScore = scores.finalScore;
    candidate.isMustVisit = scores.isMustVisit;

    candidatesMap.set(normKey, candidate);
  };

  // STEP 1: Search Landmark Database for all corridor segment cities
  for (const segmentCity of segments) {
    const normSeg = segmentCity.toLowerCase();
    const matchingLandmarks = FAMOUS_LANDMARKS_DATABASE.filter(
      (lm) =>
        lm.city.toLowerCase().includes(normSeg) ||
        normSeg.includes(lm.city.toLowerCase()) ||
        lm.name.toLowerCase().includes(normSeg)
    );

    matchingLandmarks.forEach((lm) => addCandidate(lm, segmentCity));
  }

  // STEP 2: Search built-in India Tourist Places Database
  for (const segmentCity of segments) {
    const normSeg = segmentCity.toLowerCase();
    const matches = indiaTouristPlaces.filter((p) => {
      const city = (p.city || '').toLowerCase();
      const state = (p.state || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      return city.includes(normSeg) || normSeg.includes(city) || state.includes(normSeg) || name.includes(normSeg);
    });

    matches.forEach((p) => addCandidate(p, segmentCity));
  }

  // STEP 3: If Google Places API is active, run multi-query category searches per segment
  if (hasGoogleMapsAPI()) {
    console.log(`🌐 [CandidateDiscovery] Querying Google Places API for key segments...`);
    for (const segmentCity of segments.slice(0, 5)) {
      const queries = buildSearchQueriesForLocation(segmentCity, userPreferences).slice(0, 3);
      for (const query of queries) {
        try {
          const apiPlaces = await searchPlacesByText(query);
          if (Array.isArray(apiPlaces)) {
            apiPlaces.slice(0, 6).forEach((p) => addCandidate(p, segmentCity));
          }
        } catch (err) {
          console.warn(`   ⚠️ Error querying "${query}":`, err.message);
        }
      }
    }
  }

  const allDiscovered = Array.from(candidatesMap.values());
  console.log(`📊 [CandidateDiscovery] Discovered ${allDiscovered.length} total candidates across corridor`);

  // STEP 4: Rank candidates by FinalPlaceScore
  allDiscovered.sort((a, b) => b.finalScore - a.finalScore);

  // Log top 10 ranked candidates for debugging transparency
  console.log(`\n🏆 [RankingPipeline] Top Ranked Recommendations along Route:`);
  allDiscovered.slice(0, 12).forEach((p, idx) => {
    console.log(
      `   ${idx + 1}. [${p.isMustVisit ? '⭐ MUST-VISIT' : 'RECOMMENDED'}] ${p.name} (${p.city}) — FinalScore: ${p.finalScore} (Fame: ${p.fameScore}, Rating: ${p.rating}★, Reviews: ${p.reviews})`
    );
  });

  return allDiscovered.slice(0, maxPlaces);
}

module.exports = {
  segmentRoute,
  calculateFameScore,
  computeComprehensivePlaceScore,
  discoverAllRouteCandidates,
  buildSearchQueriesForLocation,
  FAMOUS_LANDMARKS_DATABASE,
  HIGHWAY_CORRIDOR_SEGMENTS
};
