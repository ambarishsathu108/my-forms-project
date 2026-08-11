/**
 * Personal Loan Journey Block
 * Orchestrates all steps: Login → OTP → Offer → EMI → Preview → Thank You
 *
 * EDS Block convention: export default function decorate(block) {}
 * The block reads authoring properties from the block's table rows in the document.
 *
 * Authoring properties (set in AEM Author / Google Doc table):
 *   - identifier-type: "DOB" | "PAN" (controls which field shows in login)
 *   - partner-id: overrides default partnerId (optional)
 */

import {
  initiateCustomerIdentification,
  verifyOTPAndGetDemogDetails,
  submitLoanApplication,
} from '../../scripts/api-service.js';

import {
  initJourneyState,
  getJourneyState,
  updateJourneyState,
  clearJourneyState,
} from '../../scripts/journey-state.js';

import {
  calculateEMI,
  formatINR,
  parseRateOfInterest,
} from '../../scripts/emi-calculator.js';

// ---------------------------------------------------------------------------
// Step definitions (progress bar config)
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 'login', label: 'Login' },
  { id: 'otp', label: 'Verify OTP' },
  { id: 'offer', label: 'Offer' },
  { id: 'emi', label: 'EMI' },
  { id: 'preview', label: 'Preview' },
  { id: 'thankyou', label: 'Done' },
];

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Reads authoring configuration from the block's table rows.
 * In EDS, authors set properties as rows in a 2-column table in the document.
 * @param {HTMLElement} block
 * @returns {object} config map
 */
function readBlockConfig(block) {
  const config = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const cols = row.querySelectorAll('div');
    if (cols.length >= 2) {
      const key = cols[0].textContent.trim().toLowerCase().replace(/\s+/g, '-');
      config[key] = cols[1].textContent.trim();
    }
  });
  return config;
}

/**
 * Sets a button into loading state (disables it, shows spinner).
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 */
function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.classList.add('pl-btn-loading');
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '';
  } else {
    btn.disabled = false;
    btn.classList.remove('pl-btn-loading');
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

/**
 * Shows an error message in the given container element.
 * @param {HTMLElement} container
 * @param {string} message
 */
function showError(container, message) {
  let el = container.querySelector('.pl-error-msg');
  if (!el) {
    el = document.createElement('div');
    el.className = 'pl-error-msg';
    container.prepend(el);
  }
  el.textContent = message;
  el.classList.remove('pl-hidden');
}

/**
 * Clears the error message in the given container.
 * @param {HTMLElement} container
 */
function clearError(container) {
  const el = container.querySelector('.pl-error-msg');
  if (el) el.classList.add('pl-hidden');
}

/**
 * Validates a 10-digit Indian mobile number.
 * @param {string} mobile
 * @returns {boolean}
 */
function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile.replace(/\s/g, ''));
}

/**
 * Validates a PAN number (format: AAAAA9999A).
 * @param {string} pan
 * @returns {boolean}
 */
function isValidPAN(pan) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

/**
 * Validates a date of birth string (DD-MM-YYYY or DD/MM/YYYY).
 * @param {string} dob
 * @returns {boolean}
 */
function isValidDOB(dob) {
  return /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(dob);
}

// ---------------------------------------------------------------------------
// Progress bar renderer
// ---------------------------------------------------------------------------
function renderProgressBar(activeStepId) {
  const activeIdx = STEPS.findIndex((s) => s.id === activeStepId);
  const wrapper = document.createElement('div');
  wrapper.className = 'pl-progress';

  STEPS.forEach((step, i) => {
    const stepEl = document.createElement('div');
    const isCompleted = i < activeIdx;
    const isActive = i === activeIdx;
    stepEl.className = `pl-progress-step${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`;

    const dot = document.createElement('div');
    dot.className = 'pl-progress-dot';
    dot.textContent = isCompleted ? '✓' : String(i + 1);

    const label = document.createElement('span');
    label.textContent = step.label;

    stepEl.append(dot, label);
    wrapper.appendChild(stepEl);

    // Add connecting line between steps (not after last)
    if (i < STEPS.length - 1) {
      const line = document.createElement('div');
      line.className = `pl-progress-line${isCompleted ? ' completed' : ''}`;
      wrapper.appendChild(line);
    }
  });

  return wrapper;
}

