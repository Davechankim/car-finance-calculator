// lib/engine/pmt.ts — 원리금균등상환 수학 (스펙 §4.1)

/** 연금리(%) → 월이율(분수) */
export const monthlyRate = (annualPct: number): number => annualPct / 100 / 12;

/** 월 납입금. p=원금(원), r=월이율(분수), n=개월 */
export function pmt(p: number, r: number, n: number): number {
  if (p <= 0 || n <= 0) return 0;
  if (r === 0) return p / n;
  const f = Math.pow(1 + r, n);
  return (p * r * f) / (f - 1);
}

/** m회 납입 후 잔여 원금 */
export function remBal(p: number, r: number, n: number, m: number): number {
  if (p <= 0 || n <= 0) return 0;
  const paid = Math.min(Math.max(m, 0), n);
  if (r === 0) return Math.max(p - (p / n) * paid, 0);
  const f = Math.pow(1 + r, paid);
  return Math.max(p * f - (pmt(p, r, n) * (f - 1)) / r, 0);
}
