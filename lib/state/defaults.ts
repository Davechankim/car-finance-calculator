// lib/state/defaults.ts — 신규 항목 기본값 (스펙 §6.3)
import { categoryMeta } from '@/lib/engine/taxData';
import type { ComparisonState, FinanceItem, Method } from '@/lib/engine/types';

export const METHOD_LABELS: Record<Method, string> = {
  rent: '장기렌트', oplease: '운용리스', finlease: '금융리스', installment: '할부',
};

let seq = 0;
export const nextId = () => `item-${++seq}-${Date.now().toString(36)}`;

interface MethodDefault {
  ratePct: number; residualPct: number | null;
  insuranceYr: number; maintenanceYr: number;
  penaltyPct: number; transferFee: number; returnInspFee: number; canTransfer: boolean;
}
const METHOD_DEFAULTS: Record<Method, MethodDefault> = {
  rent:        { ratePct: 5.9, residualPct: 30,   insuranceYr: 0,       maintenanceYr: 0,       penaltyPct: 30, transferFee: 500_000, returnInspFee: 200_000, canTransfer: true },
  oplease:     { ratePct: 4.5, residualPct: 30,   insuranceYr: 800_000, maintenanceYr: 300_000, penaltyPct: 20, transferFee: 300_000, returnInspFee: 150_000, canTransfer: true },
  finlease:    { ratePct: 5.0, residualPct: 30,   insuranceYr: 800_000, maintenanceYr: 300_000, penaltyPct: 20, transferFee: 300_000, returnInspFee: 0,       canTransfer: true },
  installment: { ratePct: 5.5, residualPct: null, insuranceYr: 800_000, maintenanceYr: 300_000, penaltyPct: 0,  transferFee: 0,       returnInspFee: 0,       canTransfer: false },
};

export function newItem(method: Method): FinanceItem {
  const d = METHOD_DEFAULTS[method];
  return {
    id: nextId(),
    method,
    vehicle: { name: '', price: 40_000_000, isUsed: false, count: 1, category: 'passenger' },
    months: 48,
    ratePct: d.ratePct,
    down: { mode: 'pct', value: 30 },
    deposit: method === 'installment' ? null : { mode: 'amount', value: 0 },
    residual:
      method === 'installment' || d.residualPct == null
        ? null
        : { mode: 'pct', value: d.residualPct },
    loanAmount: method === 'installment' ? 28_000_000 : null,
    monthlyOverride: null,
    upfrontFee: 0,
    insuranceYr: d.insuranceYr,
    maintenanceYr: d.maintenanceYr,
    subsidy: 0,
    acqTaxRatePct: categoryMeta('passenger').acqTaxDefaultPct,
    tax: {
      useDrivingLog: false,
      bizUsePct: 100,
      hasDedicatedInsurance: true,
      corporatePlateRequired: false,
      hasCorporatePlate: true,
    },
    depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [] },
    exit: {
      canTransfer: d.canTransfer, transferFee: d.transferFee, penaltyPct: d.penaltyPct,
      returnInspFee: d.returnInspFee, mileagePenalty: 0, earlyDiscount: 0, buyoutFee: 0,
    },
  };
}

export function defaultState(): ComparisonState {
  return {
    common: {
      biz: 'personal', industryIndex: 0, revenueIndex: 2,
      marginalRateOverride: null, assetReturnPct: 5, tradeIn: 0,
      targetMonths: 48, smallRealEstateCorp: false, personalInsuranceRequired: false,
      scenarios: [
        { atMonths: 12, label: '1년 후' },
        { atMonths: 24, label: '2년 후' },
        { atMonths: 36, label: '3년 후' },
      ],
    },
    items: [newItem('rent'), newItem('oplease'), newItem('installment')],
  };
}

export function itemTitle(item: FinanceItem, index: number): string {
  const auto =
    `${METHOD_LABELS[item.method]}${item.vehicle.isUsed ? ' · 중고' : ''}` +
    `${item.vehicle.name ? ` · ${item.vehicle.name}` : ''}`;
  const base = item.label?.trim() || auto;
  return `${index + 1}. ${base}${item.vehicle.count > 1 ? ` ×${item.vehicle.count}` : ''}`;
}