// ---------------------------------------------------------------------------
// STEP 1 — Login Screen
// ---------------------------------------------------------------------------
function renderLoginStep(container, config) {
  const identifierType = (config['identifier-type'] || 'PAN').toUpperCase();

  container.innerHTML = `
    <div class="pl-step">
      <div class="pl-card-header">
        <h2 class="pl-card-title">Personal Loan</h2>
        <p class="pl-card-subtitle">Check your eligibility in minutes</p>
      </div>

      <div class="pl-field">
        <label for="pl-mobile">Mobile Number <span class="required">*</span></label>
        <input
          type="tel"
          id="pl-mobile"
          class="pl-input"
          placeholder="Enter 10-digit mobile number"
          maxlength="10"
          autocomplete="tel"
          inputmode="numeric"
        />
        <div class="pl-field-error pl-hidden" id="pl-mobile-error"></div>
      </div>

      <div class="pl-toggle-group" id="pl-id-toggle">
        <label class="pl-toggle-option${identifierType === 'DOB' ? ' selected' : ''}" id="pl-dob-toggle">
          <input type="radio" name="pl-id-type" value="DOB" ${identifierType === 'DOB' ? 'checked' : ''} />
          Date of Birth
        </label>
        <label class="pl-toggle-option${identifierType === 'PAN' ? ' selected' : ''}" id="pl-pan-toggle">
          <input type="radio" name="pl-id-type" value="PAN_NO" ${identifierType === 'PAN' ? 'checked' : ''} />
          PAN Number
        </label>
      </div>

      <div class="pl-field" id="pl-dob-field" ${identifierType !== 'DOB' ? 'style="display:none"' : ''}>
        <label for="pl-dob">Date of Birth <span class="required">*</span></label>
        <input
          type="text"
          id="pl-dob"
          class="pl-input"
          placeholder="DD-MM-YYYY"
          maxlength="10"
          autocomplete="bday"
        />
        <div class="pl-field-error pl-hidden" id="pl-dob-error"></div>
      </div>

      <div class="pl-field" id="pl-pan-field" ${identifierType !== 'PAN' ? 'style="display:none"' : ''}>
        <label for="pl-pan">PAN Number <span class="required">*</span></label>
        <input
          type="text"
          id="pl-pan"
          class="pl-input"
          placeholder="ABCDE1234F"
          maxlength="10"
          autocomplete="off"
          style="text-transform:uppercase"
        />
        <div class="pl-field-error pl-hidden" id="pl-pan-error"></div>
      </div>

      <div class="pl-field" style="margin-top:8px">
        <label style="display:flex;align-items:flex-start;gap:8px;font-weight:400;cursor:pointer">
          <input type="checkbox" id="pl-consent" style="margin-top:3px;accent-color:#004c97;flex-shrink:0" />
          <span style="font-size:0.8rem;color:#6b7280">
            I consent to my details being used to check loan eligibility and agree to the
            <a href="#" style="color:#004c97">Terms &amp; Conditions</a>.
          </span>
        </label>
        <div class="pl-field-error pl-hidden" id="pl-consent-error"></div>
      </div>

      <button class="pl-btn pl-btn-primary" id="pl-login-btn" style="margin-top:8px">
        Get OTP
      </button>
    </div>
  `;

  // --- Toggle DOB / PAN visibility ---
  const dobField = container.querySelector('#pl-dob-field');
  const panField = container.querySelector('#pl-pan-field');
  const dobToggle = container.querySelector('#pl-dob-toggle');
  const panToggle = container.querySelector('#pl-pan-toggle');

  container.querySelectorAll('input[name="pl-id-type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isDOB = radio.value === 'DOB';
      dobField.style.display = isDOB ? '' : 'none';
      panField.style.display = isDOB ? 'none' : '';
      dobToggle.classList.toggle('selected', isDOB);
      panToggle.classList.toggle('selected', !isDOB);
    });
  });

  // PAN auto-uppercase
  const panInput = container.querySelector('#pl-pan');
  panInput?.addEventListener('input', () => {
    panInput.value = panInput.value.toUpperCase();
  });

  // --- Login form submission ---
  const loginBtn = container.querySelector('#pl-login-btn');
  loginBtn.addEventListener('click', async () => {
    clearError(container);

    const mobile = container.querySelector('#pl-mobile').value.trim();
    const selectedType = container.querySelector('input[name="pl-id-type"]:checked')?.value;
    const identifierValue = selectedType === 'DOB'
      ? container.querySelector('#pl-dob').value.trim()
      : container.querySelector('#pl-pan').value.trim();
    const consentChecked = container.querySelector('#pl-consent').checked;

    // --- Client-side validation ---
    let hasError = false;

    if (!isValidMobile(mobile)) {
      const el = container.querySelector('#pl-mobile-error');
      el.textContent = 'Please enter a valid 10-digit mobile number.';
      el.classList.remove('pl-hidden');
      container.querySelector('#pl-mobile').classList.add('error');
      hasError = true;
    } else {
      container.querySelector('#pl-mobile').classList.remove('error');
      container.querySelector('#pl-mobile-error').classList.add('pl-hidden');
    }

    if (selectedType === 'DOB' && !isValidDOB(identifierValue)) {
      const el = container.querySelector('#pl-dob-error');
      el.textContent = 'Please enter a valid date in DD-MM-YYYY format.';
      el.classList.remove('pl-hidden');
      hasError = true;
    } else if (selectedType === 'DOB') {
      container.querySelector('#pl-dob-error').classList.add('pl-hidden');
    }

    if (selectedType === 'PAN_NO' && !isValidPAN(identifierValue)) {
      const el = container.querySelector('#pl-pan-error');
      el.textContent = 'Please enter a valid PAN number (e.g. ABCDE1234F).';
      el.classList.remove('pl-hidden');
      hasError = true;
    } else if (selectedType === 'PAN_NO') {
      container.querySelector('#pl-pan-error').classList.add('pl-hidden');
    }

    if (!consentChecked) {
      const el = container.querySelector('#pl-consent-error');
      el.textContent = 'Please accept the Terms & Conditions to proceed.';
      el.classList.remove('pl-hidden');
      hasError = true;
    } else {
      container.querySelector('#pl-consent-error').classList.add('pl-hidden');
    }

    if (hasError) return;

    setLoading(loginBtn, true);

    const result = await initiateCustomerIdentification({
      mobileNo: mobile,
      identifierName: selectedType,
      identifierValue,
    });

    setLoading(loginBtn, false);

    if (!result.success) {
      showError(container, result.errorDesc || 'Unable to process your request. Please try again.');
      return;
    }

    // Save login data (not logging PII)
    updateJourneyState({
      loginData: { identifierType: selectedType }, // no mobile/PAN stored in plain state
      step: 'otp',
    });

    // Advance to OTP step
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'otp', config);
  });
}

