// lib/engine/taxData.ts — 세율·한도 상수 (2026 추정 세율·업무용승용차 특례)
// 브라우저 계산 번들에는 Zod 기반 관리자 검증기를 싣지 않고, 같은 승인 JSON의
// 수치만 읽는다. snapshot.test.ts와 taxData.test.ts가 배포 전에 전체 스키마와
// 엔진 연결을 함께 검증한다.
import approvedTaxRule from '../../tax-rules/approved/KR/2026.json';
import type { BizType, CommonProfile, Method, VehicleCategory } from './types';

const RULES = approvedTaxRule.rules;

/** 계산 결과를 재현하는 승인 세법 규칙 버전. */
export const TAX_RULE_SET_ID = approvedTaxRule.id;
export const TAX_RULE_EFFECTIVE_FROM = approvedTaxRule.effectiveFrom;
export const TAX_RULE_EFFECTIVE_THROUGH = approvedTaxRule.effectiveThrough;
export const CAR_COST_LIMIT_YR = RULES.businessPassengerCar.annualCostLimitWon;
export const CAR_DEP_LIMIT_YR =
  RULES.businessPassengerCar.annualDepreciationLimitWon;
export const VAT_FRACTION =
  RULES.vat.includedTaxNumerator / RULES.vat.includedPriceDenominator;
export const VAT_INPUT_REQUIRES_GENERAL_TAXPAYER =
  RULES.vat.inputCreditRequiresGeneralTaxpayer;
export const VAT_INPUT_REQUIRES_QUALIFIED_EVIDENCE =
  RULES.vat.inputCreditRequiresQualifiedEvidence;
export const RESALE_OUTPUT_VAT_APPLIES_TO_GENERAL_TAXABLE_BUSINESS_ASSET =
  RULES.vat.resaleOutputVatAppliesToGeneralTaxableBusinessAsset;
export const RESALE_OUTPUT_VAT_USES_GENERAL_RATE_WHEN_MIXED_OR_UNCERTAIN =
  RULES.vat.resaleOutputVatUsesGeneralRateWhenMixedOrUncertain;
export const SIMPLIFIED_RESALE_OUTPUT_VAT_VALUE_ADDED_RATES = [
  RULES.vat.simplifiedResaleOutputVatValueAddedRateByIndustry.service,
  RULES.vat.simplifiedResaleOutputVatValueAddedRateByIndustry.retail,
  RULES.vat.simplifiedResaleOutputVatValueAddedRateByIndustry.manufacturing,
  RULES.vat.simplifiedResaleOutputVatValueAddedRateByIndustry.foodOrLodging,
  RULES.vat.simplifiedResaleOutputVatValueAddedRateByIndustry.transport,
  RULES.vat.simplifiedResaleOutputVatValueAddedRateByIndustry.realEstateRental,
] as const;
export const VAT_STATUTORY_RATE =
  RULES.vat.includedTaxNumerator /
  (RULES.vat.includedPriceDenominator - RULES.vat.includedTaxNumerator);
export const DEP_YEARS = RULES.depreciation.years;
/** 승인 스냅샷 전체 달 수. 실제 적용 가능 기간은 taxRuleMonthsFrom(startDate)로 계산한다. */
export const TAX_RULE_HORIZON_MONTHS = (() => {
  const [fromYear, fromMonth] = approvedTaxRule.effectiveFrom.split('-').map(Number);
  const [throughYear, throughMonth] = approvedTaxRule.effectiveThrough.split('-').map(Number);
  return Math.max((throughYear - fromYear) * 12 + throughMonth - fromMonth + 1, 0);
})();

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? parsed
    : null;
}

function addUtcMonthsClamped(date: Date, months: number): Date {
  const targetYear = date.getUTCFullYear() + Math.floor(
    (date.getUTCMonth() + months) / 12,
  );
  const targetMonth = ((date.getUTCMonth() + months) % 12 + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(date.getUTCDate(), lastDay),
  ));
}

