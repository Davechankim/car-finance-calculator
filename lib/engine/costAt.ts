// lib/engine/costAt.ts — 항목 1개의 시점별 비용 계산 (스펙 §4.2~4.3)
// 반올림 정책: 엔진은 raw float 유지(취득세만 원 단위 정수 — 세액 도메인 규칙), 표시 반올림은 UI 포맷터 책임.
import {
  growthFactor, monthlyRate, pmt, pmtWithBalloon, remBalForPayment,
} from './pmt';
import { resaleAt } from './resale';
import { COMPACT_ACQ_TAX_RELIEF, isExempt, VAT_FRACTION } from './taxData';
import type { CommonProfile, ExitOption, FinanceItem } from './types';
import { isOwnershipMethod, resolveAmount } from './types';

export interface Financials {
  P: number;            // 1대 차량가
  downEach: number;     // 1대당 선납
  depositEach: number;  // 1대당 반환형 보증금
  resEach: number;      // 1대당 만기 잔존가치 (할부 외)
  principal: number;    // 1대당 최초 금융잔액
  cashExtraEach: number;// 1대당 현금추가 (할부)
  acqTaxEach: number;   // 1대당 취득세 (finlease/installment)
  calculatedMonthly: number; // 금리·기간으로 계산한 1대당 월납
  monthly: number;      // 1대당 월납
  r: number;            // 월이율
}

export function isVatRefundEligible(item: FinanceItem, common: CommonProfile): boolean {
  return common.biz !== 'none' && isExempt(item.vehicle.category);
}

function calculateAcquisitionTax(item: FinanceItem, grossBasis: number): number {
  const tax = Math.round(
    grossBasis * (1 - VAT_FRACTION) * (item.acqTaxRatePct / 100),
  );
  return item.vehicle.category === 'compact'
    ? Math.max(tax - COMPACT_ACQ_TAX_RELIEF, 0)
    : tax;
}

export function financials(item: FinanceItem): Financials {
  const P = item.vehicle.price;
  const downEach = resolveAmount(item.down, P);
  const depositEach = resolveAmount(item.deposit, P);
  const requestedResidual =
    item.method !== 'installment' ? resolveAmount(item.residual, P) : 0;
  const sub = item.subsidy;
  const r = monthlyRate(item.ratePct);

  let principal: number;
  let cashExtraEach = 0;
  if (item.method === 'installment') {
    const cap = Math.max(P - downEach - sub, 0);
    principal = Math.min(item.loanAmount ?? cap, cap);
    cashExtraEach = Math.max(P - downEach - sub - principal, 0);
  } else {
    principal = Math.max(P - downEach - sub, 0);
  }

  // 음수 월납이 필요한 불가능한 조합은 0원 월납으로 바닥 처리하면서,
  // 잔존가도 '무납입 시 최초잔액의 만기 가치' 이내로 제한해 가상 채무를 만들지 않는다.
  const maxResidual =
    item.method === 'installment'
      ? 0
      : principal * growthFactor(r, Math.max(item.months, 0));
  const resEach = Math.min(requestedResidual, maxResidual);

  // 입력 가격은 부가세 포함가다. 지방세법 시행령상 부가가치세는
  // 사실상취득가격에서 제외되므로 환급 가능 여부와 무관하게 공급가액을 쓴다.
  const acqTaxEach =
    item.method === 'finlease' || item.method === 'installment'
      ? calculateAcquisitionTax(item, P)
      : 0;
  const calculatedMonthly = item.method === 'installment'
    ? pmt(principal, r, item.months)
    : pmtWithBalloon(principal, r, item.months, resEach);
  const monthly =
    item.monthlyOverride != null && item.monthlyOverride >= 0
      ? item.monthlyOverride
      : calculatedMonthly;

  return {
    P, downEach, depositEach, resEach, principal, cashExtraEach, acqTaxEach,
    calculatedMonthly, monthly, r,
  };
}