// ---------------------------------------------------------------------------
// STEP 2 — OTP Verification
// ---------------------------------------------------------------------------
function renderOTPStep(container, config) {
  const OTP_EXPIRY_SECONDS = 120;
  let timerInterval = null;

  container.innerHTML = `
    <div class="pl-step">
      <div class="pl-card-header">
        <h2 class="pl-card-title">Verify OTP</h2>
        <p class="pl-card-subtitle">Enter the 6-digit OTP sent to your registered mobile number</p>
      </div>

      <div class="pl-field">
        <label for="pl-otp">One-Time Password <span class="required">*</span></label>
        <input
          type="text"
          id="pl-otp"
          class="pl-input pl-otp-input"
          placeholder="------"
          maxlength="6"
          inputmode="numeric"
          autocomplete="one-time-code"
        />
        <div class="pl-field-error pl-hidden" id="pl-otp-error"></div>
      </div>

      <div class="pl-otp-timer">
        Time remaining: <strong id="pl-timer">${OTP_EXPIRY_SECONDS}s</strong>
        &nbsp;|&nbsp;
        <button class="pl-resend-btn" id="pl-resend-btn" disabled>Resend OTP</button>
      </div>

      <button class="pl-btn pl-btn-primary" id="pl-verify-btn">Verify OTP</button>

      <p style="text-align:center;font-size:0.8rem;color:#6b7280;margin-top:16px">
        <strong>Test hint:</strong> Enter any 6 digits (except 000000) to succeed.<br>
        Enter <strong>000000</strong> to simulate OTP failure.
      </p>
    </div>
  `;

  // --- OTP timer countdown ---
  let remaining = OTP_EXPIRY_SECONDS;
  const timerEl = container.querySelector('#pl-timer');
  const resendBtn = container.querySelector('#pl-resend-btn');

  timerInterval = setInterval(() => {
    remaining -= 1;
    timerEl.textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = 'Expired';
      resendBtn.disabled = false;
    }
  }, 1000);

  // Resend OTP
  resendBtn.addEventListener('click', async () => {
    const state = getJourneyState();
    resendBtn.disabled = true;
    remaining = OTP_EXPIRY_SECONDS;
    timerEl.textContent = `${remaining}s`;
    timerInterval = setInterval(() => {
      remaining -= 1;
      timerEl.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerEl.textContent = 'Expired';
        resendBtn.disabled = false;
      }
    }, 1000);
    // eslint-disable-next-line no-console
    console.log(`[Journey] OTP resent. JourneyID: ${state?.journeyId}`);
  });

  // --- Verify OTP ---
  const verifyBtn = container.querySelector('#pl-verify-btn');
  verifyBtn.addEventListener('click', async () => {
    clearError(container);
    const otp = container.querySelector('#pl-otp').value.trim();

    if (!/^\d{6}$/.test(otp)) {
      const el = container.querySelector('#pl-otp-error');
      el.textContent = 'Please enter a valid 6-digit OTP.';
      el.classList.remove('pl-hidden');
      return;
    }

    container.querySelector('#pl-otp-error').classList.add('pl-hidden');
    setLoading(verifyBtn, true);

    const result = await verifyOTPAndGetDemogDetails({ passwordValue: otp });
    setLoading(verifyBtn, false);

    if (!result.success) {
      showError(container, result.errorDesc || 'OTP verification failed. Please try again.');
      return;
    }

    clearInterval(timerInterval);

    const offers = result.data?.responseString?.OfferDemogDetails || [];
    const customer = offers[0] || {};

    updateJourneyState({
      customerData: customer,
      offerList: offers,
      selectedOffer: customer, // Tier 1: auto-select first offer
      step: 'offer',
    });

    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'offer', config);
  });
}

