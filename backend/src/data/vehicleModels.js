/**
 * Indian Vehicle Catalog Database
 * Includes popular models across Petrol, Diesel, CNG, and EV categories with realistic mileage and specs.
 */

const VEHICLE_CATALOG = [
  // --- PETROL ---
  {
    id: 'maruti-swift-petrol',
    name: 'Maruti Suzuki Swift',
    category: 'Hatchback',
    fuelType: 'petrol',
    mileage: 22.4, // km/L
    fuelTankCapacity: 37,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'maruti-baleno-petrol',
    name: 'Maruti Suzuki Baleno',
    category: 'Hatchback',
    fuelType: 'petrol',
    mileage: 22.3,
    fuelTankCapacity: 37,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'hyundai-i20-petrol',
    name: 'Hyundai i20',
    category: 'Hatchback',
    fuelType: 'petrol',
    mileage: 16.0,
    fuelTankCapacity: 37,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'hyundai-creta-petrol',
    name: 'Hyundai Creta (Petrol)',
    category: 'Mid-SUV',
    fuelType: 'petrol',
    mileage: 14.5,
    fuelTankCapacity: 50,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'honda-city-petrol',
    name: 'Honda City',
    category: 'Sedan',
    fuelType: 'petrol',
    mileage: 17.8,
    fuelTankCapacity: 40,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'kia-seltos-petrol',
    name: 'Kia Seltos (Petrol)',
    category: 'Mid-SUV',
    fuelType: 'petrol',
    mileage: 14.2,
    fuelTankCapacity: 50,
    seatingCapacity: 5,
    tollCategory: 'car'
  },

  // --- DIESEL ---
  {
    id: 'toyota-innova-crysta-diesel',
    name: 'Toyota Innova Crysta (Diesel)',
    category: 'MUV',
    fuelType: 'diesel',
    mileage: 13.5,
    fuelTankCapacity: 55,
    seatingCapacity: 7,
    tollCategory: 'car'
  },
  {
    id: 'toyota-fortuner-diesel',
    name: 'Toyota Fortuner (Diesel)',
    category: 'Full-SUV',
    fuelType: 'diesel',
    mileage: 10.5,
    fuelTankCapacity: 80,
    seatingCapacity: 7,
    tollCategory: 'car'
  },
  {
    id: 'mahindra-scorpio-n-diesel',
    name: 'Mahindra Scorpio-N (Diesel)',
    category: 'SUV',
    fuelType: 'diesel',
    mileage: 14.0,
    fuelTankCapacity: 57,
    seatingCapacity: 7,
    tollCategory: 'car'
  },
  {
    id: 'hyundai-creta-diesel',
    name: 'Hyundai Creta (Diesel)',
    category: 'Mid-SUV',
    fuelType: 'diesel',
    mileage: 19.1,
    fuelTankCapacity: 50,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'tata-harrier-diesel',
    name: 'Tata Harrier (Diesel)',
    category: 'Mid-SUV',
    fuelType: 'diesel',
    mileage: 16.3,
    fuelTankCapacity: 50,
    seatingCapacity: 5,
    tollCategory: 'car'
  },

  // --- CNG ---
  {
    id: 'maruti-ertiga-cng',
    name: 'Maruti Suzuki Ertiga (CNG)',
    category: 'MUV',
    fuelType: 'cng',
    mileage: 26.1, // km/kg
    fuelTankCapacity: 60, // water equivalent litres ~ 9-10 kg
    seatingCapacity: 7,
    tollCategory: 'car'
  },
  {
    id: 'maruti-wagonr-cng',
    name: 'Maruti Suzuki WagonR (CNG)',
    category: 'Hatchback',
    fuelType: 'cng',
    mileage: 34.0, // km/kg
    fuelTankCapacity: 60,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'hyundai-aura-cng',
    name: 'Hyundai Aura (CNG)',
    category: 'Sedan',
    fuelType: 'cng',
    mileage: 28.0,
    fuelTankCapacity: 65,
    seatingCapacity: 5,
    tollCategory: 'car'
  },

  // --- ELECTRIC (EV) ---
  {
    id: 'tata-nexon-ev',
    name: 'Tata Nexon EV Long Range',
    category: 'EV-SUV',
    fuelType: 'electric',
    mileage: 6.2, // km per kWh (approx 16 kWh / 100 km)
    realWorldRangeKm: 310,
    batteryCapacityKwh: 45,
    fastChargingTimeMinutes: 56, // 10-80% at 50 kW
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'tata-punch-ev',
    name: 'Tata Punch EV',
    category: 'Compact EV',
    fuelType: 'electric',
    mileage: 6.8, // km per kWh
    realWorldRangeKm: 270,
    batteryCapacityKwh: 35,
    fastChargingTimeMinutes: 56,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'mg-zs-ev',
    name: 'MG ZS EV',
    category: 'EV-SUV',
    fuelType: 'electric',
    mileage: 6.0,
    realWorldRangeKm: 340,
    batteryCapacityKwh: 50.3,
    fastChargingTimeMinutes: 50,
    seatingCapacity: 5,
    tollCategory: 'car'
  },
  {
    id: 'byd-atto3',
    name: 'BYD Atto 3',
    category: 'EV-SUV',
    fuelType: 'electric',
    mileage: 6.5,
    realWorldRangeKm: 410,
    batteryCapacityKwh: 60.48,
    fastChargingTimeMinutes: 50,
    seatingCapacity: 5,
    tollCategory: 'car'
  },

  // --- TWO WHEELERS (BIKES) ---
  {
    id: 'royal-enfield-classic-350',
    name: 'Royal Enfield Classic 350',
    category: 'Cruiser Bike',
    fuelType: 'petrol',
    mileage: 35.0,
    fuelTankCapacity: 13,
    seatingCapacity: 2,
    tollCategory: 'bike'
  },
  {
    id: 'hero-splendor-plus',
    name: 'Hero Splendor Plus',
    category: 'Commuter Bike',
    fuelType: 'petrol',
    mileage: 65.0,
    fuelTankCapacity: 9.8,
    seatingCapacity: 2,
    tollCategory: 'bike'
  },
  {
    id: 'ola-s1-pro-ev',
    name: 'Ola S1 Pro (EV Scooter)',
    category: 'EV Scooter',
    fuelType: 'electric',
    mileage: 35.0, // km per kWh (4 kWh battery -> ~140 km range)
    realWorldRangeKm: 140,
    batteryCapacityKwh: 4,
    fastChargingTimeMinutes: 40,
    seatingCapacity: 2,
    tollCategory: 'bike'
  }
];

function getVehicleById(id) {
  if (!id) return null;
  return VEHICLE_CATALOG.find(v => v.id === id || v.name.toLowerCase() === id.toLowerCase()) || null;
}

module.exports = {
  VEHICLE_CATALOG,
  getVehicleById
};

