/**
 * Personal Loan Orchestrator — custom form component
 *
 * Add ONE hidden field of this type anywhere in the personal-loan-journey form
 * (Show Component OFF — it renders nothing, it's purely a hook for this script
 * to attach to). It wires up every piece of interactive business logic for the
 * journey directly in code, bypassing the Rule Editor entirely:
 *
 * - Get OTP button: mocked InitiateCustomerIdentification + wizard navigation
 * - Verify OTP button: mocked VerifyOTPAndGetDemogDetails + offer population + navigation
 * - Live EMI calculation as loanAmount/tenure change
 * - Submit button: mocked submission + acknowledgement ID + navigation
 *
 * Field IDs referenced below must match the "Name" set on each field during
 * authoring (see CAPSTONE-SETUP.md for the full field map).
 */

import { subscribe } from '../../rules/index.js';
import { navigate } from '../wizard/wizard.js';

const MOBILE_FIELD = 'mobile';
const IDENTIFIER_TYPE_FIELD = 'identifierType';
const PAN_FIELD = 'panField';
const DOB_FIELD = 'dobField';
const OTP_FIELD = 'otp';
const OFFER_AMOUNT_FIELD = 'offerAmount';
const TENURE_FIELD = 'tenure';
const RATE_FIELD = 'rateOfInterest';
const KYC_FIELD = 'kycFlag';
const LOAN_AMOUNT_FIELD = 'loanAmount';
const EMI_AMOUNT_FIELD = 'emiAmount';
const ACK_ID_FIELD = 'acknowledgementId';

const GET_OTP_BTN = 'getOtpBtn';
const VERIFY_OTP_BTN = 'verifyOtpBtn';
const PROCEED_BTN = 'proceedBtn';
const PROCEED_TO_PREVIEW_BTN = 'proceedToPreviewBtn';
const SUBMIT_BTN = 'submitBtn';

/**
 * Resolves a field's live model via the documented subscribe() API.
 * Resolves synchronously (as a microtask) since formModels[formId] already
 * exists by the time custom components decorate.
 * @param {HTMLElement} formEl
 * @param {string} formId
 * @param {string} fieldId
 * @returns {Promise<object|null>}
 */
function getFieldModel(formEl, formId, fieldId) {
  return new Promise((resolve) => {
    const fieldDiv = formEl.querySelector(`[data-id="${fieldId}"]`);
    if (!fieldDiv) {
      resolve(null);
      return;
    }
    subscribe(fieldDiv, formId, (div, fieldModel) => resolve(fieldModel));
  });
}

/**
 * Finds the clickable <button> element for a given field ID.
 * @param {HTMLElement} formEl
 * @param {string} fieldId
 * @returns {HTMLButtonElement|null}
 */
function getButtonElement(formEl, fieldId) {
  const wrapper = formEl.querySelector(`[data-id="${fieldId}"]`);
  return wrapper?.querySelector('button') || null;
}

/**
 * Standard EMI formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * @param {number} principal
 * @param {number} annualInterestRate - percentage, e.g. 10.20
 * @param {number} tenureMonths
 * @returns {number} rounded monthly EMI
 */
function calculateEMI(principal, annualInterestRate, tenureMonths) {
  const P = Number(principal);
  const r = Number(annualInterestRate) / 12 / 100;
  const n = Number(tenureMonths);
  if (!P || P <= 0 || !r || r <= 0 || !n || n <= 0) return 0;
  const onePlusRPowN = (1 + r) ** n;
  return Math.round((P * r * onePlusRPowN) / (onePlusRPowN - 1));
}

function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(String(mobile || '').trim());
}