// ---------------------------------------------------------------------------
// STEP 3 — Offer Display
// ---------------------------------------------------------------------------
function renderOfferStep(container, config) {
  const state = getJourneyState();
  const offer = state?.selectedOffer || {};
  const amount = parseFloat(offer.offerAmount) || 0;

  container.innerHTML = `
    <div class="pl-step">
      <div class="pl-card-header">
        <h2 class="pl-card-title">Your Loan Offer</h2>
        <p class="pl-card-subtitle">Congratulations! You are eligible for a personal loan.</p>
      </div>

      <div class="pl-offer-card">
        <div class="pl-offer-label">Pre-approved Offer Amount</div>
        <div class="pl-offer-value">${formatINR(amount)}</div>

        <div class="pl-offer-grid">
          <div class="pl-offer-item">
            <div class="pl-offer-label">Tenure</div>
            <div style="font-size:1rem;font-weight:700;color:#1a1a2e">${offer.tenure || '--'} months</div>
          </div>
          <div class="pl-offer-item">
            <div class="pl-offer-label">Interest Rate</div>
            <div style="font-size:1rem;font-weight:700;color:#1a1a2e">${offer.rateOfInterest || '--'} p.a.</div>
          </div>
          <div class="pl-offer-item">
            <div class="pl-offer-label">Offer Type</div>
            <div style="font-size:0.85rem;font-weight:600;color:#1a1a2e">${offer.offerType?.trim() || '--'}</div>
          </div>
          <div class="pl-offer-item">
            <div class="pl-offer-label">KYC Status</div>
            <div style="font-size:0.85rem;font-weight:700;color:${offer.kycFlag === 'Y' ? '#1a7a3c' : '#c0392b'}">
              ${offer.kycFlag === 'Y' ? '✓ Verified' : '✗ Pending'}
            </div>
          </div>
        </div>
      </div>

      <button class="pl-btn pl-btn-primary" id="pl-accept-offer-btn">Accept Offer &amp; Calculate EMI</button>
      <button class="pl-btn pl-btn-secondary" id="pl-back-to-login-btn">← Back</button>
    </div>
  `;

  container.querySelector('#pl-accept-offer-btn').addEventListener('click', () => {
    updateJourneyState({ step: 'emi' });
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'emi', config);
  });

  container.querySelector('#pl-back-to-login-btn').addEventListener('click', () => {
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'login', config);
  });
}

