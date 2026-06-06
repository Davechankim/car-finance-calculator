// lib/engine/taxData.ts — 세율·한도 상수 (스펙 §4.7, 2024~2025 세법 기준)
import type { BizType, CommonProfile, Method, VehicleCategory } from './types';

export const CAR_COST_LIMIT_YR = 15_000_000; // 업무용승용차 연 비용 한도 (대당)
export const CAR_DEP_LIMIT_YR = 8_000_000;   // 감가상각비(상당액) 연 한도 (대당)
export const VAT_FRACTION = 10 / 110;        // 부가세 포함가 → 부가세액
export const DEP_YEARS = 5;                  // 감가상각 내용연수 (정액)
export const DEP_EQUIV_RATE: Partial<Record<Method, number>> = {
  rent: 0.7,    // 렌트료 중 감가상각비 상당액 비율 (시행규칙)
  oplease: 0.93, // 리스료 중 (보험·세금·정비 차감 근사)
};

export interface CategoryMeta {
  key: VehicleCategory; label: string; acqTaxDefaultPct: number; exempt: boolean;
}
export const CATEGORIES: CategoryMeta[] = [
  { key: 'passenger',  label: '승용차 (한도 적용)',   acqTaxDefaultPct: 7, exempt: false },
  { key: 'compact',    label: '경차',                acqTaxDefaultPct: 4, exempt: true },
  { key: 'van9',       label: '9인승 이상 승합',      acqTaxDefaultPct: 7, exempt: true },
  { key: 'truck',      label: '화물·밴',             acqTaxDefaultPct: 5, exempt: true },
  { key: 'commercial', label: '영업용',              acqTaxDefaultPct: 4, exempt: true },
];
export const categoryMeta = (c: VehicleCategory): CategoryMeta =>
  CATEGORIES.find((x) => x.key === c)!;
export const isExempt = (c: VehicleCategory): boolean => categoryMeta(c).exempt;

export const INDUSTRIES = [
  { label: '서비스업', deductRate: 1 },
  { label: '도소매업', deductRate: 1 },
  { label: '제조업', deductRate: 1 },
  { label: '음식·숙박업', deductRate: 1 },
  { label: '운수업', deductRate: 1 },
  { label: '부동산임대업', deductRate: 0.5 },
];

export const REVENUE_LABELS = ['~3천만', '3~5천만', '5~8천만', '8천만~1.5억', '1.5~3억', '3~5억', '5억~'];
// 매출 → 추정 한계세율 (분수). 매출≠과세표준이므로 보수적 휴리스틱 (스펙 §4.7)
const MARGINAL_MAP: Record<Exclude<BizType, 'none'>, number[]> = {
  personal: [0.06, 0.15, 0.15, 0.24, 0.35, 0.38, 0.40],
  corp:     [0.09, 0.09, 0.09, 0.09, 0.09, 0.19, 0.19],
};

/** 한계세율 (분수). 비사업자 0, 직접입력 우선. */
export function marginalRate(common: CommonProfile): number {
  if (common.biz === 'none') return 0;
  if (common.marginalRateOverride != null) return common.marginalRateOverride / 100;
  return MARGINAL_MAP[common.biz][common.revenueIndex] ?? 0;
}

/** 업종 비용인정비율 (분수) */
export function industryRate(common: CommonProfile): number {
  return INDUSTRIES[common.industryIndex]?.deductRate ?? 1;
}
