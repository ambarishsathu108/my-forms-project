/**
 * EMI Calculator
 * Implements the standard Equated Monthly Instalment formula for personal loans.
 *
 * Formula: EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
 *   P = Principal loan amount
 *   r = Monthly interest rate (annual rate / 12 / 100)
 *   n = Loan tenure in months
 *
 * Example: P=500000, annualRate=12%, tenure=36 months → EMI ≈ ₹16,607
 */

/**
 * Calculates the monthly EMI for a personal loan.
 * @param {number} principal - Loan amount in INR (P)
 * @param {number} annualInterestRate - Annual interest rate as a percentage (e.g. 10.20 for 10.20%)
 * @param {number} tenureMonths - Loan tenure in months (n)
 * @returns {{ emi: number, totalPayable: number, totalInterest: number }}
 * @throws {Error} If any input is invalid or non-positive
 */
export function calculateEMI(principal, annualInterestRate, tenureMonths) {
  // --- Input validation ---
  if (!principal || principal <= 0) throw new Error('Principal must be a positive number.');
  if (!annualInterestRate || annualInterestRate <= 0) throw new Error('Interest rate must be a positive number.');
  if (!tenureMonths || tenureMonths <= 0) throw new Error('Tenure must be a positive number of months.');

  const P = Number(principal);
  const r = Number(annualInterestRate) / 12 / 100; // Monthly rate
  const n = Number(tenureMonths);

  // EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
  const onePlusRPowN = (1 + r) ** n;
  const emi = (P * r * onePlusRPowN) / (onePlusRPowN - 1);

  const totalPayable = emi * n;
  const totalInterest = totalPayable - P;

  return {
    emi: Math.round(emi),
    totalPayable: Math.round(totalPayable),
    totalInterest: Math.round(totalInterest),
  };
}

/**
 * Formats a number as Indian Rupees currency string.
 * @param {number} amount - The amount to format
 * @returns {string} Formatted string e.g. "₹16,607"
 */
export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parses a rate-of-interest string from the API (e.g. "10.20%") to a number.
 * @param {string} rateStr - Rate string from API response
 * @returns {number} Numeric rate e.g. 10.20
 */
export function parseRateOfInterest(rateStr) {
  if (!rateStr) return 0;
  return parseFloat(String(rateStr).replace('%', '').trim());
}