/** 계산 시작일부터 현재 승인 스냅샷 종료일까지 남은 달 수(부분월 포함). */
export function taxRuleMonthsFrom(startDate: string): number {
  const start = parseIsoDate(startDate);
  const effectiveFrom = parseIsoDate(TAX_RULE_EFFECTIVE_FROM);
  const effectiveThrough = parseIsoDate(TAX_RULE_EFFECTIVE_THROUGH);
  if (
    !start
    || !effectiveFrom
    || !effectiveThrough
    || start < effectiveFrom
    || start > effectiveThrough
  ) {
    return 0;
  }
  const endExclusive = new Date(effectiveThrough);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  let wholeMonths =
    (endExclusive.getUTCFullYear() - start.getUTCFullYear()) * 12
    + endExclusive.getUTCMonth() - start.getUTCMonth();
  let anchor = addUtcMonthsClamped(start, wholeMonths);
  if (anchor > endExclusive) {
    wholeMonths -= 1;
    anchor = addUtcMonthsClamped(start, wholeMonths);
  }
  const next = addUtcMonthsClamped(start, wholeMonths + 1);
  const fraction = next > anchor
    ? (endExclusive.getTime() - anchor.getTime()) /
      (next.getTime() - anchor.getTime())
    : 0;
  return Math.max(wholeMonths + Math.min(Math.max(fraction, 0), 1), 0);
}

/** 승인 세법을 비교 시작일부터 요청 시점까지 몇 개월 사용할지 결정한다. */
export function taxRuleApplicableMonths(
  common: CommonProfile,
  requestedMonths: number,
): number {
  const requested = Math.max(requestedMonths, 0);
  return common.taxRuleHorizon === 'assumeUnchanged'
    ? requested
    : Math.min(requested, taxRuleMonthsFrom(common.taxStartDate));
}

/** VAT 환급처럼 한 시점에 발생하는 세금 혜택이 승인 범위 안인지 판정한다. */
export function isTaxRuleApplicableAtMonth(
  common: CommonProfile,
  transactionMonth: number,
): boolean {
  if (common.taxRuleHorizon === 'assumeUnchanged') return true;
  const availableMonths = taxRuleMonthsFrom(common.taxStartDate);
  return availableMonths > 0
    && Math.max(transactionMonth, 0) < availableMonths;
}
export const COMPACT_ACQ_TAX_RELIEF =
  RULES.compactAcquisitionTaxRelief.amountWon;
export const COMPACT_ACQ_TAX_RELIEF_EFFECTIVE_THROUGH =
  RULES.compactAcquisitionTaxRelief.effectiveThrough;

/** 시작일부터 월 단위 경과시점의 실제 UTC 날짜(부분월은 인접 월 사이 선형 보간). */
function dateAtMonth(startDate: string, transactionMonth: number): Date | null {
  const start = parseIsoDate(startDate);
  if (!start) return null;
  const elapsed = Math.max(transactionMonth, 0);
  const wholeMonths = Math.floor(elapsed);
  const fraction = elapsed - wholeMonths;
  const anchor = addUtcMonthsClamped(start, wholeMonths);
  if (fraction === 0) return anchor;
  const next = addUtcMonthsClamped(start, wholeMonths + 1);
  return new Date(
    anchor.getTime() + (next.getTime() - anchor.getTime()) * fraction,
  );
}

/** 경차 취득 거래일이 명시적 감면 일몰일 안인지 판정한다. */
export function isCompactAcquisitionTaxReliefApplicable(
  common: CommonProfile,
  transactionMonth: number,
): boolean {
  const transactionDate = dateAtMonth(common.taxStartDate, transactionMonth);
  const effectiveThrough = parseIsoDate(COMPACT_ACQ_TAX_RELIEF_EFFECTIVE_THROUGH);
  if (!transactionDate || !effectiveThrough) return false;
  const endExclusive = new Date(effectiveThrough);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return transactionDate < endExclusive;
}
// finlease/installment는 실제 감가상각비(P/DEP_YEARS)를 별도 계산하므로 여기서 의도적으로 제외
export const DEP_EQUIV_RATE: Partial<Record<Method, number>> = {
  rent: RULES.depreciation.equivalentRateByMethod.rent,
};
export const OPLEASE_UNKNOWN_MAINTENANCE_RATE =
  RULES.depreciation.operatingLeaseUnknownMaintenanceRate;