// ---------------------------------------------------------------------------
// STEP 4 — EMI Calculator
// ---------------------------------------------------------------------------
function renderEMIStep(container, config) {
  const state = getJourneyState();
  const offer = state?.selectedOffer || {};
  const maxAmount = parseFloat(offer.offerAmount) || 1000000;
  const defaultTenure = parseInt(offer.tenure, 10) || 36;
  const defaultRate = parseRateOfInterest(offer.rateOfInterest) || 10.2;

  function updateEMIDisplay() {
    const P = parseFloat(container.querySelector('#pl-loan-amount').value) || maxAmount;
    const r = parseFloat(container.querySelector('#pl-rate').value) || defaultRate;
    const n = parseInt(container.querySelector('#pl-tenure').value, 10) || defaultTenure;

    try {
      const { emi, totalPayable, totalInterest } = calculateEMI(P, r, n);
      container.querySelector('#pl-emi-amount').textContent = formatINR(emi);
      container.querySelector('#pl-total-payable').textContent = formatINR(totalPayable);
      container.querySelector('#pl-total-interest').textContent = formatINR(totalInterest);

      updateJourneyState({
        emiData: {
          loanAmount: P,
          tenure: n,
          rateOfInterest: r,
          emi,
          totalPayable,
          totalInterest,
        },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[EMI] Calculation error:', e.message);
    }
  }

  container.innerHTML = `
    <div class="pl-step">
      <div class="pl-card-header">
        <h2 class="pl-card-title">EMI Calculator</h2>
        <p class="pl-card-subtitle">Customise your loan amount and see your monthly payment</p>
      </div>

      <div class="pl-field">
        <label for="pl-loan-amount">Loan Amount <span class="required">*</span></label>
        <input
          type="number"
          id="pl-loan-amount"
          class="pl-input"
          value="${maxAmount}"
          min="10000"
          max="${maxAmount}"
          step="10000"
        />
        <div class="pl-range-labels">
          <span>${formatINR(10000)}</span>
          <span>${formatINR(maxAmount)}</span>
        </div>
      </div>

      <div class="pl-field">
        <label for="pl-tenure">Tenure (months) <span class="required">*</span></label>
        <input
          type="range"
          id="pl-tenure"
          class="pl-range"
          min="6"
          max="60"
          step="6"
          value="${defaultTenure}"
        />
        <div class="pl-range-labels">
          <span>6 mo</span>
          <span id="pl-tenure-display" style="font-weight:700;color:#004c97">${defaultTenure} months</span>
          <span>60 mo</span>
        </div>
      </div>

      <div class="pl-field">
        <label for="pl-rate">Interest Rate (% p.a.)</label>
        <input
          type="number"
          id="pl-rate"
          class="pl-input"
          value="${defaultRate}"
          min="1"
          max="36"
          step="0.05"
          readonly
          style="background:#f3f4f6"
        />
        <div class="pl-field-error" style="color:#6b7280;font-size:0.78rem;margin-top:3px">
          Rate is fixed as per your offer
        </div>
      </div>

      <div class="pl-emi-result" id="pl-emi-result">
        <div class="pl-emi-label">Monthly EMI</div>
        <div class="pl-emi-amount" id="pl-emi-amount">--</div>
        <div class="pl-emi-breakdown">
          <div class="pl-emi-breakdown-item">
            <div class="value" id="pl-total-payable">--</div>
            <div class="label">Total Payable</div>
          </div>
          <div class="pl-emi-breakdown-item">
            <div class="value" id="pl-total-interest">--</div>
            <div class="label">Total Interest</div>
          </div>
        </div>
      </div>

      <button class="pl-btn pl-btn-primary" id="pl-proceed-preview-btn">Proceed to Preview →</button>
      <button class="pl-btn pl-btn-secondary" id="pl-back-offer-btn">← Back to Offer</button>
    </div>
  `;

  // Wire up live updates
  container.querySelector('#pl-loan-amount').addEventListener('input', updateEMIDisplay);
  container.querySelector('#pl-tenure').addEventListener('input', () => {
    const val = container.querySelector('#pl-tenure').value;
    container.querySelector('#pl-tenure-display').textContent = `${val} months`;
    updateEMIDisplay();
  });

  // Initial calculation
  updateEMIDisplay();

  container.querySelector('#pl-proceed-preview-btn').addEventListener('click', () => {
    updateJourneyState({ step: 'preview' });
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'preview', config);
  });

  container.querySelector('#pl-back-offer-btn').addEventListener('click', () => {
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'offer', config);
  });
}

