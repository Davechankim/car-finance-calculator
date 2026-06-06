// lib/engine/resale.ts — 차량 감가 시세 (스펙 §4.4), 1대당
// 가정: resaleOverrides의 atMonths는 중복 없음 (UI 리듀서가 upsert로 보장). 중복 시 첫 항목 사용.
import type { FinanceItem } from './types';

export function resaleAt(item: FinanceItem, m: number): number {
  const mm = Math.max(m, 0); // 음수 시점 방지 (호출자 클램프와 별개의 안전망)
  const ov = item.depreciation.resaleOverrides.find((o) => o.atMonths === mm);
  if (ov) return ov.price;
  const P = item.vehicle.price;
  const yrs = mm / 12;
  // depRatePct ≥ 100이면 음수 밑의 분수 거듭제곱으로 NaN이 될 수 있어 0으로 클램프 → floor가 안전망 역할
  const curve = P * Math.pow(Math.max(1 - item.depreciation.depRatePct / 100, 0), yrs);
  return Math.max(curve, P * (item.depreciation.floorPct / 100));
}
