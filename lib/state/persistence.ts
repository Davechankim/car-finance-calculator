import type {
  BizType, ComparisonState, FinanceItem, Method, ModeValue, VehicleCategory,
} from '@/lib/engine/types';
import { defaultState, newItem, nextId } from './defaults';

export const STORAGE_KEY = 'car-finance-calculator:comparison:v1';
export const PERSISTENCE_VERSION = 1;
export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_ITEMS = 50;
export const MAX_SCENARIOS = 40;
export const MAX_RESALE_OVERRIDES = 40;

const METHODS: Method[] = ['rent', 'oplease', 'finlease', 'installment'];
const BIZ_TYPES: BizType[] = ['none', 'personal', 'corp'];
const CATEGORIES: VehicleCategory[] = [
  'passenger', 'compact', 'van9', 'van11', 'truck', 'commercial',
];

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (value: unknown, fallback: number, min = -Infinity, max = Infinity): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const integer = (value: unknown, fallback: number, min: number, max: number): number =>
  Math.round(finite(value, fallback, min, max));

const money = (value: unknown, fallback: number, max = 10_000_000_000): number =>
  Math.round(finite(value, fallback, 0, max));

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const text = (value: unknown, fallback = '', max = 100): string =>
  typeof value === 'string' ? value.slice(0, max) : fallback;

function modeValue(value: unknown, fallback: ModeValue): ModeValue {
  if (!isRecord(value)) return fallback;
  const mode = value.mode === 'pct' || value.mode === 'amount' ? value.mode : fallback.mode;
  return {
    mode,
    value: mode === 'pct'
      ? finite(value.value, fallback.value, 0, 100)
      : money(value.value, fallback.value),
  };
}

function parseCommon(raw: unknown): ComparisonState['common'] {
  const fallback = defaultState().common;
  if (!isRecord(raw)) return fallback;
  const biz = BIZ_TYPES.includes(raw.biz as BizType) ? raw.biz as BizType : fallback.biz;
  const seen = new Set<number>();
  if (Array.isArray(raw.scenarios) && raw.scenarios.length > MAX_SCENARIOS) {
    throw new Error(`비교 시나리오는 최대 ${MAX_SCENARIOS}개까지 가져올 수 있습니다.`);
  }
  const scenarios = Array.isArray(raw.scenarios)
    ? raw.scenarios.flatMap((value) => {
        if (!isRecord(value)) return [];
        const atMonths = integer(value.atMonths, 3, 3, 120);
        if (seen.has(atMonths)) return [];
        seen.add(atMonths);
        return [{ atMonths, label: text(value.label, `${atMonths}개월 후`, 40) }];
      })
    : fallback.scenarios;

  return {
    biz,
    industryIndex: integer(raw.industryIndex, fallback.industryIndex, 0, 5),
    revenueIndex: integer(raw.revenueIndex, fallback.revenueIndex, 0, 6),
    marginalRateOverride:
      typeof raw.marginalRateOverride === 'number' &&
      Number.isFinite(raw.marginalRateOverride)
        ? finite(raw.marginalRateOverride, 0, 0, 100)
        : fallback.marginalRateOverride,
    assetReturnPct: finite(raw.assetReturnPct, fallback.assetReturnPct, -100, 100),
    tradeIn: money(raw.tradeIn, fallback.tradeIn),
    targetMonths: integer(raw.targetMonths, fallback.targetMonths, 3, 120),
    smallRealEstateCorp: biz === 'corp' && bool(raw.smallRealEstateCorp, false),
    personalInsuranceRequired:
      biz === 'personal' && bool(raw.personalInsuranceRequired, false),
    scenarios,
  };
}