// ---------------------------------------------------------------------------
// STEP 5 — Preview & Submission
// ---------------------------------------------------------------------------
function renderPreviewStep(container, config) {
  const state = getJourneyState();
  const offer = state?.selectedOffer || {};
  const emi = state?.emiData || {};

  function previewRow(key, value) {
    return `
      <div class="pl-preview-row">
        <span class="key">${key}</span>
        <span class="value">${value || '--'}</span>
      </div>`;
  }

  container.innerHTML = `
    <div class="pl-step">
      <div class="pl-card-header">
        <h2 class="pl-card-title">Review & Submit</h2>
        <p class="pl-card-subtitle">Please review your loan details before submitting</p>
      </div>

      <div class="pl-preview-section">
        <div class="pl-preview-section-title">Customer Details</div>
        ${previewRow('Name', `${offer.customerFirstName || ''} ${offer.customerLastName || ''}`.trim())}
        ${previewRow('City', offer.customerCity)}
        ${previewRow('State', offer.customerState)}
        ${previewRow('KYC Status', offer.kycFlag === 'Y' ? '✓ Verified' : 'Pending')}
      </div>

      <div class="pl-preview-section">
        <div class="pl-preview-section-title">Loan Details</div>
        ${previewRow('Loan Amount', formatINR(emi.loanAmount || parseFloat(offer.offerAmount)))}
        ${previewRow('Tenure', `${emi.tenure || offer.tenure} months`)}
        ${previewRow('Interest Rate', `${emi.rateOfInterest || parseRateOfInterest(offer.rateOfInterest)}% p.a.`)}
        ${previewRow('Monthly EMI', formatINR(emi.emi))}
        ${previewRow('Total Payable', formatINR(emi.totalPayable))}
        ${previewRow('Total Interest', formatINR(emi.totalInterest))}
      </div>

      <div class="pl-field" style="margin-top:8px">
        <label style="display:flex;align-items:flex-start;gap:8px;font-weight:400;cursor:pointer">
          <input type="checkbox" id="pl-final-consent" style="margin-top:3px;accent-color:#004c97;flex-shrink:0" />
          <span style="font-size:0.8rem;color:#6b7280">
            I confirm the above details are correct and authorise HDFC Bank to process my loan application.
          </span>
        </label>
        <div class="pl-field-error pl-hidden" id="pl-final-consent-error"></div>
      </div>

      <button class="pl-btn pl-btn-primary" id="pl-submit-btn" style="margin-top:12px">
        Submit Application
      </button>
      <button class="pl-btn pl-btn-secondary" id="pl-back-emi-btn">← Back to EMI</button>
    </div>
  `;

  const submitBtn = container.querySelector('#pl-submit-btn');
  submitBtn.addEventListener('click', async () => {
    clearError(container);

    const consentChecked = container.querySelector('#pl-final-consent').checked;
    if (!consentChecked) {
      const el = container.querySelector('#pl-final-consent-error');
      el.textContent = 'Please confirm your details before submitting.';
      el.classList.remove('pl-hidden');
      return;
    }
    container.querySelector('#pl-final-consent-error').classList.add('pl-hidden');

    setLoading(submitBtn, true);

    const currentState = getJourneyState();
    const applicationPayload = {
      contextParam: currentState.contextParam,
      requestString: {
        loanAmount: String(currentState.emiData?.loanAmount || ''),
        tenure: String(currentState.emiData?.tenure || ''),
        rateofInterest: String(currentState.emiData?.rateOfInterest || ''),
        emi: String(currentState.emiData?.emi || ''),
        processingfees: '',
        product: 'PL',
        consentTocALL: 'Y',
        educationalQualification: '',
        monthlyTakeHomeSalary: currentState.selectedOffer?.monthlyIncome || '',
        noOfDependent: '',
        salesPromotion: '',
        yearAtCity: '',
        yearAtCurrentAddress: '',
        employerName: '',
        vkycConsent: 'Y',
        vkycRetUrl: '',
        leadRetUrl: '',
        flgDropOff: 'N',
        fillerFields: {
          filler1: '',
          filler2: '',
          filler3: '',
          filler4: '',
          filler5: '',
          filler6: '',
          filler7: '',
          filler8: '',
          filler9: '',
          filler10: '',
        },
      },
    };

    const result = await submitLoanApplication(applicationPayload);
    setLoading(submitBtn, false);

    if (!result.success) {
      showError(container, result.errorDesc || 'Submission failed. Please try again.');
      return;
    }

    const ackId = result.data?.responseString?.acknowledgementId || '';
    updateJourneyState({ submissionResult: { acknowledgementId: ackId }, step: 'thankyou' });

    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'thankyou', config);
  });

  container.querySelector('#pl-back-emi-btn').addEventListener('click', () => {
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'emi', config);
  });
}

