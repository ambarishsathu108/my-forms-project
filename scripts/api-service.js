/**
 * API Service Layer — Personal Loan Journey
 *
 * Tier 1: All APIs are MOCKED (happy path + one failure scenario).
 * Tier 2: Replace mock functions with real fetch() calls — no other code changes needed.
 *
 * Rules:
 * - No hardcoded URLs or credentials (use config object)
 * - No PII in logs (only journey IDs and response codes)
 * - Every function returns { success, data, errorCode, errorDesc }
 */

import { getJourneyState, setBankJourneyId } from './journey-state.js';

// ---------------------------------------------------------------------------
// Config — swap these for real endpoints in Tier 2 (no hardcoding allowed)
// ---------------------------------------------------------------------------
export const API_CONFIG = {
  // In a real project these come from environment/authoring config, never hardcoded
  baseUrl: '', // e.g. 'https://api-gateway.hdfcbank.com'
  initiateCustomerIdentification: '/api/v1/initiateCustomerIdentification',
  verifyOTPAndGetDemogDetails: '/api/v1/verifyOTPAndGetDemogDetails',
  submitLoanApplication: '/api/v1/submitLoanApplication',
  // Tier 2 additions
  panEnquiry: '/api/v1/panEnquiry',
  getBureauOffer: '/api/v1/getBureauOffer',
  generateEmailOTP: '/api/v1/generateEmailOTP',
  validateEmailOTP: '/api/v1/validateEmailOTP',
};

// ---------------------------------------------------------------------------
// Mock Data (Tier 1) — mirrors exact API response shapes from capstone doc
// ---------------------------------------------------------------------------
const MOCK_INITIATE_SUCCESS = {
  contextParam: {
    partnerID: 'HDFCBANK',
    channelID: 'ADOBE',
    productName: 'PL',
    partnerJourneyID: '160120221234567890',
    bankJourneyID: '20211601234567890',
  },
  responseString: {
    offerAvailable: 'Y',
    existingCustomer: 'Y',
  },
  status: { responseCode: '0', errorCode: '', errorDesc: '' },
};

const MOCK_OTP_SUCCESS = {
  contextParam: {
    partnerID: 'HDFCBANK',
    channelID: 'ADOBE',
    productName: 'PL',
    partnerJourneyID: '160120221234567890',
    bankJourneyID: '20211601234567890',
  },
  responseString: {
    OfferDemogDetails: [
      {
        customerFirstName: 'Ankit',
        customerMiddleName: 'Ramesh',
        customerLastName: 'Shah',
        customerAddress1: '1301, Barkha',
        customerAddress2: 'Opposite Brigh School, Village Road',
        customerAddress3: '',
        customerState: 'Maharashtra',
        customerCity: 'Mumbai',
        zipCode: '400016',
        customerCountry: 'India',
        customerGender: 'M',
        dateOfBirth: '27-02-1987',
        emailAddress: 'ankit@gmail.com',
        customerMobileNo: '98709XXXXX', // masked
        monthlyIncome: '',
        profession: '',
        residenceType: '',
        offerType: 'LG_HNW_PL_PQ_NB_FEB22',
        offerAmount: '1000000.00',
        tenure: '36',
        rateOfInterest: '10.20%',
        kycFlag: 'Y',
        custType: 'F',
        reltype: 'AUS',
        accountNumber: 'XXXXXX5015',
        customerID: 'XXXX124',
      },
    ],
  },
  status: { responseCode: '0', errorCode: '', errorDesc: '' },
};

