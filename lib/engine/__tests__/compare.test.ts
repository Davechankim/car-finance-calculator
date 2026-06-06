import { describe, expect, it } from 'vitest';
import { compareAll } from '../compare';
import { costAt } from '../snapshot';
import { financials } from '../costAt';
import { baseCommon, baseItem } from './fixtures';
import type { ComparisonState } from '../types';

const state = (over: Partial<ComparisonState> = {}): ComparisonState => ({
  common: baseCommon(),
  items: [
    baseItem('oplease', { id: 'a' }),
    baseItem('installment', { id: 'b', months: 72 }),
  ],
  ...over,
});

describe('compareAll (스펙 §5)', () => {
  it('그리드: 0~최장기간(72), 3개월 단위, 끝점 포함', () => {
    const r = compareAll(state());
    expect(r.horizon).toBe(72);
    expect(r.gridMonths[0]).toBe(0);
    expect(r.gridMonths[r.gridMonths.length - 1]).toBe(72);
    expect(r.gridMonths).toContain(48);
  });

  it('기간 불일치: 48개월 항목은 48 이후 ended·값 고정 (점선 표시용)', () => {
    const r = compareAll(state());
    const a = r.series.find((s) => s.itemId === 'a')!;
    const at48 = a.points.find((p) => p.m === 48)!;
    const at60 = a.points.find((p) => p.m === 60)!;
    expect(at60.ended).toBe(true);
    expect(at60.netCost).toBe(at48.netCost);
  });

  it('bestPoint: 자기 계약기간 내 후보들의 최소와 일치', () => {
    const r = compareAll(state());
    const a = r.series.find((s) => s.itemId === 'a')!;
    const item = state().items[0];
    const candidates = r.gridMonths.filter((m) => m <= 48);
    const manualMin = Math.min(...candidates.map((m) => costAt(item, baseCommon(), m).netCost));
    expect(a.bestPoint.netCost).toBeCloseTo(manualMin, 4);
  });

  it('globalBest = 모든 (항목, 시점) 중 최소', () => {
    const r = compareAll(state());
    const allBest = Math.min(...r.series.map((s) => s.bestPoint.netCost));
    expect(r.globalBest!.netCost).toBeCloseTo(allBest, 4);
  });

  it('시나리오 행: 시점마다 전 항목 스냅샷 + 최저 항목 표시', () => {
    const st = state({ common: baseCommon({ scenarios: [{ atMonths: 24, label: '2년 후' }] }) });
    const r = compareAll(st);
    expect(r.scenarioRows).toHaveLength(1);
    const row = r.scenarioRows[0];
    expect(row.cells).toHaveLength(2);
    const min = row.cells.reduce((x, y) => (y.snapshot.netCost < x.snapshot.netCost ? y : x));
    expect(row.bestItemId).toBe(min.itemId);
  });

  it('항목 0개 → 빈 결과, 1개 → 단독 분석 (globalBest는 그 항목)', () => {
    expect(compareAll({ common: baseCommon(), items: [] }).globalBest).toBeNull();
    const r = compareAll({ common: baseCommon(), items: [baseItem('rent', { id: 'x' })] });
    expect(r.globalBest!.itemId).toBe('x');
  });
});

describe('불변식 (스펙 §7 P)', () => {
  it('잔존가치↑ → 운용리스 월납↓', () => {
    const m30 = financials(baseItem('oplease', { residual: { mode: 'pct', value: 30 } })).monthly;
    const m40 = financials(baseItem('oplease', { residual: { mode: 'pct', value: 40 } })).monthly;
    expect(m40).toBeLessThan(m30);
  });

  it('누적지출은 시점에 대해 단조 증가 (환급 없는 기본 케이스)', () => {
    const r = compareAll({ common: baseCommon(), items: [baseItem('rent', { id: 'r', insuranceYr: 800_000 })] });
    const pts = r.series[0].points.filter((p) => !p.ended);
    // netCost가 아니라 sunk의 단조성: costAt으로 직접 확인
    let prev = -Infinity;
    for (const p of pts) {
      const s = costAt(baseItem('rent', { id: 'r', insuranceYr: 800_000 }), baseCommon(), p.m);
      expect(s.sunk).toBeGreaterThanOrEqual(prev);
      prev = s.sunk;
    }
  });

  it('대수 선형성: tradeIn=0이면 2대 netCost = 1대×2, tradeIn>0이면 깨진다', () => {
    const c0 = baseCommon({ biz: 'personal', assetReturnPct: 5 });
    const one = costAt(baseItem('oplease'), c0, 24).netCost;
    const two = costAt(
      baseItem('oplease', { vehicle: { ...baseItem('oplease').vehicle, count: 2 } }), c0, 24,
    ).netCost;
    expect(two).toBeCloseTo(one * 2, 2);

    const cT = baseCommon({ biz: 'personal', assetReturnPct: 5, tradeIn: 5_000_000 });
    const oneT = costAt(baseItem('oplease'), cT, 24).netCost;
    const twoT = costAt(
      baseItem('oplease', { vehicle: { ...baseItem('oplease').vehicle, count: 2 } }), cT, 24,
    ).netCost;
    expect(Math.abs(twoT - oneT * 2)).toBeGreaterThan(1); // 1회 차감이라 비선형
  });

  it('벤치마크: 50항목 × 25시점 < 200ms', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      baseItem((['rent', 'oplease', 'finlease', 'installment'] as const)[i % 4], { id: `i${i}` }),
    );
    const t0 = performance.now();
    compareAll({ common: baseCommon({ biz: 'personal' }), items });
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
