// lib/engine/costAt.ts — 항목 1개의 시점별 비용 계산 (스펙 §4.2~4.3)
// 반올림 정책: 엔진은 raw float 유지(취득세만 원 단위 정수 — 세액 도메인 규칙), 표시 반올림은 UI 포맷터 책임.
import {
  growthFactor, monthlyRate, pmt, pmtWithBalloon, remBalForPayment,
} from './pmt';
import { resaleAt } from './resale';
import {
  COMPACT_ACQ_TAX_RELIEF,
  RESALE_OUTPUT_VAT_APPLIES_TO_GENERAL_TAXABLE_BUSINESS_ASSET,
  RESALE_OUTPUT_VAT_USES_GENERAL_RATE_WHEN_MIXED_OR_UNCERTAIN,
  SIMPLIFIED_RESALE_OUTPUT_VAT_VALUE_ADDED_RATES,
  VAT_FRACTION,
  VAT_INPUT_REQUIRES_GENERAL_TAXPAYER,
  VAT_INPUT_REQUIRES_QUALIFIED_EVIDENCE,
  VAT_STATUTORY_RATE,
  isCompactAcquisitionTaxReliefApplicable,
  isTaxRuleApplicableAtMonth,
  isVatInputCreditEligible,
  taxRuleApplicableMonths,
} from './taxData';
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
  financeMonthly: number; // 1대당 금융 원리금·차량대금 월납
  monthlyAncillary: number; // 1대당 월 보험·자동차세·정비·서비스비
  monthlyVatTaxable: number; // 렌트 월납 중 VAT 과세 대상으로 입력된 금액
  monthly: number;      // 1대당 총 월 현금납입
  r: number;            // 월이율
}

export function isVatRefundEligible(item: FinanceItem, common: CommonProfile): boolean {
  return (
    common.biz !== 'none' &&
    (!VAT_INPUT_REQUIRES_GENERAL_TAXPAYER || common.vatTaxType === 'general') &&
    (!VAT_INPUT_REQUIRES_QUALIFIED_EVIDENCE || item.tax.hasQualifiedEvidence) &&
    isVatInputCreditEligible(item.vehicle.category)
  );
}

export function isVehiclePurchaseVatRefundEligible(
  item: FinanceItem,
  common: CommonProfile,
): boolean {
  return item.vehicle.priceIncludesVat && isVatRefundEligible(item, common);
}

/**
 * 사업용 차량 매각의 매출 VAT는 취득 당시 매입세액 공제 여부와 별개다.
 * 일반과세는 10/110, 간이과세는 선택 업종의 법정 부가가치율×10%,
 * 겸영·불확실은 과소계상 방지를 위해 10/110을 보수적으로 적용한다.
 * 승인기간 뒤에도 납부세액을 0원으로 떨어뜨리지 않고 같은 비율을 보수 유지한다.
 * 개인자산·면세사업 전용·포괄적 사업양도 등 예외는 사용자가 끌 수 있다.
 */
export function isResaleOutputVatApplicable(
  item: FinanceItem,
  common: CommonProfile,
  _transactionMonth = 0,
): boolean {
  const regimeSupported =
    common.vatTaxType === 'general'
      ? RESALE_OUTPUT_VAT_APPLIES_TO_GENERAL_TAXABLE_BUSINESS_ASSET
      : common.vatTaxType === 'simplified'
        ? true
        : common.vatTaxType === 'mixedOrUncertain'
          ? RESALE_OUTPUT_VAT_USES_GENERAL_RATE_WHEN_MIXED_OR_UNCERTAIN
          : false;
  return (
    regimeSupported &&
    common.biz !== 'none' &&
    item.tax.isTaxableBusinessAsset
  );
}

/** VAT 포함 예상 매각대금에서 납부 VAT로 차감할 비율. */
export function resaleOutputVatFraction(
  item: FinanceItem,
  common: CommonProfile,
  transactionMonth = 0,
): number {
  if (!isResaleOutputVatApplicable(item, common, transactionMonth)) return 0;
  if (common.vatTaxType === 'simplified') {
    const valueAddedRate =
      SIMPLIFIED_RESALE_OUTPUT_VAT_VALUE_ADDED_RATES[common.industryIndex]
      ?? Math.max(...SIMPLIFIED_RESALE_OUTPUT_VAT_VALUE_ADDED_RATES);
    return valueAddedRate * VAT_STATUTORY_RATE;
  }
  if (
    common.vatTaxType === 'general'
    || (
      common.vatTaxType === 'mixedOrUncertain'
      && RESALE_OUTPUT_VAT_USES_GENERAL_RATE_WHEN_MIXED_OR_UNCERTAIN
    )
  ) {
    return VAT_FRACTION;
  }
  return 0;
}

