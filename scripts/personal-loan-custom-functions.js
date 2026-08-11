/**
 * Custom Functions — Personal Loan Journey (Adaptive Forms Rule Editor)
 *
 * Register this file's path in the Adaptive Form's Properties panel under
 * "Custom Functions Path" (e.g. "/scripts/personal-loan-custom-functions.js").
 * Once set, every exported function below appears by name in the Rule Editor's
 * function picker and can be invoked from any rule (button click, value change, etc.).
 *
 * Design notes:
 * - Functions are synchronous and return either a primitive or a JSON string,
 *   matching the pattern used by the OOTB functions in blocks/form/rules/functions.js
 *   (see toObject() there for parsing JSON strings back into objects in a rule).
 * - Tier 1: all APIs are MOCKED (happy path + one failure scenario), per the capstone.
 * - No PII is logged — only journey/response codes.
 */

/**
 * Standard EMI formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * @param {number} principal - Loan amount (P)
 * @param {number} annualInterestRate - Annual interest rate as a percentage (e.g. 10.20)
 * @param {number} tenureMonths - Loan tenure in months (n)
 * @returns {number} Monthly EMI, rounded to the nearest rupee
 */
export function calculateEMI(principal, annualInterestRate, tenureMonths) {
  const P = Number(principal);
  const r = Number(annualInterestRate) / 12 / 100;
  const n = Number(tenureMonths);
  if (!P || P <= 0 || !r || r <= 0 || !n || n <= 0) return 0;

  const onePlusRPowN = (1 + r) ** n;
  const emi = (P * r * onePlusRPowN) / (onePlusRPowN - 1);
  return Math.round(emi);
}

/**
 * Total amount payable over the loan tenure.
 * @param {number} emi - Monthly EMI
 * @param {number} tenureMonths - Loan tenure in months
 * @returns {number} Total payable
 */
export function calculateTotalPayable(emi, tenureMonths) {
  return Math.round(Number(emi) * Number(tenureMonths));
}

/**
 * Mocked InitiateCustomerIdentification API.
 * Failure scenario: mobile numbers ending in "0000" simulate "customer not found".
 * @param {string} mobileNo
 * @param {string} identifierName - "PAN_NO" | "DOB"
 * @param {string} identifierValue
 * @returns {string} JSON string: { success, offerAvailable, existingCustomer, errorDesc }
 */
export function initiateCustomerIdentification(mobileNo, identifierName, identifierValue) {
  if (!mobileNo || !identifierValue) {
    return JSON.stringify({ success: false, errorDesc: 'Mobile number and identifier are required.' });
  }
  if (String(mobileNo).endsWith('0000')) {
    return JSON.stringify({ success: false, errorDesc: 'Customer not found.' });
  }
  return JSON.stringify({
    success: true,
    offerAvailable: 'Y',
    existingCustomer: 'Y',
  });
}

/**
 * Mocked VerifyOTPAndGetDemogDetails API.
 * Failure scenario: OTP "000000" simulates an invalid OTP.
 * @param {string} otp - 6-digit OTP entered by the user
 * @returns {string} JSON string with customer + offer details, or an error
 */
export function verifyOTPAndGetDemogDetails(otp) {
  if (!/^\d{6}$/.test(String(otp || ''))) {
    return JSON.stringify({ success: false, errorDesc: 'Please enter a valid 6-digit OTP.' });
  }
  if (otp === '000000') {
    return JSON.stringify({ success: false, errorDesc: 'Invalid OTP. Please try again.' });
  }
  return JSON.stringify({
    success: true,
    customerFirstName: 'Ankit',
    customerLastName: 'Shah',
    customerCity: 'Mumbai',
    customerState: 'Maharashtra',
    offerType: 'LG_HNW_PL_PQ_NB_FEB22',
    offerAmount: '1000000.00',
    tenure: '36',
    rateOfInterest: '10.20',
    kycFlag: 'Y',
  });
}

/**
 * Mocked loan application submission.
 * @param {string} loanAmount
 * @param {string} tenure
 * @param {string} emi
 * @returns {string} JSON string with an acknowledgementId
 */
export function submitLoanApplication(loanAmount, tenure, emi) {
  if (!loanAmount || !tenure || !emi) {
    return JSON.stringify({ success: false, errorDesc: 'Missing loan details. Please review your application.' });
  }
  return JSON.stringify({
    success: true,
    acknowledgementId: `ACK-${Date.now()}`,
  });
}
