// lib/engine/tax.ts — 업무용승용차 비용 인정·세금절감 (스펙 §4.5)
import {
  cumulativeFinancePaymentsEach, financials, isVatRefundEligible,
  isVehiclePurchaseVatRefundEligible, remainingDebtEach,
} from './costAt';
import {
  annualCostLimit, annualDepLimit, DEP_EQUIV_RATE, DEP_YEARS,
  isBusinessPassengerLimitExempt, marginalRate,
  OPLEASE_UNKNOWN_MAINTENANCE_RATE, taxRuleApplicableMonths, VAT_FRACTION,
} from './taxData';
import type { CommonProfile, FinanceItem } from './types';
import { isOwnershipMethod } from './types';

export interface DeductibleBreakdown {
  annualCost: number;      // 1대당 연비용
  depEquiv: number;        // 1대당 감가상각비(상당액)
  ratio: number;           // 업무사용비율 (분수)
  usedAmount: number;      // 업무사용금액
  depExcess: number;       // 감가 한도 초과 불인정액
  recognizedEach: number;  // 1대당 연 인정액 (업무사용비율 적용 후)
  costLimit: number;
  depLimit: number;
  complianceBlocked: boolean;
}

/** 한도 5단계 — 순수 파츠 버전 (손계산 대조용) */
export function deductibleFromParts(p: {
  annualCost: number; depEquiv: number; exempt: boolean;
  useDrivingLog: boolean; bizUsePct: number;
  costLimit: number; depLimit: number;
}): DeductibleBreakdown {
  let ratio: number;
  if (p.useDrivingLog) ratio = Math.min(Math.max(p.bizUsePct, 0), 100) / 100; // 업무사용비율은 물리적으로 0~100%
  else if (p.exempt) ratio = 1;
  else ratio = p.annualCost > 0 ? Math.min(p.costLimit / p.annualCost, 1) : 1;

  const usedAmount = p.annualCost * ratio;
  const depExcess = p.exempt ? 0 : Math.max(p.depEquiv * ratio - p.depLimit, 0);
  const recognizedEach = Math.max(usedAmount - depExcess, 0);
  return {
    annualCost: p.annualCost,
    depEquiv: p.depEquiv,
    ratio,
    usedAmount,
    depExcess,
    recognizedEach,
    costLimit: p.costLimit,
    depLimit: p.depLimit,
    complianceBlocked: false,
  };
}

/** 실제 금융 원리금 월납 기준 누적 평균 연 금융비용. */
export function annualInterestAt(item: FinanceItem, m: number): number {
  const mc = Math.min(Math.max(m, 0), item.months); // 만기 초과 시 이자 발산 방지 — costAt 모듈 클램프 규약과 동일
  if (mc <= 0) return 0;
  const f = financials(item);
  const yrs = mc / 12;
  const repaid = f.principal - remainingDebtEach(item, mc);
  return Math.max((cumulativeFinancePaymentsEach(item, mc) - repaid) / yrs, 0);
}

export function isComplianceBlocked(item: FinanceItem, common: CommonProfile): boolean {
  if (
    common.biz === 'none' ||
    isBusinessPassengerLimitExempt(item.vehicle.category)
  ) return false;
  const insuranceRequired =
    common.biz === 'corp' || (common.biz === 'personal' && common.personalInsuranceRequired);
  if (insuranceRequired && !item.tax.hasDedicatedInsurance) return true;
  return common.biz === 'corp' &&
    item.tax.corporatePlateRequired &&
    !item.tax.hasCorporatePlate;
}

function financeCostsBetween(
  item: FinanceItem,
  common: CommonProfile,
  start: number,
  end: number,
): { annualCost: number; depEquiv: number; fraction: number } {
  const segmentStart = Math.max(start, 0);
  const segmentEnd = Math.max(end, segmentStart);
  const months = segmentEnd - segmentStart;
  if (months <= 0) return { annualCost: 0, depEquiv: 0, fraction: 0 };
  const fraction = months / 12;
  const f = financials(item, common);
  const vehicleBasis = isVehiclePurchaseVatRefundEligible(item, common)
    ? item.vehicle.price * (1 - VAT_FRACTION)
    : item.vehicle.price;
  // 매입자산 취득가액에는 취득세가 포함된다. 기타 초기비용은 성격이
  // 불명확하므로 사용자가 입력한 전액을 임의로 자본화하지 않는다.
  const depreciationBasis = vehicleBasis + f.acqTaxEach;
  const depStart = Math.min(segmentStart, DEP_YEARS * 12);
  const depEnd = Math.min(segmentEnd, DEP_YEARS * 12);
  const depMonths = Math.max(depEnd - depStart, 0);
  const depSegment = depreciationBasis * (depMonths / (DEP_YEARS * 12));
  const financeStart = Math.min(segmentStart, item.months);
  const financeEnd = Math.min(segmentEnd, item.months);
  const financeMonths = Math.max(financeEnd - financeStart, 0);
  const repaid =
    remainingDebtEach(item, financeStart) - remainingDebtEach(item, financeEnd);
  const financePayments =
    cumulativeFinancePaymentsEach(item, financeEnd) -
    cumulativeFinancePaymentsEach(item, financeStart);
  const interestSegment = Math.max(financePayments - repaid, 0);
  const monthlyMaintenanceBasis = isVatRefundEligible(item, common)
    ? item.monthlyQuote.maintenance * (1 - VAT_FRACTION)
    : item.monthlyQuote.maintenance;
  const bundledMonthlyCost =
    item.monthlyQuote.insurance +
    item.monthlyQuote.vehicleTax +
    monthlyMaintenanceBasis +
    item.monthlyQuote.serviceFee;
  const bundledSegment = bundledMonthlyCost * financeMonths;
  const maintenanceBasis = isVatRefundEligible(item, common)
    ? item.maintenanceYr * (1 - VAT_FRACTION)
    : item.maintenanceYr;
  const ancillaryAnnual =
    item.insuranceYr + item.vehicleTaxYr + maintenanceBasis;
  const postMaintenanceBasis = isVatRefundEligible(item, common)
    ? item.postFinanceAnnualCosts.maintenance * (1 - VAT_FRACTION)
    : item.postFinanceAnnualCosts.maintenance;
  const postFinanceAnnual =
    item.postFinanceAnnualCosts.insurance +
    item.postFinanceAnnualCosts.vehicleTax +
    postMaintenanceBasis;
  const postFinanceStart = Math.max(segmentStart, item.months);
  const postFinanceMonths = Math.max(segmentEnd - postFinanceStart, 0);
  const postFinanceFraction = postFinanceMonths / 12;
  return {
    annualCost:
      (
        depSegment +
        interestSegment +
        bundledSegment +
        ancillaryAnnual * fraction +
        postFinanceAnnual * postFinanceFraction
      ) /
      fraction,
    depEquiv: depSegment / fraction,
    fraction,
  };
}

