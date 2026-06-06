// lib/engine/compare.ts — N항목 비교·최적 탐색·시나리오 (스펙 §5)
import { costAt } from './snapshot';
import type { ComparisonState, CostSnapshot, Scenario } from './types';

export const GRID_STEP = 3;

export interface SeriesPoint { m: number; netCost: number; ended: boolean }
export interface ItemSeries {
  itemId: string;
  points: SeriesPoint[];
  bestPoint: { m: number; netCost: number; exitLabel: string };
}
export interface ScenarioCell { itemId: string; snapshot: CostSnapshot }
export interface ScenarioRow { scenario: Scenario; cells: ScenarioCell[]; bestItemId: string }
export interface CompareResult {
  horizon: number;
  gridMonths: number[];
  series: ItemSeries[];
  globalBest: { itemId: string; m: number; netCost: number; exitLabel: string } | null;
  scenarioRows: ScenarioRow[];
}

export function compareAll(state: ComparisonState): CompareResult {
  const { common, items } = state;
  if (items.length === 0)
    return { horizon: 0, gridMonths: [], series: [], globalBest: null, scenarioRows: [] };

  const horizon = Math.max(...items.map((i) => i.months));
  const gridMonths: number[] = [];
  for (let m = 0; m <= horizon; m += GRID_STEP) gridMonths.push(m);
  if (gridMonths[gridMonths.length - 1] !== horizon) gridMonths.push(horizon);

  const series: ItemSeries[] = items.map((item) => {
    const points: SeriesPoint[] = gridMonths.map((m) => {
      const s = costAt(item, common, m);
      return { m, netCost: s.netCost, ended: s.ended };
    });
    // 자기 계약기간 내 후보 (+ 정확한 만기점)
    const candidates = gridMonths.filter((m) => m <= item.months);
    if (!candidates.includes(item.months)) candidates.push(item.months);
    let best = { m: 0, netCost: Infinity, exitLabel: '' };
    for (const m of candidates) {
      const s = costAt(item, common, m);
      if (s.netCost < best.netCost) best = { m, netCost: s.netCost, exitLabel: s.bestExit.label };
    }
    return { itemId: item.id, points, bestPoint: best };
  });

  const globalBest = series.reduce<CompareResult['globalBest']>((acc, s) => {
    if (!acc || s.bestPoint.netCost < acc.netCost)
      return { itemId: s.itemId, ...s.bestPoint };
    return acc;
  }, null);

  const scenarioRows: ScenarioRow[] = common.scenarios.map((scenario) => {
    const cells: ScenarioCell[] = items.map((item) => ({
      itemId: item.id,
      snapshot: costAt(item, common, scenario.atMonths),
    }));
    const bestItemId = cells.reduce((a, b) =>
      b.snapshot.netCost < a.snapshot.netCost ? b : a,
    ).itemId;
    return { scenario, cells, bestItemId };
  });

  return { horizon, gridMonths, series, globalBest, scenarioRows };
}