function calculateAcquisitionTax(
  item: FinanceItem,
  grossBasis: number,
  basisIncludesVat = true,
  compactReliefApplies = true,
): number {
  const supplyBasis = basisIncludesVat
    ? grossBasis * (1 - VAT_FRACTION)
    : grossBasis;
  const tax = Math.round(
    supplyBasis * (item.acqTaxRatePct / 100),
  );
  return item.vehicle.category === 'compact' && compactReliefApplies
    ? Math.max(tax - COMPACT_ACQ_TAX_RELIEF, 0)
    : tax;
}

export function financials(
  item: FinanceItem,
  common?: CommonProfile,
): Financials {
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

  // VAT 포함 거래는 지방세법상 사실상취득가격에서 VAT를 제외하고,
  // 개인 간 중고거래처럼 VAT가 없는 입력 가격은 전액을 과표로 쓴다.
  const acqTaxEach =
    item.method === 'finlease' || item.method === 'installment'
      ? calculateAcquisitionTax(
          item,
          P,
          item.vehicle.priceIncludesVat,
          common
            ? isCompactAcquisitionTaxReliefApplicable(common, 0)
            : true,
        )
      : 0;
  const calculatedMonthly = item.method === 'installment'
    ? pmt(principal, r, item.months)
    : pmtWithBalloon(principal, r, item.months, resEach);
  const financeMonthly =
    item.monthlyQuote.financePayment != null && item.monthlyQuote.financePayment >= 0
      ? item.monthlyQuote.financePayment
      : calculatedMonthly;
  const monthlyAncillary =
    item.monthlyQuote.insurance +
    item.monthlyQuote.vehicleTax +
    item.monthlyQuote.maintenance +
    item.monthlyQuote.serviceFee;
  const monthlyVatTaxable =
    financeMonthly +
    item.monthlyQuote.maintenance +
    item.monthlyQuote.serviceFee;
  const monthly = financeMonthly + monthlyAncillary;

  return {
    P, downEach, depositEach, resEach, principal, cashExtraEach, acqTaxEach,
    calculatedMonthly, financeMonthly, monthlyAncillary, monthlyVatTaxable, monthly, r,
  };
}

/** 실제 금융 원리금 월납을 반영한 1대당 금융잔액. 리스는 계약 잔존가의 현재가치보다 낮아지지 않는다. */
export function remainingDebtEach(item: FinanceItem, mRaw: number): number {
  const m = Math.min(Math.max(mRaw, 0), item.months);
  const f = financials(item);
  const paymentBalance = remBalForPayment(f.principal, f.r, f.financeMonthly, m);
  if (item.method !== 'oplease' && item.method !== 'finlease') return paymentBalance;
  const monthsLeft = item.months - m;
  const balloonFloor = f.resEach / growthFactor(f.r, monthsLeft);
  return Math.max(paymentBalance, balloonFloor);
}

/**
 * 실제 누적 금융납입액(1대당).
 * 할부는 각 회차의 발생 이자를 포함한 잔액까지만 납입하므로 큰 실납입액을
 * 입력해도 조기 완납 뒤 가상의 납입·이자가 계속 쌓이지 않는다.
 * 리스·렌트는 잔존가 계약을 포함한 약정 월납 규약을 그대로 유지한다.
 */