export interface CategoryMeta {
  key: VehicleCategory;
  label: string;
  acqTaxDefaultPct: number;
  businessPassengerCostLimitExempt: boolean;
  vatInputCreditEligible: boolean;
}
export const CATEGORIES: CategoryMeta[] = [
  {
    key: 'passenger',
    label: '승용차 (한도 적용)',
    acqTaxDefaultPct: RULES.acquisitionTaxDefaultPct.passenger,
    businessPassengerCostLimitExempt:
      RULES.businessPassengerCostLimitExemptByCategory.passenger,
    vatInputCreditEligible: RULES.vatInputCreditEligibleByCategory.passenger,
  },
  {
    key: 'compact',
    label: '경차',
    acqTaxDefaultPct: RULES.acquisitionTaxDefaultPct.compact,
    businessPassengerCostLimitExempt:
      RULES.businessPassengerCostLimitExemptByCategory.compact,
    vatInputCreditEligible: RULES.vatInputCreditEligibleByCategory.compact,
  },
  {
    key: 'van9',
    label: '9~10인승 승용',
    acqTaxDefaultPct: RULES.acquisitionTaxDefaultPct.van9,
    businessPassengerCostLimitExempt:
      RULES.businessPassengerCostLimitExemptByCategory.van9,
    vatInputCreditEligible: RULES.vatInputCreditEligibleByCategory.van9,
  },
  {
    key: 'van11',
    label: '11인승 이상 승합',
    acqTaxDefaultPct: RULES.acquisitionTaxDefaultPct.van11,
    businessPassengerCostLimitExempt:
      RULES.businessPassengerCostLimitExemptByCategory.van11,
    vatInputCreditEligible: RULES.vatInputCreditEligibleByCategory.van11,
  },
  {
    key: 'truck',
    label: '화물·밴',
    acqTaxDefaultPct: RULES.acquisitionTaxDefaultPct.truck,
    businessPassengerCostLimitExempt:
      RULES.businessPassengerCostLimitExemptByCategory.truck,
    vatInputCreditEligible: RULES.vatInputCreditEligibleByCategory.truck,
  },
  {
    key: 'commercial',
    label: '영업용',
    acqTaxDefaultPct: RULES.acquisitionTaxDefaultPct.commercial,
    businessPassengerCostLimitExempt:
      RULES.businessPassengerCostLimitExemptByCategory.commercial,
    vatInputCreditEligible: RULES.vatInputCreditEligibleByCategory.commercial,
  },
];
export const categoryMeta = (c: VehicleCategory): CategoryMeta => {
  const m = CATEGORIES.find((x) => x.key === c);
  if (!m) throw new Error(`categoryMeta: unknown category "${c}"`);
  return m;
};

// VehicleCategory의 모든 키가 CATEGORIES에 존재하는지 컴파일 타임에 보장
const _categoryExhaustive: Record<VehicleCategory, true> = {
  passenger: true, compact: true, van9: true, van11: true, truck: true, commercial: true,
};
void _categoryExhaustive;
export const isBusinessPassengerLimitExempt = (c: VehicleCategory): boolean =>
  categoryMeta(c).businessPassengerCostLimitExempt;
export const isVatInputCreditEligible = (c: VehicleCategory): boolean =>
  categoryMeta(c).vatInputCreditEligible;

export const INDUSTRIES = [
  { label: '서비스업 (보수 40%)' },
  { label: '소매업' },
  { label: '제조업' },
  { label: '음식·숙박업 (보수 25%)' },
  { label: '운수업 (보수 30%)' },
  { label: '부동산임대업' },
];

export const REVENUE_LABELS = ['~3천만', '3~5천만', '5~8천만', '8천만~1.5억', '1.5~3억', '3~5억', '5억~'];
// 매출 → 추정 한계세율 (분수). 매출≠과세표준이므로 보수적 휴리스틱 (스펙 §4.7)
// REVENUE_LABELS와 길이(7)가 항상 일치해야 한다.
// 최고세율 45%(과세표준 10억 초과)는 매출≠과세표준 보수 가정으로 의도적으로 미사용.
const MARGINAL_MAP: Record<Exclude<BizType, 'none'>, number[]> = {
  personal: [...RULES.estimatedMarginalRateByRevenueBand.personal],
  corp: [...RULES.estimatedMarginalRateByRevenueBand.corp],
};

/** 한계세율 (분수). 비사업자 0, 직접입력 우선. */
export function marginalRate(common: CommonProfile): number {
  if (common.biz === 'none') return 0;
  if (common.marginalRateOverride != null) return common.marginalRateOverride / 100;
  return MARGINAL_MAP[common.biz][common.revenueIndex] ?? 0;
}

/** 업무용승용차 무기록부 연간 한도. 소규모 부동산임대 주업법인은 500만원. */
export function annualCostLimit(common: CommonProfile): number {
  return common.biz === 'corp' && common.smallRealEstateCorp
    ? RULES.businessPassengerCar.smallRealEstateCorpAnnualCostLimitWon
    : CAR_COST_LIMIT_YR;
}

/** 감가상각비(상당액) 연간 한도. 소규모 부동산임대 주업법인은 400만원. */
export function annualDepLimit(common: CommonProfile): number {
  return common.biz === 'corp' && common.smallRealEstateCorp
    ? RULES.businessPassengerCar.smallRealEstateCorpAnnualDepreciationLimitWon
    : CAR_DEP_LIMIT_YR;
}
