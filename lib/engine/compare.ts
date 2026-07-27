// lib/engine/compare.ts — N항목 비교·최적 탐색·시나리오 (스펙 §5)
import { costAt } from './snapshot';
import type { ComparisonState, CostSnapshot, Scenario } from './types';
import { isOwnershipMethod } from './types';

const GRID_STEP = 3;

export interface SeriesPoint { m: number; netCost: number; ended: boolean }
export interface ItemSeries {
  itemId: string;
  points: SeriesPoint[];
  bestPoint: { m: number; netCost: number; exitLabel: string };
}
export interface ScenarioCell { itemId: string; snapshot: CostSnapshot }
export interface ScenarioRow { scenario: Scenario; cells: ScenarioCell[]; bestItemId: string | null }
export interface CompareResult {
  horizon: number;
  gridMonths: number[];
  series: ItemSeries[];
  scenarioRows: ScenarioRow[];
}

export function compareAll(state: ComparisonState): CompareResult {
  const { common, items } = state;
  if (items.length === 0)
    return { horizon: 0, gridMonths: [], series: [], scenarioRows: [] };

  const requestedHorizon = Math.max(
    common.targetMonths,
    ...common.scenarios.map((scenario) => scenario.atMonths),
  );
  const horizon = Math.max(
    requestedHorizon,
    ...items.map((item) => item.months),
  );
  const gridSet = new Set<number>();
  for (let m = 0; m <= horizon; m += GRID_STEP) gridSet.add(m);
  gridSet.add(horizon);
  gridSet.add(common.targetMonths);
  for (const scenario of common.scenarios) gridSet.add(scenario.atMonths);
  for (const item of items) {
    if (item.months <= horizon) gridSet.add(item.months);
  }
  const gridMonths = [...gridSet].sort((a, b) => a - b);

  const series: ItemSeries[] = items.map((item) => {
    // 그리드 시점 스냅샷을 1회만 계산해 points와 bestPoint 탐색에 재사용
    const snaps = new Map<number, CostSnapshot>();
    for (const m of gridMonths) snaps.set(m, costAt(item, common, m));

    const points: SeriesPoint[] = gridMonths.map((m) => {
      const s = snaps.get(m)!;
      return { m, netCost: s.netCost, ended: s.ended };
    });

    // 소유형은 공통 보유기간까지, 렌트·운용리스는 계약 만기까지만 탐색한다.
    const candidateEnd = isOwnershipMethod(item.method)
      ? Math.max(requestedHorizon, item.months)
      : Math.min(horizon, item.months);
    const candidates = gridMonths.filter((m) => m >= GRID_STEP && m <= candidateEnd);
    let best = { m: 0, netCost: Infinity, exitLabel: '' };
    for (const m of candidates) {
      const s = snaps.get(m)!;
      if (s.netCost < best.netCost) best = { m, netCost: s.netCost, exitLabel: s.bestExit.label };
    }
    return { itemId: item.id, points, bestPoint: best };
  });

  const scenarioRows: ScenarioRow[] = common.scenarios.map((scenario) => {
    const cells: ScenarioCell[] = items.map((item) => ({
      itemId: item.id,
      snapshot: costAt(item, common, scenario.atMonths),
    }));
    const comparable = cells.filter((cell) => !cell.snapshot.ended);
    const bestItemId = comparable.length === 0
      ? null
      : comparable.reduce((a, b) =>
          b.snapshot.netCost < a.snapshot.netCost ? b : a,
        ).itemId;
    return { scenario, cells, bestItemId };
  });

  return { horizon, gridMonths, series, scenarioRows };
}
