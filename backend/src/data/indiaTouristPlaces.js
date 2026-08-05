const indiaTouristPlaces = [
  {
    name: 'Taj Mahal',
    city: 'Agra',
    state: 'Uttar Pradesh',
    region: 'North India',
    coordinates: { lat: 27.1751, lng: 78.0421 },
    categories: ['heritage', 'architecture', 'romantic', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Cool, dry weather is better for walking around the monument.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Jaipur City Palace',
    city: 'Jaipur',
    state: 'Rajasthan',
    region: 'North India',
    coordinates: { lat: 26.9258, lng: 75.8237 },
    categories: ['heritage', 'palace', 'culture', 'shopping'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Pleasant weather for forts, markets, and palace visits.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Udaipur Lake Pichola',
    city: 'Udaipur',
    state: 'Rajasthan',
    region: 'North India',
    coordinates: { lat: 24.5760, lng: 73.6833 },
    categories: ['lake', 'palace', 'romantic', 'heritage'],
    bestTimeToVisit: {
      months: ['September', 'October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Post-monsoon and winter',
      reason: 'Lakes are scenic after monsoon and the weather stays comfortable.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Jaisalmer Fort',
    city: 'Jaisalmer',
    state: 'Rajasthan',
    region: 'North India',
    coordinates: { lat: 26.9124, lng: 70.9126 },
    categories: ['desert', 'heritage', 'fort', 'adventure'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Desert activities are safer and more comfortable outside peak summer.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Varanasi Ghats',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    region: 'North India',
    coordinates: { lat: 25.3176, lng: 82.9739 },
    categories: ['spiritual', 'culture', 'river', 'heritage'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Morning boat rides and evening aarti are easier in cooler weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Golden Temple',
    city: 'Amritsar',
    state: 'Punjab',
    region: 'North India',
    coordinates: { lat: 31.6200, lng: 74.8765 },
    categories: ['spiritual', 'heritage', 'food', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Comfortable temperatures for temple visits and local food walks.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Shimla Mall Road',
    city: 'Shimla',
    state: 'Himachal Pradesh',
    region: 'North India',
    coordinates: { lat: 31.1048, lng: 77.1734 },
    categories: ['hill-station', 'shopping', 'nature', 'family'],
    bestTimeToVisit: {
      months: ['March', 'April', 'May', 'June', 'December', 'January'],
      season: 'Summer and winter',
      reason: 'Summer is good for views; winter is popular for snow nearby.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Manali Solang Valley',
    city: 'Manali',
    state: 'Himachal Pradesh',
    region: 'North India',
    coordinates: { lat: 32.2432, lng: 77.1892 },
    categories: ['hill-station', 'adventure', 'snow', 'nature'],
    bestTimeToVisit: {
      months: ['March', 'April', 'May', 'June', 'October', 'November', 'December', 'January'],
      season: 'Summer and winter',
      reason: 'Summer supports trekking and rafting; winter supports snow activities.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['bus', 'car', 'flight']
  },
  {
    name: 'Rishikesh',
    city: 'Rishikesh',
    state: 'Uttarakhand',
    region: 'North India',
    coordinates: { lat: 30.0869, lng: 78.2676 },
    categories: ['adventure', 'spiritual', 'river', 'yoga'],
    bestTimeToVisit: {
      months: ['September', 'October', 'November', 'February', 'March', 'April', 'May'],
      season: 'Autumn and spring',
      reason: 'Good weather for rafting, yoga stays, and riverside walks.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Leh Palace',
    city: 'Leh',
    state: 'Ladakh',
    region: 'North India',
    coordinates: { lat: 34.1642, lng: 77.5848 },
    categories: ['mountain', 'adventure', 'heritage', 'landscape'],
    bestTimeToVisit: {
      months: ['May', 'June', 'July', 'August', 'September'],
      season: 'Summer',
      reason: 'High-altitude roads and passes are most accessible in summer.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'car', 'bike']
  },
  {
    name: 'Dal Lake',
    city: 'Srinagar',
    state: 'Jammu and Kashmir',
    region: 'North India',
    coordinates: { lat: 34.0837, lng: 74.7973 },
    categories: ['lake', 'romantic', 'nature', 'family'],
    bestTimeToVisit: {
      months: ['April', 'May', 'June', 'September', 'October'],
      season: 'Spring and autumn',
      reason: 'Clear weather and pleasant temperatures for shikara rides.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'car', 'bus']
  },
  {
    name: 'Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    region: 'West India',
    coordinates: { lat: 18.9220, lng: 72.8347 },
    categories: ['heritage', 'city', 'sea', 'food'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Lower humidity makes city exploration more comfortable.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Goa Baga Beach',
    city: 'Baga',
    state: 'Goa',
    region: 'West India',
    coordinates: { lat: 15.5553, lng: 73.7517 },
    categories: ['beach', 'nightlife', 'water-sports', 'food'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Dry weather is ideal for beaches, nightlife, and water sports.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight', 'bike']
  },
  {
    name: 'Rann of Kutch',
    city: 'Dhordo',
    state: 'Gujarat',
    region: 'West India',
    coordinates: { lat: 23.8361, lng: 69.6630 },
    categories: ['desert', 'festival', 'culture', 'landscape'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'The white desert and festival season are best in winter.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Statue of Unity',
    city: 'Kevadia',
    state: 'Gujarat',
    region: 'West India',
    coordinates: { lat: 21.8380, lng: 73.7191 },
    categories: ['monument', 'family', 'nature', 'museum'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Outdoor viewpoints and gardens are easier to cover in mild weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Ajanta Caves',
    city: 'Aurangabad',
    state: 'Maharashtra',
    region: 'West India',
    coordinates: { lat: 20.5519, lng: 75.7033 },
    categories: ['heritage', 'caves', 'art', 'history'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Cave visits involve walking, so cooler weather helps.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Hampi',
    city: 'Hampi',
    state: 'Karnataka',
    region: 'South India',
    coordinates: { lat: 15.3350, lng: 76.4600 },
    categories: ['heritage', 'ruins', 'landscape', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'The open ruins are best explored outside peak heat.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car']
  },
  {
    name: 'Mysore Palace',
    city: 'Mysuru',
    state: 'Karnataka',
    region: 'South India',
    coordinates: { lat: 12.3052, lng: 76.6552 },
    categories: ['palace', 'heritage', 'culture', 'family'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Comfortable weather and the festive season suit palace visits.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Coorg',
    city: 'Madikeri',
    state: 'Karnataka',
    region: 'South India',
    coordinates: { lat: 12.4244, lng: 75.7382 },
    categories: ['hill-station', 'coffee', 'nature', 'romantic'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
      season: 'Post-monsoon to summer',
      reason: 'Plantations and waterfalls are scenic after rain, with cooler hill weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['bus', 'car', 'bike']
  },
  {
    name: 'Munnar',
    city: 'Munnar',
    state: 'Kerala',
    region: 'South India',
    coordinates: { lat: 10.0889, lng: 77.0595 },
    categories: ['hill-station', 'tea', 'nature', 'romantic'],
    bestTimeToVisit: {
      months: ['September', 'October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Post-monsoon and winter',
      reason: 'Tea gardens are lush and the weather is pleasant.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['bus', 'car', 'flight']
  },
  {
    name: 'Alleppey Backwaters',
    city: 'Alappuzha',
    state: 'Kerala',
    region: 'South India',
    coordinates: { lat: 9.4981, lng: 76.3388 },
    categories: ['backwaters', 'romantic', 'nature', 'family'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Houseboat weather is comfortable and rainfall is lower.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Kanyakumari',
    city: 'Kanyakumari',
    state: 'Tamil Nadu',
    region: 'South India',
    coordinates: { lat: 8.0883, lng: 77.5385 },
    categories: ['coast', 'sunrise', 'spiritual', 'family'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Clearer skies and lower heat are better for sunrise and coastal walks.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Mahabalipuram',
    city: 'Mahabalipuram',
    state: 'Tamil Nadu',
    region: 'South India',
    coordinates: { lat: 12.6269, lng: 80.1927 },
    categories: ['heritage', 'beach', 'temple', 'culture'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Coastal humidity is lower and outdoor monuments are easier to visit.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['bus', 'car', 'train', 'flight']
  },
  {
    name: 'Puducherry Promenade',
    city: 'Puducherry',
    state: 'Puducherry',
    region: 'South India',
    coordinates: { lat: 11.9139, lng: 79.8145 },
    categories: ['beach', 'heritage', 'food', 'romantic'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Pleasant weather for beaches, cafes, and heritage walks.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['bus', 'car', 'train']
  },
  {
    name: 'Charminar',
    city: 'Hyderabad',
    state: 'Telangana',
    region: 'South India',
    coordinates: { lat: 17.3616, lng: 78.4747 },
    categories: ['heritage', 'food', 'shopping', 'city'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Cooler evenings are better for markets and food streets.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Araku Valley',
    city: 'Araku',
    state: 'Andhra Pradesh',
    region: 'South India',
    coordinates: { lat: 18.3273, lng: 82.8775 },
    categories: ['hill-station', 'coffee', 'nature', 'train-journey'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Post-monsoon and winter',
      reason: 'Green valleys and mild weather make viewpoints and train journeys better.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car']
  },
  {
    name: 'Konark Sun Temple',
    city: 'Konark',
    state: 'Odisha',
    region: 'East India',
    coordinates: { lat: 19.8876, lng: 86.0945 },
    categories: ['heritage', 'temple', 'architecture', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Outdoor temple exploration is easier in cooler weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Puri Beach and Jagannath Temple',
    city: 'Puri',
    state: 'Odisha',
    region: 'East India',
    coordinates: { lat: 19.8135, lng: 85.8312 },
    categories: ['beach', 'spiritual', 'family', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Beach walks and temple visits are more comfortable after monsoon.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Victoria Memorial',
    city: 'Kolkata',
    state: 'West Bengal',
    region: 'East India',
    coordinates: { lat: 22.5448, lng: 88.3426 },
    categories: ['heritage', 'museum', 'city', 'culture'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Cooler weather is better for museum and city walks.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Darjeeling Tiger Hill',
    city: 'Darjeeling',
    state: 'West Bengal',
    region: 'East India',
    coordinates: { lat: 27.0360, lng: 88.2627 },
    categories: ['hill-station', 'tea', 'mountain', 'sunrise'],
    bestTimeToVisit: {
      months: ['March', 'April', 'May', 'October', 'November'],
      season: 'Spring and autumn',
      reason: 'Clearer mountain views and pleasant hill-station weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Kaziranga National Park',
    city: 'Kaziranga',
    state: 'Assam',
    region: 'North East India',
    coordinates: { lat: 26.5775, lng: 93.1711 },
    categories: ['wildlife', 'nature', 'safari', 'family'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February', 'March', 'April'],
      season: 'Winter and spring',
      reason: 'The park is generally accessible after monsoon and wildlife sightings improve.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'train', 'bus', 'car']
  },
  {
    name: 'Shillong',
    city: 'Shillong',
    state: 'Meghalaya',
    region: 'North East India',
    coordinates: { lat: 25.5788, lng: 91.8933 },
    categories: ['hill-station', 'waterfalls', 'music', 'nature'],
    bestTimeToVisit: {
      months: ['March', 'April', 'May', 'October', 'November'],
      season: 'Spring and autumn',
      reason: 'Good weather for waterfalls, cafes, and viewpoints.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'bus', 'car']
  },
  {
    name: 'Cherrapunji',
    city: 'Sohra',
    state: 'Meghalaya',
    region: 'North East India',
    coordinates: { lat: 25.2849, lng: 91.7246 },
    categories: ['waterfalls', 'caves', 'nature', 'trekking'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
      season: 'Post-monsoon to spring',
      reason: 'Waterfalls remain scenic and travel conditions are more manageable.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['car', 'bus', 'flight']
  },
  {
    name: 'Tawang Monastery',
    city: 'Tawang',
    state: 'Arunachal Pradesh',
    region: 'North East India',
    coordinates: { lat: 27.5861, lng: 91.8594 },
    categories: ['monastery', 'mountain', 'culture', 'landscape'],
    bestTimeToVisit: {
      months: ['March', 'April', 'May', 'September', 'October'],
      season: 'Spring and autumn',
      reason: 'Mountain roads are generally more reliable and views are clearer.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['car', 'bus', 'flight']
  },
  {
    name: 'Gangtok MG Marg',
    city: 'Gangtok',
    state: 'Sikkim',
    region: 'North East India',
    coordinates: { lat: 27.3314, lng: 88.6138 },
    categories: ['hill-station', 'culture', 'food', 'mountain'],
    bestTimeToVisit: {
      months: ['March', 'April', 'May', 'October', 'November'],
      season: 'Spring and autumn',
      reason: 'Best mix of clear views, pleasant weather, and accessible roads.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'train', 'bus', 'car']
  },
  {
    name: 'Loktak Lake',
    city: 'Moirang',
    state: 'Manipur',
    region: 'North East India',
    coordinates: { lat: 24.5590, lng: 93.7846 },
    categories: ['lake', 'nature', 'culture', 'birding'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Cooler weather is better for lake views and local exploration.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'girlsOnly'],
    recommendedTransport: ['flight', 'car', 'bus']
  },
  {
    name: 'Aizawl',
    city: 'Aizawl',
    state: 'Mizoram',
    region: 'North East India',
    coordinates: { lat: 23.7271, lng: 92.7176 },
    categories: ['hill-city', 'culture', 'viewpoints', 'food'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Cool and dry weather suits viewpoints and city walks.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'car', 'bus']
  },
  {
    name: 'Ujjain Mahakaleshwar',
    city: 'Ujjain',
    state: 'Madhya Pradesh',
    region: 'Central India',
    coordinates: { lat: 23.1828, lng: 75.7682 },
    categories: ['spiritual', 'heritage', 'culture', 'family'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Temple visits and city walks are easier in mild weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Khajuraho Temples',
    city: 'Khajuraho',
    state: 'Madhya Pradesh',
    region: 'Central India',
    coordinates: { lat: 24.8318, lng: 79.9199 },
    categories: ['heritage', 'temple', 'architecture', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Outdoor temple complexes are best explored in cool weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Pachmarhi',
    city: 'Pachmarhi',
    state: 'Madhya Pradesh',
    region: 'Central India',
    coordinates: { lat: 22.4674, lng: 78.4346 },
    categories: ['hill-station', 'waterfalls', 'nature', 'family'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
      season: 'Post-monsoon to summer',
      reason: 'Waterfalls, forests, and viewpoints are accessible and scenic.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car']
  },
  {
    name: 'Raipur and Sirpur Heritage',
    city: 'Raipur',
    state: 'Chhattisgarh',
    region: 'Central India',
    coordinates: { lat: 21.2514, lng: 81.6296 },
    categories: ['heritage', 'culture', 'food', 'family'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February'],
      season: 'Winter',
      reason: 'Lower heat makes heritage day trips easier.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Patna Sahib',
    city: 'Patna',
    state: 'Bihar',
    region: 'East India',
    coordinates: { lat: 25.5941, lng: 85.1376 },
    categories: ['spiritual', 'heritage', 'culture', 'family'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Comfortable weather for gurudwara visits and local sightseeing.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Bodh Gaya Mahabodhi Temple',
    city: 'Bodh Gaya',
    state: 'Bihar',
    region: 'East India',
    coordinates: { lat: 24.6951, lng: 84.9913 },
    categories: ['spiritual', 'heritage', 'meditation', 'culture'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March'],
      season: 'Winter',
      reason: 'Meditation and temple walks are better in mild weather.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Ranchi Waterfalls Circuit',
    city: 'Ranchi',
    state: 'Jharkhand',
    region: 'East India',
    coordinates: { lat: 23.3441, lng: 85.3096 },
    categories: ['waterfalls', 'nature', 'road-trip', 'family'],
    bestTimeToVisit: {
      months: ['August', 'September', 'October', 'November', 'December', 'January', 'February'],
      season: 'Post-monsoon and winter',
      reason: 'Waterfalls are fuller after rain and weather is cooler later.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['train', 'bus', 'car', 'flight']
  },
  {
    name: 'Port Blair Cellular Jail',
    city: 'Port Blair',
    state: 'Andaman and Nicobar Islands',
    region: 'Islands',
    coordinates: { lat: 11.6743, lng: 92.7470 },
    categories: ['island', 'heritage', 'beach', 'history'],
    bestTimeToVisit: {
      months: ['November', 'December', 'January', 'February', 'March', 'April'],
      season: 'Winter and spring',
      reason: 'Sea conditions and beach weather are usually better outside monsoon.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'boysOnly', 'girlsOnly'],
    recommendedTransport: ['flight', 'ship']
  },
  {
    name: 'Lakshadweep Agatti Island',
    city: 'Agatti',
    state: 'Lakshadweep',
    region: 'Islands',
    coordinates: { lat: 10.8576, lng: 72.1934 },
    categories: ['island', 'beach', 'water-sports', 'romantic'],
    bestTimeToVisit: {
      months: ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
      season: 'Post-monsoon to summer',
      reason: 'Better beach weather and clearer water for marine activities.'
    },
    suitableFor: ['solo', 'couple', 'friends', 'family', 'girlsOnly'],
    recommendedTransport: ['flight', 'ship']
  }
];

module.exports = indiaTouristPlaces;
