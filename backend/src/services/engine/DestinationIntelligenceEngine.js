/**
 * DestinationIntelligenceEngine
 * 
 * Module 15 of VISTA AI Travel Optimization Engine.
 * (Prompt Section 13)
 * 
 * Responsibilities:
 * - Provides multi-region destination intelligence across India.
 * - Manages geographic clusters, sub-zones, seasonal weather profiles, and cultural/operational guidelines.
 * - Detects monsoon months (June-August in Western Ghats, July-August in Himalayas), peak winter seasons, and hot summer months.
 * - Maintains cultural guidelines (South Indian temple dress codes, midday sanctum closures, darshan wait times).
 * - Identifies road restrictions, wildlife sanctuary gates, and forest night curfews.
 */

const DESTINATION_INTELLIGENCE_CATALOG = {
  kerala: {
    regionName: 'Kerala (God\'s Own Country)',
    state: 'Kerala',
    centerCoordinates: { lat: 10.0889, lng: 77.0595 },
    climate: {
      monsoonMonths: [6, 7, 8],
      pleasantMonths: [10, 11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'central_kerala_temple_circuit',
        name: 'Central Kerala Ancient Temple & Spiritual Circuit',
        cities: ['Thrissur', 'Guruvayur', 'Kalady', 'Ernakulam'],
        hub: 'Thrissur',
        primaryThemes: ['spiritual', 'temples', 'ancient_shrines', 'sacred_rivers']
      },
      {
        zoneKey: 'highland_peaks_and_treks',
        name: 'Munnar Highland Peaks, Rhododendron Ridges & Tea Valleys',
        cities: ['Munnar', 'Devikulam', 'Suryanelli', 'Marayoor'],
        hub: 'Munnar',
        primaryThemes: ['mountains', 'trekking', 'tea_plantations', 'peaks']
      },
      {
        zoneKey: 'coastal_beaches_and_cliffs',
        name: 'Arabian Sea Coastal Cliffs, Golden Beaches & Seaside Promenades',
        cities: ['Varkala', 'Marari', 'Cherai', 'Kovalam'],
        hub: 'Varkala',
        primaryThemes: ['beaches', 'cliffs', 'coastal', 'sunsets']
      },
      {
        zoneKey: 'backwater_lagoons_and_sunsets',
        name: 'Vembanad Backwater Lagoons, Houseboat Canals & Spice Harbors',
        cities: ['Alleppey', 'Kumarakom', 'Kochi', 'Fort Kochi'],
        hub: 'Alleppey',
        primaryThemes: ['backwaters', 'houseboat', 'colonial_heritage', 'relaxation']
      },
      {
        zoneKey: 'wilderness_safari_and_rapids',
        name: 'Periyar & Western Ghats Wilderness, Rainforest Cascades & Bamboo Rafting',
        cities: ['Thekkady', 'Athirappilly', 'Vazhachal', 'Kumily'],
        hub: 'Thekkady',
        primaryThemes: ['wildlife', 'safari', 'waterfalls', 'rainforest']
      }
    ],
    culturalRules: [
      {
        type: 'temple_dress_code',
        description: 'Traditional attire strictly required at major Kerala temples (men: dhoti/mundu without upper shirt; women: saree/salwar). Footwear strictly prohibited.'
      },
      {
        type: 'sanctum_closure',
        description: 'Main sanctum doors close for midday rest between 12:30 PM and 04:30 PM across all traditional temples.'
      }
    ]
  },

  goa: {
    regionName: 'Goa Coastal & Heritage Circuit',
    state: 'Goa',
    centerCoordinates: { lat: 15.2993, lng: 74.1240 },
    climate: {
      monsoonMonths: [6, 7, 8, 9],
      pleasantMonths: [10, 11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'north_goa_coastal',
        name: 'North Goa Coastal Forts, Sandy Coves & Water Sports',
        cities: ['Candolim', 'Calangute', 'Vagator', 'Anjuna'],
        hub: 'Candolim',
        primaryThemes: ['beaches', 'forts', 'water_sports']
      },
      {
        zoneKey: 'old_goa_panaji',
        name: 'Old Goa UNESCO Baroque Cathedrals & Fontainhas Latin Quarter',
        cities: ['Old Goa', 'Panaji', 'Ribandar'],
        hub: 'Panaji',
        primaryThemes: ['colonial_history', 'unesco', 'architecture', 'cultural']
      },
      {
        zoneKey: 'south_goa_serenity',
        name: 'South Goa Crescent Bays, Secluded Cliffs & Serene Kayaking',
        cities: ['Palolem', 'Agonda', 'Cavelossim', 'Benaulim'],
        hub: 'Palolem',
        primaryThemes: ['beaches', 'relaxation', 'kayaking', 'sunsets']
      },
      {
        zoneKey: 'western_ghats_nature',
        name: 'Mollem Jungle Waterfalls, Spice Plantations & Western Ghats Foothills',
        cities: ['Mollem', 'Ponda', 'Kulem'],
        hub: 'Ponda',
        primaryThemes: ['waterfalls', 'wildlife', 'nature', 'spice_plantations']
      }
    ]
  },

  hampi: {
    regionName: 'Hampi & Vijayanagara UNESCO Heritage Realm',
    state: 'Karnataka',
    centerCoordinates: { lat: 15.3350, lng: 76.4600 },
    climate: {
      monsoonMonths: [6, 7, 8],
      pleasantMonths: [10, 11, 12, 1, 2],
      summerMonths: [3, 4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'sacred_center',
        name: 'Hampi Sacred Center, Tungabhadra River Ghats & Monolithic Temples',
        cities: ['Hampi', 'Kamalapur'],
        hub: 'Hampi',
        primaryThemes: ['unesco', 'spiritual', 'dravidian_architecture', 'monuments']
      },
      {
        zoneKey: 'royal_center',
        name: 'Vijayanagara Royal Citadel, Zenana Enclosure & Military Bastions',
        cities: ['Kamalapur', 'Hospet'],
        hub: 'Hospet',
        primaryThemes: ['historical', 'palaces', 'citadels', 'architecture']
      },
      {
        zoneKey: 'anegundi_kishkindha',
        name: 'Anegundi Kishkindha Realm, Sanapur Boulder Reservoir & Rural Heritage',
        cities: ['Anegundi', 'Gangavathi'],
        hub: 'Anegundi',
        primaryThemes: ['bouldering', 'coracle', 'mythology', 'scenic']
      }
    ]
  },

  araku: {
    regionName: 'Araku Valley & Eastern Ghats Tribal Highlands',
    state: 'Andhra Pradesh',
    centerCoordinates: { lat: 18.3273, lng: 82.8775 },
    climate: {
      monsoonMonths: [6, 7, 8, 9],
      pleasantMonths: [10, 11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'caves_cascades',
        name: 'Subterranean Limestone Caverns & Gosthani River Cascades',
        cities: ['Borra', 'Ananthagiri'],
        hub: 'Borra',
        primaryThemes: ['caves', 'waterfalls', 'geology', 'nature']
      },
      {
        zoneKey: 'valley_highlands',
        name: 'Araku Coffee Highlands, Botanical Plantations & Tribal Folk Culture',
        cities: ['Araku Valley', 'Paderu'],
        hub: 'Araku Valley',
        primaryThemes: ['coffee', 'tribal_culture', 'gardens', 'viewpoints']
      },
      {
        zoneKey: 'coastal_corridor',
        name: 'Visakhapatnam Bay of Bengal Coastline & Maritime Heritage',
        cities: ['Visakhapatnam', 'Rishikonda', 'Bheemili'],
        hub: 'Visakhapatnam',
        primaryThemes: ['beaches', 'submarines', 'maritime', 'hilltop_vistas']
      }
    ]
  },

  srisailam: {
    regionName: 'Srisailam Jyotirlinga & Nallamala Forest Sanctuary',
    state: 'Andhra Pradesh',
    centerCoordinates: { lat: 16.0740, lng: 78.8680 },
    climate: {
      monsoonMonths: [6, 7, 8, 9],
      pleasantMonths: [10, 11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'sacred_jyotirlinga',
        name: 'Sri Bhramaramba Mallikarjuna Jyotirlinga & Shakti Peetham Complex',
        cities: ['Srisailam'],
        hub: 'Srisailam',
        primaryThemes: ['spiritual', 'jyotirlinga', 'shakti_peetham', 'darshan']
      },
      {
        zoneKey: 'dam_gorge_reservoir',
        name: 'Krishna River Gravity Dam, Deep Gorge & Ropeway Ghats',
        cities: ['Srisailam', 'Sunnipenta'],
        hub: 'Srisailam',
        primaryThemes: ['dam', 'ropeway', 'boating', 'river_gorge']
      },
      {
        zoneKey: 'forest_caves_springs',
        name: 'Nallamala Dense Forest, Akkamahadevi Caves & Sacred Spring Cascades',
        cities: ['Srisailam', 'Mannanur', 'Domalapenta'],
        hub: 'Srisailam',
        primaryThemes: ['caves', 'waterfalls', 'forest_safari', 'springs']
      }
    ]
  },

  manali: {
    regionName: 'Manali Kullu Valley & High-Altitude Himalayan Realm',
    state: 'Himachal Pradesh',
    centerCoordinates: { lat: 32.2396, lng: 77.1887 },
    climate: {
      monsoonMonths: [7, 8],
      pleasantMonths: [3, 4, 5, 9, 10],
      snowMonths: [11, 12, 1, 2]
    },
    thematicZones: [
      {
        zoneKey: 'valley_culture',
        name: 'Old Manali Ancient Pagoda Temples, Pine Cedar Forests & Hot Springs',
        cities: ['Manali', 'Vashisht', 'Old Manali'],
        hub: 'Manali',
        primaryThemes: ['spiritual', 'cedar_forest', 'hot_springs', 'heritage']
      },
      {
        zoneKey: 'snow_adventure',
        name: 'Solang Valley Adventure Glade, Rohtang Pass & Atal Highway Tunnel',
        cities: ['Solang', 'Kothi', 'Sissu'],
        hub: 'Solang',
        primaryThemes: ['adventure', 'snow_peaks', 'paragliding', 'tunnels']
      }
    ]
  },
  kanniyakumari: {
    regionName: 'Kanniyakumari (Cape Comorin & Land\'s End)',
    state: 'Tamil Nadu',
    centerCoordinates: { lat: 8.0883, lng: 77.5385 },
    climate: {
      monsoonMonths: [6, 7, 10, 11],
      pleasantMonths: [11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'tri_sea_confluence_and_spiritual',
        name: 'Triveni Sangam Cape, Rock Memorial & Sacred Shrines',
        cities: ['Kanniyakumari', 'Kanyakumari'],
        hub: 'Kanniyakumari',
        primaryThemes: ['spiritual', 'monuments', 'ocean_sunrise', 'beaches', 'tri_sea_confluence']
      },
      {
        zoneKey: 'travancore_heritage_and_coastal_forts',
        name: 'Padmanabhapuram Wooden Palace, Vattakottai Ocean Fort & Gothic Cathedrals',
        cities: ['Thuckalay', 'Padmanabhapuram', 'Nagercoil', 'Kanniyakumari'],
        hub: 'Kanniyakumari',
        primaryThemes: ['palaces', 'wooden_architecture', 'coastal_fort', 'heritage']
      },
      {
        zoneKey: 'western_ghats_aqueduct_and_waterfalls',
        name: 'Mathur Hanging Aqueduct & Thirparappu Forest Cascades',
        cities: ['Thirparappu', 'Thiruvattar', 'Kanniyakumari'],
        hub: 'Kanniyakumari',
        primaryThemes: ['waterfalls', 'aqueduct', 'nature', 'valleys']
      }
    ]
  },
  kanyakumari: {
    regionName: 'Kanniyakumari (Cape Comorin & Land\'s End)',
    state: 'Tamil Nadu',
    centerCoordinates: { lat: 8.0883, lng: 77.5385 },
    climate: {
      monsoonMonths: [6, 7, 10, 11],
      pleasantMonths: [11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'tri_sea_confluence_and_spiritual',
        name: 'Triveni Sangam Cape, Rock Memorial & Sacred Shrines',
        cities: ['Kanniyakumari', 'Kanyakumari'],
        hub: 'Kanniyakumari',
        primaryThemes: ['spiritual', 'monuments', 'ocean_sunrise', 'beaches', 'tri_sea_confluence']
      },
      {
        zoneKey: 'travancore_heritage_and_coastal_forts',
        name: 'Padmanabhapuram Wooden Palace, Vattakottai Ocean Fort & Gothic Cathedrals',
        cities: ['Thuckalay', 'Padmanabhapuram', 'Nagercoil', 'Kanniyakumari'],
        hub: 'Kanniyakumari',
        primaryThemes: ['palaces', 'wooden_architecture', 'coastal_fort', 'heritage']
      },
      {
        zoneKey: 'western_ghats_aqueduct_and_waterfalls',
        name: 'Mathur Hanging Aqueduct & Thirparappu Forest Cascades',
        cities: ['Thirparappu', 'Thiruvattar', 'Kanniyakumari'],
        hub: 'Kanniyakumari',
        primaryThemes: ['waterfalls', 'aqueduct', 'nature', 'valleys']
      }
    ]
  }
};

/**
 * Resolves destination intelligence profile for any destination query.
 */
function resolveDestinationIntelligence(destinationQuery = '') {
  const clean = String(destinationQuery || '').toLowerCase().replace(/[^a-z]/g, '');

  for (const [key, profile] of Object.entries(DESTINATION_INTELLIGENCE_CATALOG)) {
    if (clean.includes(key) || key.includes(clean)) {
      return profile;
    }
  }

  // Generic fallback
  return {
    regionName: destinationQuery,
    state: '',
    centerCoordinates: { lat: 15.0, lng: 77.0 },
    climate: {
      monsoonMonths: [6, 7, 8],
      pleasantMonths: [10, 11, 12, 1, 2, 3],
      summerMonths: [4, 5]
    },
    thematicZones: [
      {
        zoneKey: 'general_exploration',
        name: `${destinationQuery} Highlights & Experiences`,
        cities: [destinationQuery],
        hub: destinationQuery,
        primaryThemes: ['sightseeing', 'heritage', 'scenic']
      }
    ]
  };
}

module.exports = {
  DESTINATION_INTELLIGENCE_CATALOG,
  resolveDestinationIntelligence
};

