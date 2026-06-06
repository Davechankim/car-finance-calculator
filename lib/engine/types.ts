// lib/engine/types.ts — 도메인 타입 (스펙 §3). 엔진 전역에서 금액=원, 퍼센트=% 숫자.
export type Method = 'rent' | 'oplease' | 'finlease' | 'installment';
export type BizType = 'none' | 'personal' | 'corp';
export type VehicleCategory = 'passenger' | 'compact' | 'van9' | 'truck' | 'commercial';

export interface ModeValue { mode: 'pct' | 'amount'; value: number }
export interface Scenario { atMonths: number; label: string }

export interface CommonProfile {
  biz: BizType;
  industryIndex: number;
  revenueIndex: number;
  marginalRateOverride: number | null; // % 숫자. null이면 매핑 사용
  assetReturnPct: number;
  tradeIn: number;                     // 보상판매 — 항목당 1회 현금 차감
  scenarios: Scenario[];
}

export interface Vehicle {
  name: string;
  price: number;        // 1대 가격, 부가세 포함 소비자가
  isUsed: boolean;      // 메타데이터 — 계산 영향 없음 (스펙 §6.5)
  count: number;        // 대수 ≥ 1
  category: VehicleCategory;
}

export interface TaxOptions { useDrivingLog: boolean; bizUsePct: number }

export interface Depreciation {
  depRatePct: number;   // 연 감가율
  floorPct: number;     // 최저 잔존비율
  resaleOverrides: { atMonths: number; price: number }[]; // 1대당 시세 직접입력
}

export interface ExitTerms {
  canTransfer: boolean;
  transferFee: number;
  penaltyPct: number;     // 잔여 납입금 대비 위약금 %
  returnInspFee: number;
  mileagePenalty: number;
  earlyDiscount: number;  // 조기인수할인(oplease) / 조기정산·중도상환 감면(finlease/installment)
}

export interface FinanceItem {
  id: string;
  label?: string;
  method: Method;
  vehicle: Vehicle;
  months: number;
  ratePct: number;
  down: ModeValue;                // 1대당 선납금
  residual: ModeValue | null;     // oplease/finlease만
  loanAmount: number | null;      // installment만
  insuranceYr: number;            // 1대당 연 보험료
  maintenanceYr: number;          // 1대당 연 정비비
  subsidy: number;                // 1대당 지원금
  acqTaxRatePct: number;   // 취득세율 % 숫자 (예: 7 → 7%)
  tax: TaxOptions;
  depreciation: Depreciation;
  exit: ExitTerms;
}

export interface ComparisonState { common: CommonProfile; items: FinanceItem[] }

export type ExitKind = 'terminate' | 'transfer' | 'buyoutSell' | 'settleSell' | 'return';
export interface ExitOption { kind: ExitKind; label: string; cost: number }

export interface CostSnapshot {
  m: number;
  ended: boolean;          // m이 계약기간을 넘어 만기 값으로 고정됨
  monthly: number;         // 1대당 월납입금
  principal: number;       // 1대당 금융 원금
  sunk: number;            // 항목 전체 누적지출 (×count, tradeIn·부가세환급 반영)
  resaleEach: number;
  resaleTotal: number;
  exitOptions: ExitOption[];
  bestExit: ExitOption;
  annualDeductible: number; // 1대당 연 인정액 (업종비율 적용 후)
  taxSaving: number;        // 항목 전체
  initialCash: number;      // 항목 전체 초기 현금 지출
  oppCost: number;
  netCost: number;          // 실질순비용 = bestExit.cost − taxSaving + oppCost
}

/** ModeValue → 원 단위 금액. 정책: pct 모드는 원 단위 반올림, amount 모드는 입력값 그대로 (소비자는 중복 반올림 금지). */
export function resolveAmount(mv: ModeValue | null, base: number): number {
  if (!mv) return 0;
  return mv.mode === 'pct' ? Math.round(base * (mv.value / 100)) : mv.value;
}
