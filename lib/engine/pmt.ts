// lib/engine/pmt.ts — 원리금균등상환 수학 (스펙 §4.1)

/** 연금리(%) → 월이율(분수) */
export const monthlyRate = (annualPct: number): number => annualPct / 100 / 12;

/**
 * 월 납입금.
 * @param p 원금(원). 0 이하이면 0 반환 (음수 원금은 호출자(costAt)가 max(...,0)로 방지할 것).
 * @param r 월이율(분수, 0 이상 전제). 반드시 monthlyRate()를 거친 값 — 연이율%를 직접 넣지 말 것.
 * @param n 상환 개월 수. 0 이하이면 0 반환.
 */
export function pmt(p: number, r: number, n: number): number {
  if (p <= 0 || n <= 0) return 0;
  if (r === 0) return p / n;
  const f = Math.pow(1 + r, n);
  return (p * r * f) / (f - 1);
}

/** m회 납입 후 잔여 원금. m은 [0, n]으로 클램프. 파라미터 전제는 pmt()와 동일. */
export function remBal(p: number, r: number, n: number, m: number): number {
  if (p <= 0 || n <= 0) return 0;
  const paid = Math.min(Math.max(m, 0), n);
  if (r === 0) return Math.max(p - (p / n) * paid, 0);
  const f = Math.pow(1 + r, paid);
  return Math.max(p * f - (pmt(p, r, n) * (f - 1)) / r, 0);
}