/** 항목 → 마지막 과세기간의 연환산 파츠 조립 (1대당). */
export function deductibleAt(item: FinanceItem, common: CommonProfile, m: number): DeductibleBreakdown {
  const applicableMonth = taxRuleApplicableMonths(common, m);
  const f = financials(item, common);
  const maintenanceBasis = isVatRefundEligible(item, common)
    ? item.maintenanceYr * (1 - VAT_FRACTION)
    : item.maintenanceYr;
  const ancillary = item.insuranceYr + item.vehicleTaxYr + maintenanceBasis;
  let annualCost: number;
  let depEquiv: number;
  if (item.method === 'rent' || item.method === 'oplease') {
    const deductibleMonthly = item.method === 'rent' && isVatRefundEligible(item, common)
      ? (
          f.monthlyVatTaxable * (1 - VAT_FRACTION) +
          item.monthlyQuote.insurance +
          item.monthlyQuote.vehicleTax
        )
      : f.monthly;
    const annualizedDownGross = item.months > 0
      ? f.downEach * (12 / item.months)
      : 0;
    const annualizedDown =
      item.method === 'rent' && isVatRefundEligible(item, common)
        ? annualizedDownGross * (1 - VAT_FRACTION)
        : annualizedDownGross;
    annualCost = deductibleMonthly * 12 + annualizedDown + ancillary;
    depEquiv = item.method === 'rent'
      ? (
          deductibleMonthly * 12 +
          annualizedDown
        ) * (DEP_EQUIV_RATE.rent ?? 1)
      : item.monthlyQuote.maintenanceBreakdownKnown
        ? (
            (f.financeMonthly + item.monthlyQuote.serviceFee) * 12 +
            annualizedDown
          )
        : (
            (
              f.monthly -
              item.monthlyQuote.insurance -
              item.monthlyQuote.vehicleTax
            ) * 12 +
            annualizedDown
          ) * (1 - OPLEASE_UNKNOWN_MAINTENANCE_RATE);
  } else {
    const mc = applicableMonth;
    const start = mc > 0 ? Math.floor((mc - 1) / 12) * 12 : 0;
    ({ annualCost, depEquiv } = financeCostsBetween(item, common, start, mc));
  }
  const result = deductibleFromParts({
    annualCost, depEquiv,
    exempt: isBusinessPassengerLimitExempt(item.vehicle.category),
    useDrivingLog: item.tax.useDrivingLog,
    bizUsePct: item.tax.bizUsePct,
    costLimit: annualCostLimit(common),
    depLimit: annualDepLimit(common),
  });
  if (common.biz === 'none') return { ...result, recognizedEach: 0 };
  if (!isComplianceBlocked(item, common)) return result;
  return { ...result, recognizedEach: 0, complianceBlocked: true };
}

function cumulativeFinanceDeductible(
  item: FinanceItem,
  common: CommonProfile,
  m: number,
): number {
  if (isComplianceBlocked(item, common)) return 0;
  let total = 0;

  for (let start = 0; start < m; start += 12) {
    const end = Math.min(start + 12, m);
    const { annualCost, depEquiv, fraction } =
      financeCostsBetween(item, common, start, end);
    const breakdown = deductibleFromParts({
      annualCost,
      depEquiv,
      exempt: isBusinessPassengerLimitExempt(item.vehicle.category),
      useDrivingLog: item.tax.useDrivingLog,
      bizUsePct: item.tax.bizUsePct,
      costLimit: annualCostLimit(common),
      depLimit: annualDepLimit(common),
    });
    total += breakdown.recognizedEach * fraction;
  }

  return total;
}

export { taxRuleApplicableMonths } from './taxData';

/** 항목 전체 세금절감 (시점 m) */
export function taxSavingAt(item: FinanceItem, common: CommonProfile, m: number): number {
  const requested = taxRuleApplicableMonths(common, m);
  const mc = isOwnershipMethod(item.method)
    ? requested
    : Math.min(requested, item.months);
  const mr = marginalRate(common);
  if (mr === 0 || mc <= 0) return 0;
  const deductible = item.method === 'rent' || item.method === 'oplease'
    ? deductibleAt(item, common, mc).recognizedEach * (mc / 12)
    : cumulativeFinanceDeductible(item, common, mc);
  return deductible * mr * item.vehicle.count;
}
