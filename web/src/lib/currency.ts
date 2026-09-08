/**
 * Currency helpers — the app standardizes on Nepali Rupees (Rs.).
 * Use `formatRs` for every financial display; never render a raw `$`.
 */

/** "Rs. 1,250.50" — uses en-IN grouping (lakh/crore style). */
export function formatRs(amount: number, decimals = 2): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) amount = 0;
  const formatted = amount.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `Rs. ${formatted}`;
}

/** Signed variant: "+Rs. 500" / "-Rs. 120". */
export function formatRsSigned(amount: number, decimals = 2): string {
  if (amount > 0) return `+${formatRs(amount, decimals)}`;
  if (amount < 0) return `-${formatRs(Math.abs(amount), decimals)}`;
  return formatRs(0, decimals);
}

export const CURRENCY_SYMBOL = "Rs.";