import type { CommonProfile, FinanceItem, Method } from '../types';

/** 손계산 기준 항목: 4,000만 승용차 1대·48개월·선납0·부대비용0 */
export function baseItem(method: Method, over: Partial<FinanceItem> = {}): FinanceItem {
  return {
    id: 't1',
    method,
    vehicle: { name: '테스트카', price: 40_000_000, isUsed: false, count: 1, category: 'passenger' },
    months: 48,
    ratePct: 6,
    down: { mode: 'amount', value: 0 },
    residual: method === 'oplease' || method === 'finlease' ? { mode: 'pct', value: 30 } : null,
    loanAmount: null,
    insuranceYr: 0,
    maintenanceYr: 0,
    subsidy: 0,
    acqTaxRatePct: 7,
    tax: { useDrivingLog: false, bizUsePct: 100 },
    depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [] },
    exit: {
      canTransfer: false, transferFee: 0, penaltyPct: 0,
      returnInspFee: 0, mileagePenalty: 0, earlyDiscount: 0,
    },
    ...over,
  };
}

export function baseCommon(over: Partial<CommonProfile> = {}): CommonProfile {
  return {
    biz: 'none', industryIndex: 0, revenueIndex: 2,
    marginalRateOverride: null, assetReturnPct: 0, tradeIn: 0, scenarios: [],
    ...over,
  };
}
