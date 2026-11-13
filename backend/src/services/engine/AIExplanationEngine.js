/**
 * AIExplanationEngine
 * 
 * Module 13 of VISTA AI Travel Optimization Engine.
 * 
 * Responsibilities:
 * - Generates clear, human-understandable explanations for why specific destinations,
 *   attractions, and routes were selected.
 * - Integrates Gemini Generative AI API when GEMINI_API_KEY is present and reachable.
 * - Provides high-quality deterministic natural-language reasoning when offline or unconfigured.
 * - Strictly grounds explanations in actual calculated data without hallucination.
 */

const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || '';

/**
 * Generates an intelligent, transparent explanation of the generated travel plan.
 */
async function generateItineraryExplanation({
  userProfile,
  routeInfo,
  dayPlans = [],
  budgetSummary = {}
}) {
  const topInterests = Object.entries(userProfile.normalizedInterests || {})
    .filter(([_, w]) => w >= 0.70)
    .sort((a, b) => b[1] - a[1])
    .map(([dim]) => dim);

  const interestStr = topInterests.length > 0
    ? topInterests.join(', ')
    : 'balanced sightseeing and relaxation';

  const stopNames = dayPlans.flatMap(d => (d.stops || []).map(s => s.name)).slice(0, 5);

  // 1. Try Gemini API if GEMINI_API_KEY is configured
  const apiKey = GEMINI_API_KEY();
  if (apiKey) {
    try {
      const prompt = `You are VISTA's Lead Travel Architect. Write a concise, engaging 2-3 sentence summary explaining how this personalized itinerary from ${userProfile.origin} to ${userProfile.destination} was optimized.
Traveler Type: ${userProfile.travelCompanionType} (${userProfile.numberOfTravelers} travelers).
Top Interests: ${interestStr}.
Key Attractions Selected: ${stopNames.join(', ')}.
Total Distance: ${routeInfo.totalDistanceKm} km.
Pace: ${userProfile.travelPace}.
Budget Status: ${budgetSummary.budgetStatus}.
Do not invent unverified places or fake numbers. Focus on why these destinations match their specific preferences and why the route is practical.`;

      const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 250, temperature: 0.3 }
        },
        { timeout: 4000 }
      );

      const aiText = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiText && aiText.trim()) {
        return {
          source: 'gemini_generative_ai',
          text: aiText.trim()
        };
      }
    } catch (err) {
      // Clean fallback on network/quota issues
    }
  }

  // 2. High-quality deterministic explanation grounded in validated itinerary facts
  let explanationText = `This customized ${userProfile.totalDays}-day journey from ${userProfile.origin} to ${userProfile.destination} was dynamically formulated around your preference for ${interestStr}. `;

  if (userProfile.travelCompanionType === 'family') {
    explanationText += `Designed for a family group of ${userProfile.numberOfTravelers}, the schedule balances accessibility, gentle pacing, and all-ages attractions with comfortable highway transit. `;
  } else if (userProfile.travelCompanionType === 'friends') {
    explanationText += `Tailored for a squad of friends, the itinerary maximizes vibrant experiences, panoramic scenic vistas, and road-trip camaraderie. `;
  } else if (userProfile.travelCompanionType === 'couple') {
    explanationText += `Crafted for a couple, the plan prioritizes picturesque sunset points, atmospheric local dining, and serene coastal or mountain retreats. `;
  } else {
    explanationText += `Optimized for solo exploration with flexible pacing and authentic cultural immersion. `;
  }

  if (stopNames.length > 0) {
    explanationText += `Top recommended attractions include ${stopNames.join(', ')}, sequentially scheduled to eliminate backtracking along the ${routeInfo.totalDistanceKm} km corridor. `;
  }

  if (budgetSummary.isOverBudget) {
    explanationText += `Estimated costs total ₹${budgetSummary.totalEstimatedCost.toLocaleString('en-IN')}, slightly exceeding your budget constraint of ₹${userProfile.totalBudget.toLocaleString('en-IN')}; review our cost-optimization recommendations below to bridge this gap.`;
  } else {
    explanationText += `Total estimated expenditure is ₹${budgetSummary.totalEstimatedCost.toLocaleString('en-IN')}, keeping your trip comfortably within your budget buffer.`;
  }

  return {
    source: 'vista_preference_explanation_engine',
    text: explanationText
  };
}

module.exports = {
  generateItineraryExplanation
};

