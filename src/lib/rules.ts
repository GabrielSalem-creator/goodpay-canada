// Business rules for Transact4Good (Canada-only demo).
export const ESSENTIALS = [
  { id: "electricity", label: "Electricity", icon: "⚡" },
  { id: "heating", label: "Heating", icon: "🔥" },
  { id: "water", label: "Water", icon: "💧" },
  { id: "internet", label: "Internet", icon: "📶" },
  { id: "phone", label: "Phone", icon: "📱" },
  { id: "housing", label: "Rent", icon: "🏠" },
  { id: "groceries", label: "Groceries", icon: "🥫" },
] as const;
export type Category = (typeof ESSENTIALS)[number]["id"];

export function isEssential(category: string): boolean {
  return ESSENTIALS.some((c) => c.id === category);
}
export function categoryMeta(id: string) {
  return ESSENTIALS.find((c) => c.id === id) ?? { id, label: id, icon: "•" };
}

export const PROVINCES = ["QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"] as const;
export const CITIES: Record<string, string> = {
  Montréal: "QC", Laval: "QC", "Québec City": "QC", Gatineau: "QC", Sherbrooke: "QC",
  Toronto: "ON", Ottawa: "ON", Mississauga: "ON", Hamilton: "ON",
  Vancouver: "BC", Surrey: "BC", Calgary: "AB", Edmonton: "AB", Winnipeg: "MB",
  Saskatoon: "SK", Halifax: "NS", Moncton: "NB", "St. John's": "NL", Charlottetown: "PE",
};

export const PAYMENT_METHODS = [
  { id: "bill_payment", label: "Bill payment", hint: "Biller name + account number on your bill" },
  { id: "interac", label: "Interac e-Transfer", hint: "Recipient email or phone" },
  { id: "pad", label: "Pre-authorized debit", hint: "Biller transit + institution + account" },
  { id: "voucher", label: "Merchant voucher", hint: "Store code for groceries" },
] as const;

/** Monthly gross income cap (CAD), loosely based on Canada's low-income cut-offs. */
export function incomeCap(householdSize: number): number {
  const size = Math.max(1, Math.floor(householdSize));
  return 2600 + 800 * (size - 1);
}
export function isEligible(monthlyIncome: number, householdSize: number): boolean {
  return monthlyIncome >= 0 && monthlyIncome <= incomeCap(householdSize);
}

/** Luhn check, used for SIN (9 digits) and card numbers. */
export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 9) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
export function isValidSin(sin: string): boolean {
  const d = sin.replace(/\D/g, "");
  return d.length === 9 && d[0] !== "0" && d[0] !== "8" && luhn(d);
}

/** Amount options a giver can tap: one chunk, two chunks, or the rest. */
export function giftOptions(amount: number, funded: number, chunk: number): number[] {
  const left = Math.max(0, Math.round((amount - funded) * 100) / 100);
  if (left === 0) return [];
  const c = Math.max(1, chunk);
  const opts = [c, c * 2].filter((v) => v < left);
  return [...opts, left];
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
