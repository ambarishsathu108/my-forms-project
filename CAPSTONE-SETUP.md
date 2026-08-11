# EDS Forms Capstone — Personal Loan Journey: Setup & Status

This document tracks the **actual** implementation of the Personal Loan capstone journey,
built as an **Adaptive Form authored in Universal Editor** — fragments, Rule Editor logic,
and custom functions — per the capstone's mandatory requirement to use AEM Forms + EDS
authoring tools rather than a hand-coded block.

> **Status as of this writing: IN PROGRESS.** Sections below reflect what is actually
> built and verified vs. what is still pending. Do not treat this as a "done" checklist —
> see [Section 6](#6-tier-1-status-honest-checklist) for the real state.

---

## 1. Architecture

Unlike a typical EDS block, this journey is built entirely through **AEM Forms authoring**:

```
AEM Author (Universal Editor)
  /content/dam/formsanddocuments/ambarish-hdfc-capstone/
    ├── header                  (Adaptive Form Fragment)
    ├── otp-login               (Adaptive Form Fragment)
    ├── offer-display           (Adaptive Form Fragment)
    ├── preview                 (Adaptive Form Fragment)
    ├── assets/                 (bank logo)
    └── personal-loan-journey   (Adaptive Form — the main journey, Wizard-based)

GitHub repo (this codebase)
  scripts/personal-loan-custom-functions.js   ← registered via "Form Specific
                                                  Custom Functions Path" on both
                                                  the main form and each fragment
                                                  that invokes a function
```

The rendering pipeline is the **existing, untouched** `blocks/form/` engine in this repo
(`form.js`, `rules/index.js`, `rules/RuleEngineWorker.js`) — no code changes were needed
there. The Adaptive Form's JSON definition is authored entirely in AEM; this repo only
supplies the custom functions file and the standard EDS boilerplate.

---

## 2. Main Form Structure — `personal-loan-journey`

A single Adaptive Form containing one **Wizard** component with 6 panels:

| Panel (Name) | Title | Contents |
|---|---|---|
| `loginPanel` | Login | Fragment: `header` + Fragment: `otp-login` |
| `otpPanel` | Verify OTP | `otp` (Text Input) + `verifyOtpBtn` (Button) |
| `offerPanel` | Your Offer | Fragment: `offer-display` |
| `emiPanel` | EMI Calculator | `loanAmount`, `tenure`, `emiAmount` (read-only), `proceedToPreviewBtn` |
| `previewPanel` | Review & Submit | Fragment: `preview` |
| `thankYouPanel` | Done | `acknowledgementId` (read-only) + confirmation text |

## 3. Fragments

| Fragment | Fields |
|---|---|
| `header` | `bankLogo` (Image), title/subtitle Text components |
| `otp-login` | `mobile`, `identifierType` (radio: PAN/DOB), `panField`, `dobField`, `consent`, `getOtpBtn` |
| `offer-display` | `offerAmount`, `tenure`, `rateOfInterest`, `kycFlag` (all read-only), `proceedBtn` |
| `preview` | `customerName`, `customerCity`, `previewLoanAmount`, `previewTenure`, `previewRate`, `previewEmi` (all read-only), `finalConsent`, `submitBtn` |

---

## 4. Rule Editor Logic

### 4.1 — Field visibility via authoring (built inside `otp-login` fragment)

Two rules, using the Rule Editor's native `Show`/`Hide` action with a `WHEN`/`ELSE`
structure (no custom function needed for this part):

- **`panField` — Visibility**: `SHOW panField WHEN (identifierType is equal to 'PAN') ELSE Hide`
- **`dobField` — Visibility**: `SHOW dobField WHEN (identifierType is equal to 'Date of Birth') ELSE Hide`

> Note: the comparison value must match the field's actual **Display Value**
> (e.g. `"Date of Birth"`), not a separate data-value code — this was confirmed by
> checking the Rule Editor's own value-suggestion list rather than assuming.

### 4.2 — Journey navigation and mock data (simplified approach)

**Known issue:** invoking custom functions from the Rule Editor via `Set Value of →
Function Output → <function name>` has not been verified working — the function list
returns empty even after the custom functions file was confirmed live and reachable on
both the preview and production EDS URLs (see Section 7, Known Limitations). Rather than
block all progress on this, the journey's navigation and mock data display for Tier 1 use
**only built-in Rule Editor primitives** (`Set Value of` with String/Mathematical
Expression sources, `Show`/`Hide`, `Navigate among the panels`, `Add Condition`/`Else`) —
no custom function invocation required:

- **`getOtpBtn`** (in `otp-login`, rule built from within the main form since it needs to
  navigate to a panel that only exists in the main form's Wizard): on click → navigate to
  `Verify OTP` panel.
- **`verifyOtpBtn`**: on click → `WHEN otp is equal to "000000"` → show an error → `ELSE`
  → set `offerAmount`/`tenure`/`rateOfInterest`/`kycFlag` to hardcoded String literals
  matching the capstone doc's sample response, then navigate to `Your Offer`.
- **`emiAmount`**: bound via a `Mathematical Expression` referencing `loanAmount`,
  `tenure`, `rateOfInterest` directly — implements `EMI = P × r × (1+r)^n / ((1+r)^n - 1)`
  without calling `calculateEMI()`.
- **`submitBtn`**: on click → set `acknowledgementId` to a String literal → navigate to
  `Done`.

### 4.3 — Custom functions file (written, registered, pending verification)

`scripts/personal-loan-custom-functions.js` exports mocked Tier 1 and Tier 2 API
functions, matching the capstone doc's request/response contracts:

**Tier 1:** `calculateEMI`, `calculateTotalPayable`, `initiateCustomerIdentification`,
`verifyOTPAndGetDemogDetails`, `submitLoanApplication`

**Tier 2:** `panEnquiry`, `getBureauOffer`, `generateEmailOTP`, `validateEmailOTP`

These are registered via **"Form Specific Custom Functions Path"** = `/scripts/personal-loan-custom-functions.js`,
set on both the main form's root `Adaptive Form` node and the `otp-login` fragment's root
node (each authoring context needs its own copy of this property — it does not inherit
across fragment/form boundaries). The file is live and reachable at:
- `https://main--my-forms-project--ambarishsathu108.aem.page/scripts/personal-loan-custom-functions.js`
- `https://main--my-forms-project--ambarishsathu108.aem.live/scripts/personal-loan-custom-functions.js`

Whether AEM Author's Rule Editor can actually invoke them is unresolved (see Section 7).
Even if unresolved, this file still documents the intended real API contracts and is the
correct artifact to extend when Tier 2 wires real `fetch()` calls in place of mocks.

---

## 5. Test Walkthrough (once rules are fully wired)

**Login panel:** Enter a 10-digit mobile number (6–9 start), toggle between PAN/Date of
Birth, fill the shown field, check consent, click **Get OTP**.

**Verify OTP panel:** Enter any 6 digits to succeed; enter `000000` to simulate failure.

**Your Offer panel:** Shows mocked offer (₹10,00,000 / 36 months / 10.20% p.a.), click
**Accept Offer & Calculate EMI**.

**EMI Calculator panel:** Adjust loan amount/tenure — EMI recalculates live via the
Mathematical Expression rule.

**Review & Submit panel:** Read-only summary, check final consent, click **Submit
Application**.

**Done panel:** Shows a generated acknowledgement ID.

---

## 6. Tier 1 Status — Honest Checklist

- [x] 4 Adaptive Form Fragments created, fielded, published (`header`, `otp-login`, `offer-display`, `preview`)
- [x] Main Adaptive Form created with Wizard + 6 panels, all fragments/fields placed
- [x] Custom Functions Path set (main form + `otp-login` fragment)
- [x] PAN/DOB field visibility rule (authoring-driven, no code)
- [x] Custom functions file written for both Tier 1 and Tier 2 mock APIs
- [ ] Get OTP button → panel navigation rule (in progress — needs to be built from the
      main form context, drilling into the embedded fragment's button)
- [ ] Verify OTP button → mock data population + panel navigation rule
- [ ] EMI Mathematical Expression rule
- [ ] Submit button → panel navigation rule
- [ ] Full journey tested end-to-end in Preview mode
- [ ] HDFC theme applied via Theme editor
- [ ] Form + fragments published, linked into an actual EDS page, tested in a real browser

## 7. Known Limitations

- **Custom function invocation from the Rule Editor is unverified.** The
  `initiateCustomerIdentification` function (and others) do not appear in the
  `Function Output` search list inside the Rule Editor, even after confirming the file is
  correctly deployed and publicly reachable. Suspected cause: AEM Author's own Code Sync
  (GitHub → Author, separate from the fast GitHub → EDS CDN publish) lagging or caching a
  failed load state. Workaround adopted: Tier 1 logic uses only built-in Rule Editor
  actions (Show/Hide, Set Value of with String/Mathematical Expression, Navigate among
  panels) instead of custom function calls.
- **Cross-fragment rule navigation is untested.** Whether a rule built on a
  fragment-embedded component (e.g. `getOtpBtn`, which lives inside `otp-login`) can
  target a Wizard panel that only exists in the main form has not been confirmed.
- **`blocks/personal-loan/personal-loan.js` and `personal-loan.css`** in this repo are an
  early hand-coded **prototype only** — they predate the decision to use Universal
  Editor's Adaptive Forms authoring and are **not part of the graded Tier 1 deliverable**.
  They are kept for reference but should not be submitted as the capstone artifact.

---

## 8. Tier 2 Scope (not started)

- `personal-info` fragment (detailed KYC/employer/income screen)
- `bureau-offer` fragment (e-verify income UI)
- Two Advanced Login form variants (DOB-only, PAN-only) duplicated from the main form
- Offer selection UI with persistence across wizard steps
- Editable preview + verified back-navigation without data loss
- OTP retry/attempt-count logic
- Basic analytics event tracking
- Final documentation: API/FDM configuration summary, analytics event list, known
  limitations (this section)

---

## 9. Project File Map

```
my-forms-project/
├── scripts/
│   └── personal-loan-custom-functions.js   ← Registered custom functions (Tier 1 + 2)
├── blocks/personal-loan/                   ← OLD PROTOTYPE — not the deliverable
│   ├── personal-loan.js
│   └── personal-loan.css
├── scripts/api-service.js                  ← OLD PROTOTYPE API layer — not the deliverable
├── scripts/emi-calculator.js               ← OLD PROTOTYPE — not the deliverable
├── scripts/journey-state.js                ← OLD PROTOTYPE — not the deliverable
├── fstab.yaml                              ← AEM Author mount point config
└── CAPSTONE-SETUP.md                       ← This file
```

---

*Document reflects actual build state — kept in sync as authoring work progresses.*