const MOCK_SUBMIT_SUCCESS = {
  contextParam: {
    partnerID: 'HDFCBANK',
    channelID: 'ADOBE',
    productName: 'PL',
    partnerJourneyID: '123456',
    bankJourneyID: '7890123',
  },
  responseString: {
    vkycLink: '',
    acknowledgementId: `ACK-${Date.now()}`,
  },
  status: { responseCode: '0', errorCode: '', errorDesc: '' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalises every API response into a consistent shape.
 * @param {object} raw - Raw API/mock response
 * @returns {{ success: boolean, data: object, errorCode: string, errorDesc: string }}
 */
function normaliseResponse(raw) {
  const status = raw?.status || {};
  const success = status.responseCode === '0';
  return {
    success,
    data: raw,
    errorCode: status.errorCode || '',
    errorDesc: status.errorDesc || (success ? '' : 'An unexpected error occurred.'),
  };
}

/**
 * Simulates a network delay for mocked calls.
 * @param {number} ms - Milliseconds to wait
 */
function mockDelay(ms = 600) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ---------------------------------------------------------------------------
// API 1 — InitiateCustomerIdentification
// ---------------------------------------------------------------------------

/**
 * Initiates customer identification (sends OTP to mobile).
 * Tier 1: Mocked. Tier 2: Replace mock block with real fetch().
 *
 * @param {{ mobileNo: string, identifierName: string, identifierValue: string }} params
 * @returns {Promise<{ success: boolean, data: object, errorCode: string, errorDesc: string }>}
 */
export async function initiateCustomerIdentification(params) {
  const state = getJourneyState();
  // eslint-disable-next-line no-console
  console.log(`[API] initiateCustomerIdentification called. JourneyID: ${state?.journeyId}`);

  // ---- TIER 1 MOCK ----
  await mockDelay();
  // Simulate failure scenario: if mobile ends in '0000' return error
  if (params?.mobileNo?.endsWith('0000')) {
    return normaliseResponse({
      status: { responseCode: '1', errorCode: 'ERR_001', errorDesc: 'Customer not found.' },
    });
  }
  const response = normaliseResponse(MOCK_INITIATE_SUCCESS);
  if (response.success) {
    setBankJourneyId(response.data.contextParam.bankJourneyID);
  }
  // eslint-disable-next-line no-console
  console.log(`[API] initiateCustomerIdentification → responseCode: ${response.data.status.responseCode}`);
  return response;
  // ---- END MOCK — replace above block with fetch() for Tier 2 ----
}

// ---------------------------------------------------------------------------
// API 2 — VerifyOTPAndGetDemogDetails
// ---------------------------------------------------------------------------

/**
 * Verifies the OTP entered by the customer and returns demographic + offer details.
 * Tier 1: Mocked. Tier 2: Replace mock block with real fetch().
 *
 * @param {{ passwordValue: string }} params
 * @returns {Promise<{ success: boolean, data: object, errorCode: string, errorDesc: string }>}
 */
export async function verifyOTPAndGetDemogDetails(params) {
  const state = getJourneyState();
  // eslint-disable-next-line no-console
  console.log(`[API] verifyOTPAndGetDemogDetails called. JourneyID: ${state?.journeyId}`);

  // ---- TIER 1 MOCK ----
  await mockDelay();
  // Simulate failure: OTP '000000' = wrong OTP
  if (params?.passwordValue === '000000') {
    return normaliseResponse({
      status: { responseCode: '1', errorCode: 'ERR_OTP_002', errorDesc: 'Invalid OTP. Please try again.' },
    });
  }
  const response = normaliseResponse(MOCK_OTP_SUCCESS);
  // eslint-disable-next-line no-console
  console.log(`[API] verifyOTPAndGetDemogDetails → responseCode: ${response.data.status.responseCode}`);
  return response;
  // ---- END MOCK ----
}

// ---------------------------------------------------------------------------
// API 3 — Submit Loan Application
// ---------------------------------------------------------------------------

/**
 * Submits the final loan application.
 * Tier 1: Mocked. Tier 2: Replace mock block with real fetch().
 *
 * @returns {Promise<{ success: boolean, data: object, errorCode: string, errorDesc: string }>}
 */
export async function submitLoanApplication() {
  const state = getJourneyState();
  // eslint-disable-next-line no-console
  console.log(`[API] submitLoanApplication called. JourneyID: ${state?.journeyId}`);

  // ---- TIER 1 MOCK ----
  await mockDelay(800);
  // Regenerate acknowledgementId to be unique each submission
  const mockResponse = {
    ...MOCK_SUBMIT_SUCCESS,
    responseString: {
      ...MOCK_SUBMIT_SUCCESS.responseString,
      acknowledgementId: `ACK-${Date.now()}`,
    },
  };
  const response = normaliseResponse(mockResponse);
  // eslint-disable-next-line no-console
  console.log(`[API] submitLoanApplication → responseCode: ${response.data.status.responseCode}`);
  return response;
  // ---- END MOCK ----
}

// ---------------------------------------------------------------------------
// TIER 2 APIs (stubs — implement in Tier 2)
// ---------------------------------------------------------------------------

/**
 * PANEnquiry — Tier 2 only.
 */
export async function panEnquiry() {
  // eslint-disable-next-line no-console
  console.warn('[API] panEnquiry not yet implemented (Tier 2).');
  return { success: false, errorCode: 'NOT_IMPLEMENTED', errorDesc: 'PANEnquiry is a Tier 2 feature.' };
}

/**
 * GetBureauOffer (BRE2) — Tier 2 only.
 */
export async function getBureauOffer() {
  // eslint-disable-next-line no-console
  console.warn('[API] getBureauOffer not yet implemented (Tier 2).');
  return { success: false, errorCode: 'NOT_IMPLEMENTED', errorDesc: 'GetBureauOffer is a Tier 2 feature.' };
}

/**
 * Generate Email OTP — Tier 2 only.
 */
export async function generateEmailOTP() {
  // eslint-disable-next-line no-console
  console.warn('[API] generateEmailOTP not yet implemented (Tier 2).');
  return { success: false, errorCode: 'NOT_IMPLEMENTED', errorDesc: 'generateEmailOTP is a Tier 2 feature.' };
}

/**
 * Validate Email OTP — Tier 2 only.
 */
export async function validateEmailOTP() {
  // eslint-disable-next-line no-console
  console.warn('[API] validateEmailOTP not yet implemented (Tier 2).');
  return { success: false, errorCode: 'NOT_IMPLEMENTED', errorDesc: 'validateEmailOTP is a Tier 2 feature.' };
}