// ---------------------------------------------------------------------------
// STEP 6 — Thank You Screen
// ---------------------------------------------------------------------------
function renderThankYouStep(container) {
  const state = getJourneyState();
  const ackId = state?.submissionResult?.acknowledgementId || 'N/A';

  container.innerHTML = `
    <div class="pl-step pl-thankyou">
      <div class="pl-thankyou-icon">🎉</div>
      <h2 class="pl-thankyou-title">Application Submitted!</h2>
      <p style="color:#6b7280;font-size:0.9rem;margin-bottom:16px">
        Thank you for applying for a Personal Loan with HDFC Bank.<br>
        Our team will get in touch with you shortly.
      </p>

      <div class="pl-ack-box">
        <div style="color:#6b7280;font-size:0.8rem;margin-bottom:4px">Acknowledgement ID</div>
        <div class="pl-ack-id">${ackId}</div>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:0.85rem;color:#1e40af;text-align:left">
        <strong>What happens next?</strong>
        <ul style="margin:8px 0 0 0;padding-left:18px;line-height:1.8">
          <li>You will receive a confirmation SMS on your registered mobile</li>
          <li>A relationship manager will call within 24 hours</li>
          <li>Keep your KYC documents ready for verification</li>
        </ul>
      </div>

      <button class="pl-btn pl-btn-secondary" id="pl-new-application-btn">
        Start New Application
      </button>
    </div>
  `;

  container.querySelector('#pl-new-application-btn').addEventListener('click', () => {
    clearJourneyState();
    initJourneyState();
    // eslint-disable-next-line no-use-before-define
    renderStep(container.closest('.personal-loan'), 'login', {});
  });
}

// ---------------------------------------------------------------------------
// Step Router — renders the correct step and updates progress bar
// ---------------------------------------------------------------------------
function renderStep(block, stepId, config) {
  // Clear existing content
  block.innerHTML = '';

  // Render progress bar (hide on thank you step)
  if (stepId !== 'thankyou') {
    block.appendChild(renderProgressBar(stepId));
  }

  // Render the card container
  const card = document.createElement('div');
  card.className = 'pl-card';
  block.appendChild(card);

  // Delegate to step renderer
  switch (stepId) {
    case 'login':
      renderLoginStep(card, config);
      break;
    case 'otp':
      renderOTPStep(card, config);
      break;
    case 'offer':
      renderOfferStep(card, config);
      break;
    case 'emi':
      renderEMIStep(card, config);
      break;
    case 'preview':
      renderPreviewStep(card, config);
      break;
    case 'thankyou':
      renderThankYouStep(card);
      break;
    default:
      renderLoginStep(card, config);
  }

  // Scroll to top of block on step change
  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// EDS Block Entry Point — called by EDS when the block is loaded
// ---------------------------------------------------------------------------
export default function decorate(block) {
  // 1. Read authoring config from the block's table rows
  const config = readBlockConfig(block);

  // 2. Initialise (or restore) journey state
  const existingState = getJourneyState();
  if (!existingState) {
    initJourneyState();
  }

  // 3. Determine starting step (resume from saved state if available)
  const startStep = existingState?.step || 'login';

  // 4. Render the first (or resumed) step
  renderStep(block, startStep, config);
}
