// lib/engine/costAt.ts — 항목 1개의 시점별 비용 계산 (스펙 §4.2~4.3)
import { monthlyRate, pmt } from './pmt';
import { isExempt, VAT_FRACTION } from './taxData';
import type { CommonProfile, FinanceItem } from './types';
import { resolveAmount } from './types';

export interface Financials {
  P: number;            // 1대 차량가
  downEach: number;     // 1대당 선납
  resEach: number;      // 1대당 잔존가치 (리스 계열 외 0)
  principal: number;    // 1대당 금융 원금
  cashExtraEach: number;// 1대당 현금추가 (할부)
  acqTaxEach: number;   // 1대당 취득세 (finlease/installment)
  monthly: number;      // 1대당 월납
  r: number;            // 월이율
}

export function financials(item: FinanceItem): Financials {
  const P = item.vehicle.price;
  const downEach = resolveAmount(item.down, P);
  const resEach =
    item.method === 'oplease' || item.method === 'finlease' ? resolveAmount(item.residual, P) : 0;
  const sub = item.subsidy;
  const r = monthlyRate(item.ratePct);

  let principal: number;
  let cashExtraEach = 0;
  if (item.method === 'installment') {
    const cap = Math.max(P - downEach - sub, 0);
    principal = Math.min(item.loanAmount ?? cap, cap);
    cashExtraEach = Math.max(P - downEach - sub - principal, 0);
  } else {
    principal = Math.max(P - downEach - resEach - sub, 0);
  }

  const acqTaxEach =
    item.method === 'finlease' || item.method === 'installment'
      ? Math.round(P * (item.acqTaxRatePct / 100))
      : 0;

  return { P, downEach, resEach, principal, cashExtraEach, acqTaxEach, monthly: pmt(principal, r, item.months), r };
}

/** 1대당 누적 부가세 환급 (스펙 §4.2 각주2). 사업자(일반과세)+한도제외 차량만. */
export function vatRefundCumEach(item: FinanceItem, common: CommonProfile, m: number): number {
  if (common.biz === 'none' || !isExempt(item.vehicle.category)) return 0;
  if (item.method === 'rent') {
    const { monthly } = financials(item);
    return monthly * Math.min(m, item.months) * VAT_FRACTION;
  }
  if (item.method === 'finlease' || item.method === 'installment') {
    return item.vehicle.price * VAT_FRACTION; // 초기 1회 (m=0부터 반영)
  }
  return 0; // oplease: 리스료 면세
}

/** 항목 전체 누적지출 (스펙 §4.3). m은 호출자가 계약기간 내로 클램프. */
export function sunkAt(item: FinanceItem, common: CommonProfile, m: number): number {
  const f = financials(item);
  const count = item.vehicle.count;
  const yrs = m / 12;
  return (
    (f.downEach + f.cashExtraEach + f.acqTaxEach) * count +
    f.monthly * m * count +
    (item.insuranceYr + item.maintenanceYr) * yrs * count -
    common.tradeIn -
    vatRefundCumEach(item, common, m) * count
  );
}
