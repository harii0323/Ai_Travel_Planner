import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ItineraryForm from './ItineraryForm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock api
jest.mock('../api', () => ({
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} }))
}));

describe('ItineraryForm Component', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  test('does not auto-submit when advancing to step 4 (Group & Budget)', async () => {
    const handleSubmit = jest.fn();

    act(() => {
      root.render(
        <ItineraryForm
          onSubmit={handleSubmit}
          initialPreset={{
            startLocation: 'Hyderabad',
            destination: 'Goa',
            startDate: new Date(Date.now() + 86400000 * 2),
            endDate: new Date(Date.now() + 86400000 * 5)
          }}
        />
      );
    });

    // Step 1 -> Click Continue
    const continueBtn1 = container.querySelector('button.btn-primary');
    expect(continueBtn1.textContent).toContain('Continue');
    act(() => {
      continueBtn1.click();
    });

    // Step 2 -> Click Continue
    const continueBtn2 = container.querySelector('button.btn-primary');
    expect(continueBtn2.textContent).toContain('Continue');
    act(() => {
      continueBtn2.click();
    });

    // Step 3 -> Click Continue to advance to Step 4 (Group & Budget)
    const continueBtn3 = container.querySelector('button.btn-primary');
    expect(continueBtn3.textContent).toContain('Continue');
    act(() => {
      continueBtn3.click();
    });

    // Verify we are now on Step 4
    expect(container.textContent).toContain('Companions & Budget');
    expect(container.textContent).toContain('Who are you traveling with?');

    // Verify it did NOT automatically trigger onSubmit
    expect(handleSubmit).not.toHaveBeenCalled();

    // Verify the Plan Itinerary button is present and not submitted
    const planBtn = container.querySelector('button.btn-generate-big');
    expect(planBtn).not.toBeNull();
    expect(planBtn.textContent).toContain('Plan Itinerary');
  });

  test('requires companion type to be fixed before plan submission', async () => {
    const handleSubmit = jest.fn();

    act(() => {
      root.render(
        <ItineraryForm
          onSubmit={handleSubmit}
          initialPreset={{
            startLocation: 'Bangalore',
            destination: 'Coorg',
            companion: ''
          }}
        />
      );
    });

    // Advance through steps to Step 4
    act(() => {
      container.querySelector('button.btn-primary').click();
    });
    act(() => {
      container.querySelector('button.btn-primary').click();
    });
    act(() => {
      container.querySelector('button.btn-primary').click();
    });

    expect(container.textContent).toContain('Companions & Budget');

    // Click Plan Itinerary without selecting companion type
    const planBtn = container.querySelector('button.btn-generate-big');
    act(() => {
      planBtn.click();
    });

    // Should show error and NOT submit
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Please select your companion type');

    // User fixes companion type: click Couple Trip
    const optionCards = Array.from(container.querySelectorAll('.option-select-card'));
    const coupleCard = optionCards.find((c) => c.textContent.includes('Couple Trip'));
    expect(coupleCard).toBeDefined();

    act(() => {
      coupleCard.click();
    });

    // Error message should disappear
    expect(container.textContent).not.toContain('Please select your companion type');

    // Now click Plan Itinerary
    await act(async () => {
      planBtn.click();
    });

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        travelCompanionType: 'couple',
        budget: expect.any(String)
      })
    );
  });
});
