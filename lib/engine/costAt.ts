// lib/engine/costAt.ts — 항목 1개의 시점별 비용 계산 (스펙 §4.2~4.3)
// 반올림 정책: 엔진은 raw float 유지(취득세만 원 단위 정수 — 세액 도메인 규칙), 표시 반올림은 UI 포맷터 책임.
import { monthlyRate, pmt, remBal } from './pmt';
import { resaleAt } from './resale';
import { isExempt, VAT_FRACTION } from './taxData';
import type { CommonProfile, ExitOption, FinanceItem } from './types';
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

/** 항목 전체 누적지출 (스펙 §4.3). m은 내부에서 [0, months]로 클램프 — 만기 초과 납입·VAT 비대칭 방지. */
export function sunkAt(item: FinanceItem, common: CommonProfile, m: number): number {
  const f = financials(item);
  const count = item.vehicle.count;
  const mc = Math.min(Math.max(m, 0), item.months);
  const yrs = mc / 12;
  return (
    (f.downEach + f.cashExtraEach + f.acqTaxEach) * count +
    f.monthly * mc * count +
    (item.insuranceYr + item.maintenanceYr) * yrs * count -
    common.tradeIn -
    vatRefundCumEach(item, common, mc) * count
  );
}

export interface ExitResult { options: ExitOption[]; best: ExitOption; resaleEach: number }

/** 시점 m(≤months)의 출구 옵션들 (스펙 §4.4) */
export function exitOptionsAt(item: FinanceItem, common: CommonProfile, m: number): ExitResult {
  const f = financials(item);
  const count = item.vehicle.count;
  const sunk = sunkAt(item, common, m);
  const remM = Math.max(item.months - m, 0);
  const atEnd = remM === 0;
  const resaleEach = resaleAt(item, m);
  const resaleTotal = resaleEach * count;
  const ex = item.exit;
  const options: ExitOption[] = [];

  const penalty = remM * f.monthly * (ex.penaltyPct / 100) * count;
  const returnCost = sunk + penalty + (ex.returnInspFee + ex.mileagePenalty) * count;

  if (item.method === 'rent') {
    options.push(
      atEnd
        ? { kind: 'return', label: '만기 반납', cost: returnCost }
        : { kind: 'terminate', label: '중도해지 반납', cost: returnCost },
    );
    if (ex.canTransfer && !atEnd)
      options.push({ kind: 'transfer', label: '계약 승계', cost: sunk + ex.transferFee * count });
  }

  if (item.method === 'oplease') {
    options.push(
      atEnd
        ? { kind: 'return', label: '만기 반납', cost: returnCost }
        : { kind: 'terminate', label: '중도해지 반납', cost: returnCost },
    );
    if (ex.canTransfer && !atEnd)
      options.push({ kind: 'transfer', label: '계약 승계', cost: sunk + ex.transferFee * count });
    options.push({
      kind: 'buyoutSell',
      label: atEnd ? '잔존가 인수 후 매각' : '조기 인수 후 매각',
      cost: sunk + Math.max(f.resEach - ex.earlyDiscount, 0) * count - resaleTotal,
    });
  }

  if (item.method === 'finlease') {
    const debtEach = remBal(f.principal, f.r, item.months, m) + f.resEach;
    options.push({
      kind: 'settleSell',
      label: atEnd ? '잔존가 지급·소유 (시세 반영)' : '조기정산 후 매각',
      cost: sunk + Math.max(debtEach - ex.earlyDiscount, 0) * count - resaleTotal,
    });
    if (ex.canTransfer && !atEnd)
      options.push({ kind: 'transfer', label: '리스 승계', cost: sunk + ex.transferFee * count });
  }

  if (item.method === 'installment') {
    const balEach = remBal(f.principal, f.r, item.months, m);
    options.push({
      kind: 'settleSell',
      label: atEnd ? '보유 (시세 반영)' : '중도상환 후 매각',
      cost: sunk + Math.max(balEach - ex.earlyDiscount, 0) * count - resaleTotal,
    });
  }

  const best = options.reduce((a, b) => (b.cost < a.cost ? b : a));
  return { options, best, resaleEach };
}
