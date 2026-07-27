// lib/engine/types.ts — 도메인 타입 (스펙 §3). 엔진 전역에서 금액=원, 퍼센트=% 숫자.
export type Method = 'rent' | 'oplease' | 'finlease' | 'installment';
export type BizType = 'none' | 'personal' | 'corp';
export type VatTaxType = 'general' | 'simplified' | 'exempt' | 'mixedOrUncertain';
export type TaxRuleHorizon = 'approvedOnly' | 'assumeUnchanged';
export type VehicleCategory =
  | 'passenger' | 'compact' | 'van9' | 'van11' | 'truck' | 'commercial';

export interface ModeValue { mode: 'pct' | 'amount'; value: number }
export interface Scenario { atMonths: number; label: string }

export interface CommonProfile {
  biz: BizType;
  vatTaxType: VatTaxType;              // 일반과세자만 VAT 매입세액 공제 검토
  taxRuleHorizon: TaxRuleHorizon;      // 승인 기간 뒤 세법을 반복할지 여부
  taxStartDate: string;                // YYYY-MM-DD 계산·차량 사용 시작일
  industryIndex: number;
  revenueIndex: number;
  marginalRateOverride: number | null; // % 숫자. null이면 매핑 사용
  assetReturnPct: number;
  tradeIn: number;                     // 보상판매 — 항목당 1회 현금 차감
  targetMonths: number;                // 동일 조건 비교를 위한 목표 보유기간
  smallRealEstateCorp: boolean;        // 법인세법상 부동산임대업 주업 소규모 법인 특례
  personalInsuranceRequired: boolean;  // 성실신고확인대상·전문직 등 개인사업자 의무 대상
  scenarios: Scenario[];
}

export interface Vehicle {
  name: string;
  price: number;        // 1대 입력 가격
  priceIncludesVat: boolean; // 세금계산서 거래 등 입력 가격에 VAT가 포함됨
  isUsed: boolean;      // 메타데이터 — 계산 영향 없음 (스펙 §6.5)
  count: number;        // 대수 ≥ 1
  category: VehicleCategory;
}

export interface TaxOptions {
  useDrivingLog: boolean;
  bizUsePct: number;
  hasQualifiedEvidence: boolean;       // 세금계산서 등 적격 증빙·업무 관련성 충족
  isTaxableBusinessAsset: boolean;     // 일반과세 사업용 자산 매각 시 매출 VAT 적용
  hasDedicatedInsurance: boolean;
  corporatePlateRequired: boolean;
  hasCorporatePlate: boolean;
}

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
  buyoutFee: number;      // 인수·소유권 이전 기타비용 (1대당)
}

export interface MonthlyQuoteBreakdown {
  financePayment: number | null; // 금융 원리금·차량대금 월납. null이면 자동 계산
  insurance: number;             // 견적 월납에 포함된 보험료
  vehicleTax: number;            // 견적 월납에 포함된 자동차세
  maintenance: number;           // 견적 월납에 포함된 정비비
  maintenanceBreakdownKnown: boolean; // 운용리스 정비비를 계약서에서 구분할 수 있음
  serviceFee: number;            // 견적 월납에 포함된 서비스·기타 수수료
}

export interface AnnualOperatingCosts {
  insurance: number;
  vehicleTax: number;
  maintenance: number;
}

export interface FinanceItem {
  id: string;
  label?: string;
  method: Method;
  vehicle: Vehicle;
  months: number;                    // rent/oplease 계약기간, finlease/installment 금융기간
  ratePct: number;
  down: ModeValue;                // 1대당 선납금
  deposit: ModeValue | null;      // 1대당 반환형 보증금 (rent/lease)
  residual: ModeValue | null;     // rent/oplease/finlease 만기 잔존가치
  loanAmount: number | null;      // installment만
  monthlyQuote: MonthlyQuoteBreakdown;
  upfrontFee: number;             // 1대당 기타 초기비용
  insuranceYr: number;            // 월납 외 1대당 연 보험료
  vehicleTaxYr: number;           // 월납 외 1대당 연 자동차세
  maintenanceYr: number;          // 월납 외 1대당 연 정비비
  postFinanceAnnualCosts: AnnualOperatingCosts; // 소유형 금융 종료 후 추가 연 비용
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
  ended: boolean;          // rent/oplease가 계약기간을 넘어 만기 값으로 고정됨
  monthly: number;         // 1대당 총 월 현금납입금
  financeMonthly: number;  // 1대당 금융 원리금·차량대금 월납
  monthlyAncillary: number;// 1대당 월 보험·자동차세·정비·서비스비
  principal: number;       // 1대당 최초 금융잔액
  sunk: number;            // 항목 전체 누적지출 (×count, tradeIn·부가세환급 반영)
  resaleEach: number;
  resaleTotal: number;
  exitOptions: ExitOption[];
  bestExit: ExitOption;
  annualDeductible: number; // 1대당 연 인정액 (업무사용비율 적용 후)
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

/** 금융 만기 뒤에도 차량을 계속 보유할 수 있는 방식. */
export function isOwnershipMethod(method: Method): boolean {
  return method === 'finlease' || method === 'installment';
}