/** 실제 월 납입액을 반영한 1대당 금융잔액. 리스는 계약 잔존가의 현재가치보다 낮아지지 않는다. */
export function remainingDebtEach(item: FinanceItem, mRaw: number): number {
  const m = Math.min(Math.max(mRaw, 0), item.months);
  const f = financials(item);
  const paymentBalance = remBalForPayment(f.principal, f.r, f.monthly, m);
  if (item.method !== 'oplease' && item.method !== 'finlease') return paymentBalance;
  const monthsLeft = item.months - m;
  const balloonFloor = f.resEach / growthFactor(f.r, monthsLeft);
  return Math.max(paymentBalance, balloonFloor);
}

/**
 * 소유형 금융 만기의 1대당 순현금유출.
 * 금융리스는 잔존채무·소유권 이전비용을 지급하고 보증금을 돌려받는다.
 * 할부는 실제 월납액이 부족해 만기에 남은 채무가 있을 때 이를 정산한다.
 */
export function ownershipMaturityNetOutflowEach(item: FinanceItem): number {
  if (item.method === 'finlease') {
    const f = financials(item);
    return remainingDebtEach(item, item.months) + item.exit.buyoutFee - f.depositEach;
  }
  if (item.method === 'installment') {
    return remainingDebtEach(item, item.months);
  }
  return 0;
}

/**
 * 계산 시점. 렌트·운용리스는 계약 만기에 고정하고, 소유형은 금융 만기 뒤의
 * 실제 보유 시점까지 유지비·시세·세금을 계속 계산한다.
 */
export function effectiveMonthAt(item: FinanceItem, mRaw: number): number {
  const requested = Math.max(mRaw, 0);
  return isOwnershipMethod(item.method)
    ? requested
    : Math.min(requested, item.months);
}

/** 1대당 누적 부가세 환급 (스펙 §4.2 각주2). 사업자(일반과세)+한도제외 차량만. */
export function vatRefundCumEach(item: FinanceItem, common: CommonProfile, m: number): number {
  if (!isVatRefundEligible(item, common)) return 0;
  if (item.method === 'rent') {
    const { monthly } = financials(item);
    return monthly * Math.min(m, item.months) * VAT_FRACTION;
  }
  if (item.method === 'finlease' || item.method === 'installment') {
    return item.vehicle.price * VAT_FRACTION; // 초기 1회 (m=0부터 반영)
  }
  return 0; // oplease: 리스료 면세
}

/**
 * 항목 전체 누적지출 (스펙 §4.3).
 * 계약·금융 납입은 months에서 멈춘다. 소유형의 보험·정비는 실제 보유 시점까지
 * 계속되고, 렌트·운용리스는 계약 만기에 고정된다.
 */
export function sunkAt(item: FinanceItem, common: CommonProfile, mRaw: number): number {
  const f = financials(item);
  const count = item.vehicle.count;
  const mc = effectiveMonthAt(item, mRaw);
  const paymentMonths = Math.min(mc, item.months);
  const yrs = mc / 12;
  const maturityNetOutflow =
    isOwnershipMethod(item.method) && mc >= item.months
      ? ownershipMaturityNetOutflowEach(item) * count
      : 0;
  return (
    (f.downEach + f.depositEach + f.cashExtraEach + f.acqTaxEach + item.upfrontFee) * count +
    f.monthly * paymentMonths * count +
    (item.insuranceYr + item.maintenanceYr) * yrs * count -
    common.tradeIn -
    vatRefundCumEach(item, common, paymentMonths) * count +
    maturityNetOutflow
  );
}

export interface ExitResult { options: ExitOption[]; best: ExitOption; resaleEach: number }

/**
 * 시점 m의 출구 옵션들 (스펙 §4.4).
 * 렌트·운용리스는 만기에 고정되고 소유형은 만기 뒤 실제 시세로 매각한다.
 */