function parseItem(raw: unknown): FinanceItem | null {
  if (!isRecord(raw) || !METHODS.includes(raw.method as Method)) return null;
  const method = raw.method as Method;
  const fallback = newItem(method);
  const vehicle = isRecord(raw.vehicle) ? raw.vehicle : {};
  const tax = isRecord(raw.tax) ? raw.tax : {};
  const depreciation = isRecord(raw.depreciation) ? raw.depreciation : {};
  const exit = isRecord(raw.exit) ? raw.exit : {};
  const category = CATEGORIES.includes(vehicle.category as VehicleCategory)
    ? vehicle.category as VehicleCategory
    : fallback.vehicle.category;
  const overrideSeen = new Set<number>();
  if (
    Array.isArray(depreciation.resaleOverrides) &&
    depreciation.resaleOverrides.length > MAX_RESALE_OVERRIDES
  ) {
    throw new Error(
      `시점별 예상시세는 항목당 최대 ${MAX_RESALE_OVERRIDES}개까지 가져올 수 있습니다.`,
    );
  }
  const resaleOverrides = Array.isArray(depreciation.resaleOverrides)
    ? depreciation.resaleOverrides.flatMap((value) => {
        if (!isRecord(value)) return [];
        const atMonths = integer(value.atMonths, 0, 0, 120);
        const price = money(value.price, 0);
        if (price <= 0 || overrideSeen.has(atMonths)) return [];
        overrideSeen.add(atMonths);
        return [{ atMonths, price }];
      })
    : [];

  return {
    ...fallback,
    id: text(raw.id, fallback.id, 100) || fallback.id,
    label: typeof raw.label === 'string' ? raw.label.slice(0, 100) || undefined : undefined,
    vehicle: {
      name: text(vehicle.name, '', 100),
      price: money(vehicle.price, fallback.vehicle.price),
      isUsed: bool(vehicle.isUsed, fallback.vehicle.isUsed),
      count: integer(vehicle.count, fallback.vehicle.count, 1, 100),
      category,
    },
    months: integer(raw.months, fallback.months, 12, 120),
    ratePct: finite(raw.ratePct, fallback.ratePct, 0, 100),
    down: modeValue(raw.down, fallback.down),
    deposit:
      method === 'installment'
        ? null
        : modeValue(raw.deposit, fallback.deposit!),
    residual:
      method !== 'installment'
        ? modeValue(raw.residual, fallback.residual!)
        : null,
    loanAmount:
      method === 'installment'
        ? money(raw.loanAmount, fallback.loanAmount ?? 0)
        : null,
    monthlyOverride:
      raw.monthlyOverride == null
        ? null
        : money(raw.monthlyOverride, 0) || null,
    upfrontFee: money(raw.upfrontFee, fallback.upfrontFee),
    insuranceYr: money(raw.insuranceYr, fallback.insuranceYr),
    maintenanceYr: money(raw.maintenanceYr, fallback.maintenanceYr),
    subsidy: money(raw.subsidy, fallback.subsidy),
    acqTaxRatePct: finite(raw.acqTaxRatePct, fallback.acqTaxRatePct, 0, 100),
    tax: {
      useDrivingLog: bool(tax.useDrivingLog, fallback.tax.useDrivingLog),
      bizUsePct: finite(tax.bizUsePct, fallback.tax.bizUsePct, 0, 100),
      hasDedicatedInsurance: bool(
        tax.hasDedicatedInsurance,
        fallback.tax.hasDedicatedInsurance,
      ),
      corporatePlateRequired: bool(
        tax.corporatePlateRequired,
        fallback.tax.corporatePlateRequired,
      ),
      hasCorporatePlate: bool(tax.hasCorporatePlate, fallback.tax.hasCorporatePlate),
    },
    depreciation: {
      depRatePct: finite(
        depreciation.depRatePct,
        fallback.depreciation.depRatePct,
        0,
        100,
      ),
      floorPct: finite(
        depreciation.floorPct,
        fallback.depreciation.floorPct,
        0,
        100,
      ),
      resaleOverrides,
    },
    exit: {
      canTransfer: bool(exit.canTransfer, fallback.exit.canTransfer),
      transferFee: money(exit.transferFee, fallback.exit.transferFee),
      penaltyPct: finite(exit.penaltyPct, fallback.exit.penaltyPct, 0, 100),
      returnInspFee: money(
        exit.returnInspFee,
        fallback.exit.returnInspFee,
      ),
      mileagePenalty: money(
        exit.mileagePenalty,
        fallback.exit.mileagePenalty,
      ),
      earlyDiscount: money(
        exit.earlyDiscount,
        fallback.exit.earlyDiscount,
      ),
      buyoutFee: money(exit.buyoutFee, fallback.exit.buyoutFee),
    },
  };
}

export function parsePersistedState(textValue: string): ComparisonState {
  const parsed: unknown = JSON.parse(textValue);
  if (!isRecord(parsed) || parsed.version !== PERSISTENCE_VERSION || !isRecord(parsed.state)) {
    throw new Error('지원하지 않는 저장 형식입니다.');
  }
  if (!Array.isArray(parsed.state.items)) throw new Error('비교 항목 형식이 올바르지 않습니다.');
  if (parsed.state.items.length > MAX_ITEMS) {
    throw new Error(`비교 항목은 최대 ${MAX_ITEMS}개까지 가져올 수 있습니다.`);
  }
  const common = parseCommon(parsed.state.common);
  const items = parsed.state.items.flatMap((value) => {
    const item = parseItem(value);
    return item ? [item] : [];
  });
  if (items.length !== parsed.state.items.length) {
    throw new Error('알 수 없는 금융 방식 또는 손상된 항목이 있습니다.');
  }
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) item.id = nextId();
    ids.add(item.id);
  }
  const activeScenarioMonths = new Set(common.scenarios.map((scenario) => scenario.atMonths));
  const orphanMonths = new Set<number>();
  for (const item of items) {
    for (const override of item.depreciation.resaleOverrides) {
      if (!activeScenarioMonths.has(override.atMonths)) orphanMonths.add(override.atMonths);
    }
  }
  if ([...orphanMonths].some((month) => month < 3 || month > 120)) {
    throw new Error('예상시세 시점은 3~120개월 범위여야 합니다.');
  }
  if (common.scenarios.length + orphanMonths.size > MAX_SCENARIOS) {
    throw new Error(
      `예상시세를 표시할 비교 시나리오는 최대 ${MAX_SCENARIOS}개까지 허용됩니다.`,
    );
  }
  for (const atMonths of [...orphanMonths].sort((a, b) => a - b)) {
    common.scenarios.push({
      atMonths,
      label: `${Math.round((atMonths / 12) * 10) / 10}년 후`,
    });
  }
  return { common, items };
}

export function serializeState(state: ComparisonState): string {
  if (state.items.length > MAX_ITEMS) {
    throw new Error(`비교 항목은 최대 ${MAX_ITEMS}개까지 저장할 수 있습니다.`);
  }
  return JSON.stringify({ version: PERSISTENCE_VERSION, state }, null, 2);
}