export default async function decorate(element, fd, container, formId) {
  const formEl = element.closest('form') || document;
  const wizardPanel = formEl.querySelector('.wizard');

  const [
    mobileModel, identifierTypeModel, panModel, dobModel,
    otpModel, loanAmountModel, tenureModel, rateModel, emiAmountModel,
  ] = await Promise.all([
    getFieldModel(formEl, formId, MOBILE_FIELD),
    getFieldModel(formEl, formId, IDENTIFIER_TYPE_FIELD),
    getFieldModel(formEl, formId, PAN_FIELD),
    getFieldModel(formEl, formId, DOB_FIELD),
    getFieldModel(formEl, formId, OTP_FIELD),
    getFieldModel(formEl, formId, LOAN_AMOUNT_FIELD),
    getFieldModel(formEl, formId, TENURE_FIELD),
    getFieldModel(formEl, formId, RATE_FIELD),
    getFieldModel(formEl, formId, EMI_AMOUNT_FIELD),
  ]);

  // ---- Get OTP button: mocked InitiateCustomerIdentification ----
  const getOtpBtn = getButtonElement(formEl, GET_OTP_BTN);
  getOtpBtn?.addEventListener('click', () => {
    const mobile = mobileModel?.value;
    const identifierValue = identifierTypeModel?.value === 'DOB' ? dobModel?.value : panModel?.value;

    if (!isValidMobile(mobile) || !identifierValue) {
      // eslint-disable-next-line no-alert
      window.alert('Please enter a valid mobile number and identifier before requesting an OTP.');
      return;
    }
    if (String(mobile).endsWith('0000')) {
      // eslint-disable-next-line no-alert
      window.alert('Customer not found. Please check your mobile number.');
      return;
    }
    if (wizardPanel) navigate(wizardPanel, true);
  });

  // ---- Verify OTP button: mocked VerifyOTPAndGetDemogDetails ----
  const verifyOtpBtn = getButtonElement(formEl, VERIFY_OTP_BTN);
  verifyOtpBtn?.addEventListener('click', async () => {
    const otp = otpModel?.value;
    if (!/^\d{6}$/.test(String(otp || ''))) {
      // eslint-disable-next-line no-alert
      window.alert('Please enter a valid 6-digit OTP.');
      return;
    }
    if (otp === '000000') {
      // eslint-disable-next-line no-alert
      window.alert('Invalid OTP. Please try again.');
      return;
    }

    const offerAmountModel = await getFieldModel(formEl, formId, OFFER_AMOUNT_FIELD);
    const offerTenureModel = await getFieldModel(formEl, formId, TENURE_FIELD);
    const kycModel = await getFieldModel(formEl, formId, KYC_FIELD);

    if (offerAmountModel) offerAmountModel.value = '1000000';
    if (offerTenureModel) offerTenureModel.value = '36';
    if (rateModel) rateModel.value = '10.20';
    if (kycModel) kycModel.value = 'Y';

    if (wizardPanel) navigate(wizardPanel, true);
  });

  // ---- Proceed to EMI / Proceed to Preview: plain navigation, no business logic ----
  getButtonElement(formEl, PROCEED_BTN)?.addEventListener('click', () => {
    if (wizardPanel) navigate(wizardPanel, true);
  });
  getButtonElement(formEl, PROCEED_TO_PREVIEW_BTN)?.addEventListener('click', () => {
    if (wizardPanel) navigate(wizardPanel, true);
  });

  // ---- Live EMI calculation ----
  function recalcEMI() {
    if (!emiAmountModel) return;
    const emi = calculateEMI(loanAmountModel?.value, rateModel?.value, tenureModel?.value);
    emiAmountModel.value = emi || 0;
  }

  const loanAmountDiv = formEl.querySelector(`[data-id="${LOAN_AMOUNT_FIELD}"]`);
  const tenureDiv = formEl.querySelector(`[data-id="${TENURE_FIELD}"]`);
  if (loanAmountDiv) subscribe(loanAmountDiv, formId, recalcEMI, { listenChanges: true });
  if (tenureDiv) subscribe(tenureDiv, formId, recalcEMI, { listenChanges: true });

  // ---- Submit button: mocked loan application submission ----
  const submitBtn = getButtonElement(formEl, SUBMIT_BTN);
  submitBtn?.addEventListener('click', async () => {
    const ackModel = await getFieldModel(formEl, formId, ACK_ID_FIELD);
    if (ackModel) ackModel.value = `ACK-${Date.now()}`;
    if (wizardPanel) navigate(wizardPanel, true);
  });

  return element;
}