export function exitOptionsAt(item: FinanceItem, common: CommonProfile, mRaw: number): ExitResult {
  const m = effectiveMonthAt(item, mRaw);
  const f = financials(item);
  const count = item.vehicle.count;
  const sunk = sunkAt(item, common, m);
  const remM = Math.max(item.months - m, 0);
  const atOrAfterEnd = m >= item.months;
  const resaleEach = resaleAt(item, m);
  const vatEligible = isVatRefundEligible(item, common);
  const taxableResaleTotal =
    (vatEligible ? resaleEach * (1 - VAT_FRACTION) : resaleEach) * count;
  const ex = item.exit;
  const options: ExitOption[] = [];
  const depositReturn = item.method === 'installment' ? 0 : f.depositEach * count;

  const penalty = remM * f.monthly * (ex.penaltyPct / 100) * count;
  const returnCost =
    sunk + penalty + (ex.returnInspFee + ex.mileagePenalty) * count - depositReturn;

  if (item.method === 'rent') {
    options.push(
      atOrAfterEnd
        ? { kind: 'return', label: '만기 반납', cost: returnCost }
        : { kind: 'terminate', label: '중도해지 반납', cost: returnCost },
    );
    if (ex.canTransfer && !atOrAfterEnd)
      options.push({
        kind: 'transfer',
        label: '계약 승계',
        cost: sunk + ex.transferFee * count - depositReturn,
      });
  }

  if (item.method === 'oplease') {
    options.push(
      atOrAfterEnd
        ? { kind: 'return', label: '만기 반납', cost: returnCost }
        : { kind: 'terminate', label: '중도해지 반납', cost: returnCost },
    );
    if (ex.canTransfer && !atOrAfterEnd)
      options.push({
        kind: 'transfer',
        label: '계약 승계',
        cost: sunk + ex.transferFee * count - depositReturn,
      });
    const debtEach = remainingDebtEach(item, m);
    const buyoutEach = Math.max(debtEach - ex.earlyDiscount, 0);
    const buyoutCashEach = vatEligible
      ? buyoutEach * (1 - VAT_FRACTION)
      : buyoutEach;
    const buyoutTaxEach = calculateAcquisitionTax(item, buyoutEach);
    options.push({
      kind: 'buyoutSell',
      label: atOrAfterEnd ? '잔존가 인수 후 매각' : '조기 인수 후 매각',
      cost:
        sunk +
        (buyoutCashEach + buyoutTaxEach + ex.buyoutFee) * count -
        taxableResaleTotal -
        depositReturn,
    });
  }

  if (item.method === 'finlease') {
    const settlementNet =
      atOrAfterEnd
        ? 0
        : (
            Math.max(remainingDebtEach(item, m) - ex.earlyDiscount, 0) +
            ex.buyoutFee
          ) * count - depositReturn;
    options.push({
      kind: 'settleSell',
      label:
        m > item.months
          ? '보유차량 매각 (만기정산 반영)'
          : atOrAfterEnd
            ? '만기정산 후 매각'
            : '조기정산 후 매각',
      cost: sunk + settlementNet - taxableResaleTotal,
    });
    if (ex.canTransfer && !atOrAfterEnd)
      options.push({
        kind: 'transfer',
        label: '리스 승계',
        cost: sunk + ex.transferFee * count - depositReturn,
      });
  }

  if (item.method === 'installment') {
    const settlement =
      atOrAfterEnd
        ? 0
        : Math.max(remainingDebtEach(item, m) - ex.earlyDiscount, 0) * count;
    options.push({
      kind: 'settleSell',
      label:
        m > item.months
          ? '보유차량 매각'
          : atOrAfterEnd
            ? '금융 종료 후 매각'
            : '중도상환 후 매각',
      cost: sunk + settlement - taxableResaleTotal,
    });
  }

  const best = options.reduce((a, b) => (b.cost < a.cost ? b : a));
  return { options, best, resaleEach };
}
