/**
 * Journey State Manager
 * Manages form state across steps using sessionStorage.
 * IMPORTANT: No PII (name, mobile, PAN, DOB) is logged — only journey IDs.
 */

const JOURNEY_STATE_KEY = 'pl_journey_state';

/**
 * Retrieves the current journey state from sessionStorage.
 * @returns {object|null} The current journey state or null if not found
 */
export function getJourneyState() {
  try {
    const raw = sessionStorage.getItem(JOURNEY_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Journey] Failed to read state:', e.message);
    return null;
  }
}

/**
 * Saves the journey state to sessionStorage.
 * @param {object} state - The journey state to save
 */
export function saveJourneyState(state) {
  try {
    sessionStorage.setItem(JOURNEY_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Journey] Failed to save state:', e.message);
  }
}

/**
 * Initialises a fresh journey state with a unique journey ID.
 * @returns {object} The new journey state
 */
export function initJourneyState() {
  const state = {
    journeyId: `ACS-${Date.now()}`,
    step: 'login',
    contextParam: {
      partnerId: 'HDFCBANK',
      channelID: 'ADOBE',
      productName: 'PL',
      partnerJourneyID: `${Date.now()}`,
      bankJourneyID: '',
    },
    loginData: {}, // mobile, identifierType, identifierValue (not logged)
    customerData: {}, // demog details from OTP response
    selectedOffer: {}, // chosen offer
    emiData: {}, // calculated EMI details
    submissionResult: {}, // acknowledgementId from final submission
  };
  saveJourneyState(state);
  // eslint-disable-next-line no-console
  console.log(`[Journey] Initialised. JourneyID: ${state.journeyId}`);
  return state;
}

/**
 * Updates specific fields in the journey state.
 * @param {object} updates - Key-value pairs to merge into the current state
 * @returns {object} The updated state
 */
export function updateJourneyState(updates) {
  const current = getJourneyState() || initJourneyState();
  const updated = { ...current, ...updates };
  saveJourneyState(updated);
  return updated;
}

/**
 * Updates the contextParam with bankJourneyID from API response.
 * @param {string} bankJourneyID - The bank-assigned journey ID
 */
export function setBankJourneyId(bankJourneyID) {
  const state = getJourneyState() || initJourneyState();
  state.contextParam.bankJourneyID = bankJourneyID;
  saveJourneyState(state);
  // eslint-disable-next-line no-console
  console.log(`[Journey] BankJourneyID set: ${bankJourneyID}`);
}

/**
 * Advances the journey to the next step.
 * @param {string} nextStep - The step name to advance to
 */
export function advanceStep(nextStep) {
  const state = getJourneyState() || initJourneyState();
  const prevStep = state.step;
  state.step = nextStep;
  saveJourneyState(state);
  // eslint-disable-next-line no-console
  console.log(`[Journey] Step: ${prevStep} → ${nextStep}`);
}

/**
 * Clears the journey state (call on Thank You / completion).
 */
export function clearJourneyState() {
  sessionStorage.removeItem(JOURNEY_STATE_KEY);
  // eslint-disable-next-line no-console
  console.log('[Journey] State cleared.');
}
