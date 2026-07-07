# EDS Capstone — Personal Loan Journey: Complete Setup Guide

This document is your **end-to-end walkthrough** for getting the Personal Loan journey up and running, from local dev preview all the way to AEM Author publishing.

---

## Table of Contents

1. [What's Already Built](#1-whats-already-built)
2. [Quick Local Preview (No AEM needed)](#2-quick-local-preview-no-aem-needed)
3. [Full EDS Stack with `aem up`](#3-full-eds-stack-with-aem-up)
4. [Creating the Page in AEM Author (Universal Editor)](#4-creating-the-page-in-aem-author-universal-editor)
5. [Block Authoring — How to Control the Form](#5-block-authoring--how-to-control-the-form)
6. [Journey Flow & Test Credentials](#6-journey-flow--test-credentials)
7. [Project File Map](#7-project-file-map)
8. [Tier 1 Capstone Checklist](#8-tier-1-capstone-checklist)
9. [Tier 2 Upgrade Path](#9-tier-2-upgrade-path)
10. [Coding Guidelines Reference](#10-coding-guidelines-reference)

---

## 1. What's Already Built

All Tier 1 code is **complete and wired up**. You do not need to write any JS/CSS from scratch.

| File | What it Does |
|---|---|
| `blocks/personal-loan/personal-loan.js` | Orchestrates all 6 journey steps (Login → OTP → Offer → EMI → Preview → Thank You) |
| `blocks/personal-loan/personal-loan.css` | Full HDFC-branded styles, mobile-responsive |
| `scripts/api-service.js` | All API calls (Tier 1: mocked, Tier 2: real `fetch()`) |
| `scripts/emi-calculator.js` | Standard EMI formula: `P × r × (1+r)^n / ((1+r)^n - 1)` |
| `scripts/journey-state.js` | `sessionStorage`-backed state manager, no PII logged |

### Journey Steps

```
Step 1: Login       →  Mobile + PAN or DOB, OTP trigger
Step 2: Verify OTP  →  6-digit OTP, 120-second countdown, resend
Step 3: Offer       →  Pre-approved offer from API response
Step 4: EMI Calc    →  Live EMI as user adjusts amount / tenure
Step 5: Preview     →  Read-only summary + final consent
Step 6: Thank You   →  Acknowledgement ID display
```

---

## 2. Quick Local Preview (No AEM needed)

Use this to see the form immediately in your browser via a static file server.

### Step 1 — Install a local server (one-time)

```bash
npm install -g http-server
```

### Step 2 — Serve the project

```bash
cd c:\Users\ambarishs\Documents\GitHub\my-forms-project
http-server . --cors -p 8080
```

### Step 3 — Open the demo page

```
http://localhost:8080/personal-loan-demo.html
```

> **What you'll see:** The full 6-step loan journey. All APIs are mocked.
> No AEM Author connection needed.

---

## 3. Full EDS Stack with `aem up`

This runs the real EDS proxy server, which fetches page content from AEM Author
and serves your local JS/CSS code. This is the correct way to develop and preview.

### Step 1 — Install npm dependencies (one-time)

```bash
cd c:\Users\ambarishs\Documents\GitHub\my-forms-project
npm install
```

### Step 2 — Start the AEM proxy dev server

```bash
aem up
```

The CLI will:
- Start a local proxy at `http://localhost:3000`
- Fetch page HTML from your AEM Author (`fstab.yaml` mount point)
- Serve your local `blocks/`, `scripts/`, `styles/` files

### Step 3 — Open the loan page

```
http://localhost:3000/personal-loan
```

> **Important:** The page `/personal-loan` must exist in AEM Author first.
> See Section 4 below to create it.

### Useful `aem` commands

| Command | What it does |
|---|---|
| `aem up` | Start local proxy server (default port 3000) |
| `aem up --port 4000` | Use a different port |
| `aem login` | Authenticate with your AEM instance |

---

## 4. Creating the Page in AEM Author (Universal Editor)

This is the critical step that connects your code to AEM. The page in AEM Author is what
`aem up` proxies — your local code runs on top of the authored page structure.

### 4.1 — Log in to AEM Author

Go to your AEM Author URL:

```
https://author-p96753-e1523920.adobeaemcloud.com
```

Log in with your AEM credentials.

### 4.2 — Navigate to Sites

1. Click the **AEM icon** (top left) → **Sites**
2. You should see the project root: `my-forms-project`

### 4.3 — Create a new page

1. Navigate into the project: `my-forms-project → main`
2. Click **Create → Page**
3. Select the **Blank Page** template (or the EDS page template if one exists)
4. Set the page name / URL slug: `personal-loan`
5. Set the title: `Personal Loan Journey`
6. Click **Create**

### 4.4 — Open the page in Universal Editor

1. Select your new `personal-loan` page
2. Click **Open in Universal Editor** (or the pencil/edit icon)
3. The page opens in the UE viewport

### 4.5 — Add the Personal Loan block

In Universal Editor:

1. Click the **"+"** button to add a new component/block to the page
2. Search for or select **"Personal Loan"** block
   - If it doesn't appear, ensure `component-definition.json` and `component-models.json` are up to date (run `npm run build:json`)
3. The block is placed on the page

### 4.6 — Configure the block via authoring properties

With the Personal Loan block selected in Universal Editor:

1. Open the **Properties panel** (right sidebar)
2. Set the following properties:

| Property | Value | Effect |
|---|---|---|
| `identifier-type` | `PAN` | Login screen shows PAN field |
| `identifier-type` | `DOB` | Login screen shows Date of Birth field |
| `partner-id` | `HDFCBANK` | Sets the partner context (optional) |

> **Tier 2 note:** Create TWO pages:
> - `/personal-loan-pan` with `identifier-type = PAN`
> - `/personal-loan-dob` with `identifier-type = DOB`
> This demonstrates authorable login variants without any code changes.

### 4.7 — Publish the page

1. Click **Publish** in Universal Editor
2. The page is now live on the preview/publish CDN

### 4.8 — Preview via `aem up`

With `aem up` running and the page published:

```
http://localhost:3000/personal-loan
```

Your local `blocks/personal-loan/personal-loan.js` is served on top of the authored page.

---

## 5. Block Authoring — How to Control the Form

The block reads its configuration from **key-value rows** in the block's content table.
This is the EDS authoring pattern — **no code changes needed** to change behaviour.

### In the authored document (Universal Editor or Google Docs):

The block table looks like this in the source:

```
+------------------+----------+
| Personal Loan    |          |  ← Block header row
+------------------+----------+
| identifier-type  | PAN      |  ← Config row 1
+------------------+----------+
| partner-id       | HDFCBANK |  ← Config row 2
+------------------+----------+
```

### This translates to the following DOM (what `readBlockConfig()` reads):

```html
<div class="personal-loan block">
  <div><div>identifier-type</div><div>PAN</div></div>
  <div><div>partner-id</div><div>HDFCBANK</div></div>
</div>
```

### Available config keys

| Key | Values | Description |
|---|---|---|
| `identifier-type` | `PAN` \| `DOB` | Which secondary identifier to show on the login screen |
| `partner-id` | string | Overrides the default `HDFCBANK` partnerId in API calls |

---

## 6. Journey Flow & Test Credentials

### Step-by-step test walkthrough

**Step 1: Login**
- Mobile: any 10-digit number starting with 6–9, e.g. `9876543210`
  - To trigger failure: use a mobile ending in `0000`, e.g. `9870000000`
- PAN: any valid format, e.g. `ABCDE1234F`
- DOB: any valid date, e.g. `27-02-1987`
- Check the consent checkbox
- Click **Get OTP**

**Step 2: Verify OTP**
- Enter any 6 digits, e.g. `123456`
  - To trigger OTP failure: enter `000000`
- Click **Verify OTP**

**Step 3: Offer**
- The mocked response shows:
  - Offer amount: ₹10,00,000
  - Tenure: 36 months
  - Rate: 10.20% p.a.
- Click **Accept Offer & Calculate EMI**

**Step 4: EMI Calculator**
- Adjust loan amount (slider/input) — EMI recalculates live
- Adjust tenure slider
- Formula: `EMI = P × r × (1+r)^n / ((1+r)^n - 1)`
- Example: ₹5,00,000 at 10.20% for 36 months ≈ ₹16,165/month
- Click **Proceed to Preview**

**Step 5: Preview**
- Read-only summary of customer details + loan details
- Check the final consent checkbox
- Click **Submit Application**

**Step 6: Thank You**
- Acknowledgement ID displayed (e.g. `ACK-1720345678901`)
- Click **Start New Application** to restart

### Observing the journey state

Open browser DevTools → Application → Session Storage → look for key `pl_journey_state`.
You can see the full state object update in real-time as you move through steps.

### Observing logs (no PII rule)

Open browser DevTools → Console. You will see:
```
[Journey] Initialised. JourneyID: ACS-1720345678901
[API] initiateCustomerIdentification called. JourneyID: ACS-...
[API] initiateCustomerIdentification → responseCode: 0
[Journey] Step: login → otp
[API] verifyOTPAndGetDemogDetails called. JourneyID: ACS-...
[Journey] Step: otp → offer
...
```

**Note:** Mobile number, PAN, DOB, and customer name are NOT logged — only journey IDs and response codes.

---

## 7. Project File Map

```
my-forms-project/
│
├── blocks/
│   └── personal-loan/
│       ├── personal-loan.js       ← 6-step journey orchestrator (MAIN BLOCK)
│       └── personal-loan.css      ← HDFC-branded styles
│
├── scripts/
│   ├── api-service.js             ← API layer (mocked for Tier 1)
│   ├── emi-calculator.js          ← EMI formula + INR formatter
│   ├── journey-state.js           ← sessionStorage state manager
│   ├── scripts.js                 ← EDS main script (loads blocks)
│   └── aem.js                     ← EDS block loading utilities
│
├── styles/
│   ├── styles.css                 ← EDS global styles
│   └── fonts.css                  ← Roboto font loading
│
├── fstab.yaml                     ← AEM Author mount point config
├── personal-loan-demo.html        ← Standalone local demo page
├── component-models.json          ← UE block property definitions
├── component-definition.json      ← UE block registry
└── CAPSTONE-SETUP.md              ← This file
```

---

## 8. Tier 1 Capstone Checklist

Use this to verify your Tier 1 submission is complete.

### Code & Architecture
- [x] Correct EDS block folder structure (`blocks/personal-loan/`)
- [x] Block follows EDS convention: `export default function decorate(block) {}`
- [x] Authoring config read via `readBlockConfig()` — no hardcoded values
- [x] No hardcoded URLs or credentials in any file
- [x] No PII (name, mobile, PAN, DOB) in console logs — only journey IDs

### Journey Flow
- [x] Login screen with Mobile + PAN/DOB toggle
- [x] Client-side validation (mobile format, PAN format, DOB format, consent)
- [x] OTP screen with 120-second countdown and resend button
- [x] Offer display screen with offer details from API response
- [x] EMI calculator with live recalculation
- [x] Preview screen (read-only) with all loan details
- [x] Submit button calls `submitLoanApplication` API
- [x] Thank You screen with Acknowledgement ID

### API & State
- [x] `initiateCustomerIdentification` — mocked, one success + one failure
- [x] `verifyOTPAndGetDemogDetails` — mocked, one success + one failure
- [x] `submitLoanApplication` — mocked, returns unique ACK ID
- [x] Journey state persisted in `sessionStorage`
- [x] `bankJourneyID` captured from API response and stored in state
- [x] State clears correctly on "Start New Application"

### EMI Formula
- [x] `EMI = P × r × (1+r)^n / ((1+r)^n - 1)`
- [x] Monthly rate: `r = annualRate / 12 / 100`
- [x] Correct for example: P=500000, rate=12%, n=36 → ₹16,607

### Fragment Reusability (Tier 1 requirement)
- The login, OTP, offer, and preview logic are all in **separate render functions**
  (`renderLoginStep`, `renderOTPStep`, `renderOfferStep`, `renderPreviewStep`)
- Each function is independently callable — this is the EDS equivalent of "fragments"
- For full AEM fragment reuse in Tier 2, these become separate block folders

---

## 9. Tier 2 Upgrade Path

To upgrade to Tier 2 (Integration), make the following changes:

### 9.1 — Replace mock APIs with real `fetch()` calls

In `scripts/api-service.js`, replace each `// ---- TIER 1 MOCK ----` block with a real `fetch()`:

```javascript
// Example for initiateCustomerIdentification
const state = getJourneyState();
const payload = {
  contextParam: state.contextParam,
  requestString: {
    mobileNo: params.mobileNo,
    identifierName: params.identifierName,
    identifierValue: params.identifierValue,
    msgType: 'S',
    fillerFields: { filler1:'',filler2:'',filler3:'',filler4:'',filler5:'',
                    filler6:'',filler7:'',filler8:'',filler9:'',filler10:'' },
  },
};
const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.initiateCustomerIdentification}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const raw = await response.json();
return normaliseResponse(raw);
```

### 9.2 — Add the Personal Info screen (Tier 2 only)

Add a new step between OTP and Offer:

```
Login → OTP → PersonalInfo → GetBureauOffer → Offer → EMI → Preview → Thank You
```

Add `renderPersonalInfoStep()` in `personal-loan.js` and add `{ id: 'personal-info', label: 'Details' }` to `STEPS`.

### 9.3 — Create two loan pages for login variant demo

In AEM Author, create:
- `/personal-loan-pan` with `identifier-type = PAN`
- `/personal-loan-dob` with `identifier-type = DOB`

This demonstrates **authorable** login variants — no code change, pure authoring config.

### 9.4 — Add Tier 2 APIs

Implement these stubs in `scripts/api-service.js`:
- `panEnquiry(params)` — validate PAN against bureau
- `getBureauOffer(params)` — fetch bureau-driven offer (BRE2)
- `generateEmailOTP(params)` — email OTP generation
- `validateEmailOTP(params)` — email OTP validation

### 9.5 — Add basic analytics

Add event tracking at key moments:

```javascript
// In renderLoginStep — after successful OTP send:
console.log(`[Analytics] event=otp_sent journeyId=${state.journeyId}`);

// In renderOTPStep — after OTP verify:
console.log(`[Analytics] event=otp_${result.success ? 'success' : 'failure'} journeyId=...`);

// In renderOfferStep — on offer accept:
console.log(`[Analytics] event=offer_accepted offerAmount=${offer.offerAmount} journeyId=...`);

// In renderPreviewStep — on submit:
console.log(`[Analytics] event=application_submitted journeyId=...`);
```

---

## 10. Coding Guidelines Reference

Per the capstone requirements (Section 5 of the document):

| Requirement | How It's Met |
|---|---|
| Proper EDS folder structure | `blocks/personal-loan/personal-loan.{js,css}` |
| Reusable fragments | Separate `render*Step()` functions, independently callable |
| Authorable rules & visibility | `identifier-type` config key controls field visibility |
| Client-side validation | Mobile regex, PAN regex, DOB regex, consent check |
| No hardcoded URLs or credentials | `API_CONFIG` object — base URL is empty string by default |
| Clean logging, journey IDs only | All `console.log` uses `journeyId`, no PII fields |
| No PI in logging | Verified: mobile, PAN, DOB, name never appear in logs |

### Links from capstone doc
- https://www.aem.live/docs/dev-collab-and-good-practices
- https://experienceleague.adobe.com/en/docs/experience-manager-65/content/forms/adaptive-forms-basic-authoring/adaptive-forms-best-practices
- https://www.aem.live/docs/faq

---

*Document generated for EDS Capstone — Tier 1 (Foundation) + Tier 2 (Integration) guidance.*
