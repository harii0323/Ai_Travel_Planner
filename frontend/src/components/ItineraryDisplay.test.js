import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ItineraryDisplay from './ItineraryDisplay';

// Mock canvas-confetti
jest.mock('canvas-confetti', () => () => {});

// Mock RouteMap and PlaceDetailModal
jest.mock('./RouteMap', () => () => <div data-testid="route-map-mock">RouteMap</div>);
jest.mock('./PlaceDetailModal', () => () => <div data-testid="place-detail-modal-mock">Modal</div>);

const mockBackendItinerary = {
  success: true,
  summary: {
    destination: 'Goa',
    startLocation: 'Mumbai',
    startDate: '2026-10-10',
    endDate: '2026-10-13',
    totalDays: 3,
    originalBudget: 25000,
    withinBudget: true
  },
  details: {
    startLocation: 'Mumbai',
    accommodationType: 'Boutique Resort',
    transportMode: 'car',
    preferredActivities: 'beaches, water sports'
  },
  estimatedCosts: {
    total: 21500,
    accommodation: 8000,
    fuel: 4500,
    food: 5000
  },
  costBreakdown: {
    fuel: 4500,
    tolls: 1200,
    accommodation: 8000,
    food: 5000,
    localTransport: 800,
    entryFees: 500,
    activities: 1500,
    parking: 0,
    emergencyBuffer: 1000,
    grandTotal: 22500,
    outboundTotal: 3000,
    destinationTotal: 16500,
    returnTotal: 3000
  },
  dayPlans: [
    {
      day: 1,
      phase: 'Outbound',
      date: '10 Oct 2026',
      totalDayCost: 4500,
      activities: [
        { time: '08:00 AM', name: 'Start from Mumbai', cost: 0 },
        { time: '01:00 PM', name: 'Lunch Stop', cost: 600 }
      ]
    },
    {
      day: 2,
      phase: 'Destination',
      date: '11 Oct 2026',
      totalDayCost: 9000,
      activities: [
        { time: '09:00 AM', name: 'Calangute Beach', cost: 500 }
      ]
    }
  ],
  transportation: {
    mode: 'car',
    isEV: false
  },
  spatiotemporalOptimization: {
    activeItineraryMode: 'BALANCED',
    paretoFrontier: [
      {
        mode: 'BALANCED',
        title: 'Balanced Optimization',
        objectives: {
          experienceScore: 4.2,
          totalDetourKm: 12,
          routeEfficiencyScore: 92,
          totalCost: 22500,
          timeWindowPrecision: 1
        }
      }
    ],
    validationChecklist: [
      { rule: 'Constraint 1', passed: true, details: 'OK' }
    ],
    returnRoutePlan: {
      routeOverlapRatio: '25%',
      novelExperienceCoverage: '85%',
      asymmetricReturnSummary: 'Scenic coastal return path',
      scheduledReturnStops: [{ name: 'Ratnagiri' }]
    }
  }
};

describe('ItineraryDisplay Component', () => {
  test('renders timeline tab without crashing and displays itinerary summary', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="timeline"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );
    expect(html).toContain('Goa');
    expect(html).toContain('Mumbai');
  });

  test('renders Costs tab and verifies accommodationType renders without ReferenceError', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="costs"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );

    // Verify Accommodations & Stays card is rendered with the accommodationType
    expect(html).toContain('Accommodations &amp; Stays');
    expect(html).toContain('Boutique Resort');
  });

  test('renders Spatiotemporal Optimizer tab and verifies paretoFrontier renders without ReferenceError', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="spatiotemporal"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );

    expect(html).toContain('Pareto');
  });

  test('renders Route Map tab (route) without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="route"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );
    expect(html).toContain('RouteMap');
  });

  test('renders Coverage tab without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="coverage"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );
    expect(html).toBeDefined();
  });

  test('renders Diversity tab without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="diversity"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );
    expect(html).toBeDefined();
  });

  test('renders Overview tab without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="overview"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );
    expect(html).toBeDefined();
  });

  test('renders Recommendations tab without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={mockBackendItinerary} 
        details={mockBackendItinerary.details}
        initialTab="recommendations"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );
    expect(html).toBeDefined();
  });

  test('safely handles legacy itinerary without details object (fallback resilience in costs tab)', () => {
    const legacyItinerary = {
      destination: 'Manali',
      startLocation: 'Delhi',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      budget: 15000,
      estimatedCost: 14000,
      accommodation: 'Hostel',
      transport: 'bus',
      activities: ['trekking', 'sightseeing'],
      dayPlans: []
    };

    const html = ReactDOMServer.renderToString(
      <ItineraryDisplay 
        data={legacyItinerary} 
        initialTab="costs"
        addToast={() => {}} 
        onEditAnother={() => {}} 
      />
    );

    expect(html).toContain('Accommodations &amp; Stays');
    expect(html).toContain('Hostel');
  });
});