export function cumulativeFinancePaymentsEach(
  item: FinanceItem,
  mRaw: number,
): number {
  const paidMonths = Math.min(Math.max(mRaw, 0), item.months);
  const f = financials(item);
  if (item.method !== 'installment') return f.financeMonthly * paidMonths;
  if (paidMonths <= 0 || f.principal <= 0 || f.financeMonthly <= 0) return 0;

  const wholeMonths = Math.floor(paidMonths);
  let balance = f.principal;
  let total = 0;
  for (let month = 0; month < wholeMonths && balance > 0; month += 1) {
    const due = balance * (1 + f.r);
    const paid = Math.min(f.financeMonthly, due);
    total += paid;
    balance = Math.max(due - paid, 0);
  }

  const partialMonth = paidMonths - wholeMonths;
  if (partialMonth > 0 && balance > 0) {
    const due = balance * growthFactor(f.r, partialMonth);
    total += Math.min(f.financeMonthly * partialMonth, due);
  }
  return total;
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

/** 소유형 금융 종료 뒤 추가 연간비용이 적용되는 누적 연수. */
export function postFinanceYearsAt(item: FinanceItem, mRaw: number): number {
  if (!isOwnershipMethod(item.method)) return 0;
  return Math.max(effectiveMonthAt(item, mRaw) - item.months, 0) / 12;
}

/**
 * 1대당 누적 부가세 환급.
 * 일반과세자·VAT 적격 차종·적격증빙을 모두 충족한 경우에만 차량 매입,
 * 렌트 과세분과 별도 정비비의 매입세액을 반영한다.
 */
export function vatRefundCumEach(
  item: FinanceItem,
  common: CommonProfile,
  mRaw: number,
): number {
  if (!isVatRefundEligible(item, common)) return 0;
  const m = effectiveMonthAt(item, mRaw);
  const applicableMonths = taxRuleApplicableMonths(common, m);
  const appliesAtStart = isTaxRuleApplicableAtMonth(common, 0);
  const annualMaintenanceGross =
    item.maintenanceYr * (applicableMonths / 12) +
    item.postFinanceAnnualCosts.maintenance *
      (Math.max(applicableMonths - item.months, 0) / 12);
  const maintenanceRefund = annualMaintenanceGross * VAT_FRACTION;
  if (item.method === 'rent') {
    const { downEach, monthlyVatTaxable } = financials(item);
    return (
      (
        (appliesAtStart ? downEach : 0) +
        monthlyVatTaxable * Math.min(applicableMonths, item.months)
      ) * VAT_FRACTION +
      maintenanceRefund
    );
  }
  if (item.method === 'finlease' || item.method === 'installment') {
    const monthlyMaintenanceRefund =
      item.monthlyQuote.maintenance *
      Math.min(applicableMonths, item.months) *
      VAT_FRACTION;
    const vehiclePurchaseRefund = appliesAtStart && item.vehicle.priceIncludesVat
      ? item.vehicle.price * VAT_FRACTION
      : 0;
    return vehiclePurchaseRefund + monthlyMaintenanceRefund + maintenanceRefund;
  }
  return maintenanceRefund; // 운용리스료 자체는 면세, 별도 정비비만 검토
}

/**
 * 항목 전체 누적지출 (스펙 §4.3).
 * 계약·금융 납입은 months에서 멈춘다. 소유형의 보험·정비는 실제 보유 시점까지
 * 계속되고, 렌트·운용리스는 계약 만기에 고정된다.
 */
export function sunkAt(item: FinanceItem, common: CommonProfile, mRaw: number): number {
  const f = financials(item, common);
  const count = item.vehicle.count;
  const mc = effectiveMonthAt(item, mRaw);
  const paymentMonths = Math.min(mc, item.months);
  const yrs = mc / 12;
  const postFinanceYears = postFinanceYearsAt(item, mc);
  const regularAnnualCosts =
    item.insuranceYr + item.vehicleTaxYr + item.maintenanceYr;
  const postFinanceAnnualCosts =
    item.postFinanceAnnualCosts.insurance +
    item.postFinanceAnnualCosts.vehicleTax +
    item.postFinanceAnnualCosts.maintenance;
  const maturityNetOutflow =
    isOwnershipMethod(item.method) && mc >= item.months
      ? ownershipMaturityNetOutflowEach(item) * count
      : 0;
  return (
    (f.downEach + f.depositEach + f.cashExtraEach + f.acqTaxEach + item.upfrontFee) * count +
    (
      cumulativeFinancePaymentsEach(item, paymentMonths) +
      f.monthlyAncillary * paymentMonths
    ) * count +
    regularAnnualCosts * yrs * count +
    postFinanceAnnualCosts * postFinanceYears * count -
    common.tradeIn -
    vatRefundCumEach(item, common, mc) * count +
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
  const f = financials(item, common);
  const count = item.vehicle.count;
  const sunk = sunkAt(item, common, m);
  const remM = Math.max(item.months - m, 0);
  const atOrAfterEnd = m >= item.months;
  const resaleEach = resaleAt(item, m);
  const inputVatRecoverable =
    isVatRefundEligible(item, common) &&
    isTaxRuleApplicableAtMonth(common, m);
  const resaleVatFraction = resaleOutputVatFraction(item, common, m);
  const taxableResaleTotal = resaleEach * (1 - resaleVatFraction) * count;
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
    const buyoutCashEach = inputVatRecoverable
      ? buyoutEach * (1 - VAT_FRACTION)
      : buyoutEach;
    // 세율은 보수 유지하되 명시적인 경차 감면 일몰은 거래일에 맞춰 종료한다.
    const buyoutTaxEach = calculateAcquisitionTax(
      item,
      buyoutEach,
      true,
      isCompactAcquisitionTaxReliefApplicable(common, m),
    );
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
