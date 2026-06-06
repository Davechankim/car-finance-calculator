// lib/engine/resale.ts — 차량 감가 시세 (스펙 §4.4), 1대당
import type { FinanceItem } from './types';

export function resaleAt(item: FinanceItem, m: number): number {
  const ov = item.depreciation.resaleOverrides.find((o) => o.atMonths === m);
  if (ov) return ov.price;
  const P = item.vehicle.price;
  const yrs = m / 12;
  const curve = P * Math.pow(1 - item.depreciation.depRatePct / 100, yrs);
  return Math.max(curve, P * (item.depreciation.floorPct / 100));
}
