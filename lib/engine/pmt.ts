// lib/engine/pmt.ts — 원리금균등상환 수학 (스펙 §4.1)

/** 연금리(%) → 월이율(분수) */
export const monthlyRate = (annualPct: number): number => annualPct / 100 / 12;

/** 복리 성장계수. log1p를 사용해 0%에 매우 가까운 금리에서도 정밀도를 유지한다. */
export const growthFactor = (r: number, periods: number): number =>
  r === 0 ? 1 : Math.exp(periods * Math.log1p(r));

/**
 * 월 납입금.
 * @param p 원금(원). 0 이하이면 0 반환 (음수 원금은 호출자(costAt)가 max(...,0)로 방지할 것).
 * @param r 월이율(분수, 0 이상 전제). 반드시 monthlyRate()를 거친 값 — 연이율%를 직접 넣지 말 것.
 * @param n 상환 개월 수. 0 이하이면 0 반환.
 */
export function pmt(p: number, r: number, n: number): number {
  if (p <= 0 || n <= 0) return 0;
  if (r === 0) return p / n;
  const logGrowth = n * Math.log1p(r);
  const growth = Math.exp(logGrowth);
  const growthMinusOne = Math.expm1(logGrowth);
  return (p * r * growth) / growthMinusOne;
}

/** 만기 일시상환액(balloon)을 남기는 월 납입금. */
export function pmtWithBalloon(
  openingBalance: number,
  r: number,
  n: number,
  balloon: number,
): number {
  if (openingBalance <= 0 || n <= 0) return 0;
  const safeBalloon = Math.max(balloon, 0);
  const presentBalloon = safeBalloon / growthFactor(r, n);
  const amortizingPrincipal = openingBalance - presentBalloon;
  const roundingTolerance = Math.max(openingBalance, 1) * Number.EPSILON * 16;
  return pmt(amortizingPrincipal <= roundingTolerance ? 0 : amortizingPrincipal, r, n);
}

/** 임의의 월 납입액을 m회 납입한 뒤 남는 금융잔액. */
export function remBalForPayment(
  openingBalance: number,
  r: number,
  payment: number,
  m: number,
): number {
  if (openingBalance <= 0) return 0;
  const paid = Math.max(m, 0);
  if (r === 0) return Math.max(openingBalance - Math.max(payment, 0) * paid, 0);
  const growthMinusOne = Math.expm1(paid * Math.log1p(r));
  const growth = growthMinusOne + 1;
  return Math.max(
    openingBalance * growth - (Math.max(payment, 0) * growthMinusOne) / r,
    0,
  );
}

/** m회 납입 후 잔여 원금. m은 [0, n]으로 클램프. 파라미터 전제는 pmt()와 동일. */
export function remBal(p: number, r: number, n: number, m: number): number {
  if (p <= 0 || n <= 0) return 0;
  const paid = Math.min(Math.max(m, 0), n);
  if (r === 0) return Math.max(p - (p / n) * paid, 0);
  const growthMinusOne = Math.expm1(paid * Math.log1p(r));
  const growth = growthMinusOne + 1;
  return Math.max(p * growth - (pmt(p, r, n) * growthMinusOne) / r, 0);
}
