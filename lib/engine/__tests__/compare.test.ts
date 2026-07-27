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
  it('그리드: 목표·시나리오·계약/금융기간 중 최장(72), 3개월 단위, 끝점 포함', () => {
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

  it('bestPoint: 0개월을 제외한 자기 계약기간 내 후보들의 최소와 일치', () => {
    const r = compareAll(state());
    const a = r.series.find((s) => s.itemId === 'a')!;
    const item = state().items[0];
    const candidates = r.gridMonths.filter((m) => m >= 3 && m <= 48);
    const manualMin = Math.min(...candidates.map((m) => costAt(item, baseCommon(), m).netCost));
    expect(a.bestPoint.netCost).toBeCloseTo(manualMin, 4);
    expect(a.bestPoint.m).toBeGreaterThanOrEqual(3);
  });

  it('공통 보유기간 비교와 혼동되는 globalBest를 결과에 제공하지 않는다', () => {
    const r = compareAll(state());
    expect(r).not.toHaveProperty('globalBest');
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

  it('시나리오 최저 항목은 만료된 계약을 제외하되 소유형은 금융 만기 후에도 포함', () => {
    const st = state({
      common: baseCommon({
        scenarios: [
          { atMonths: 60, label: '5년 후' },
          { atMonths: 90, label: '7년 6개월 후' },
        ],
      }),
    });
    const r = compareAll(st);
    expect(r.scenarioRows[0].cells.find((c) => c.itemId === 'a')!.snapshot.ended).toBe(true);
    expect(r.scenarioRows[0].bestItemId).toBe('b');
    expect(r.scenarioRows[1].cells.find((c) => c.itemId === 'b')!.snapshot.ended).toBe(false);
    expect(r.scenarioRows[1].cells.find((c) => c.itemId === 'b')!.snapshot.m).toBe(90);
    expect(r.scenarioRows[1].bestItemId).toBe('b');

    const onlyExpiredContracts = compareAll({
      common: baseCommon({ scenarios: [{ atMonths: 90, label: '7년 6개월 후' }] }),
      items: [
        baseItem('rent', { id: 'rent', months: 48 }),
        baseItem('oplease', { id: 'op', months: 72 }),
      ],
    });
    expect(onlyExpiredContracts.scenarioRows[0].bestItemId).toBeNull();
  });

  it('항목 0개 → 빈 결과, 1개 → 단독 분석', () => {
    const empty = compareAll({ common: baseCommon(), items: [] });
    expect(empty).toEqual({ horizon: 0, gridMonths: [], series: [], scenarioRows: [] });
    const r = compareAll({ common: baseCommon(), items: [baseItem('rent', { id: 'x' })] });
    expect(r.series).toHaveLength(1);
    expect(r.series[0].itemId).toBe('x');
  });

  it('3개월 그리드 밖인 금융 만기점도 포함하고 소유형 bestPoint는 명시 분석기간까지만 탐색', () => {
    const odd = baseItem('installment', { id: 'odd', months: 55 });
    const r = compareAll({
      common: baseCommon(),
      items: [odd, baseItem('oplease', { id: 'long', months: 60 })],
    });
    expect(r.gridMonths).toContain(55);
    const s = r.series.find((x) => x.itemId === 'odd')!;
    const analysisEnd = 55;
    const gridCandidates = r.gridMonths.filter((m) => m >= 3 && m <= analysisEnd);
    const manualMin = Math.min(...gridCandidates.map((m) => costAt(odd, baseCommon(), m).netCost));
    expect(s.bestPoint.netCost).toBeCloseTo(manualMin, 4);
    expect(s.bestPoint.m).toBeLessThanOrEqual(analysisEnd);
  });

  it('목표 보유기간이 금융기간보다 길면 소유형 시계열을 계속 계산', () => {
    const owned = baseItem('installment', { id: 'owned', months: 36 });
    const contract = baseItem('rent', { id: 'contract', months: 36 });
    const r = compareAll({
      common: baseCommon({ targetMonths: 60 }),
      items: [owned, contract],
    });
    const owned60 = r.series[0].points.find((point) => point.m === 60)!;
    const contract60 = r.series[1].points.find((point) => point.m === 60)!;
    expect(r.horizon).toBe(60);
    expect(owned60.ended).toBe(false);
    expect(contract60.ended).toBe(true);
    expect(costAt(owned, baseCommon(), 60).m).toBe(60);
    expect(contract60.netCost)
      .toBe(r.series[1].points.find((point) => point.m === 36)!.netCost);
  });

  it('3개월 그리드 밖 목표에도 무관한 장기 계약 추가 전후 소유형 bestPoint가 같음', () => {
    const common = baseCommon({ targetMonths: 55 });
    const owned = baseItem('installment', {
      id: 'owned',
      months: 36,
      depreciation: {
        ...baseItem('installment').depreciation,
        resaleOverrides: [{ atMonths: 55, price: 50_000_000 }],
      },
    });
    const base = compareAll({ common, items: [owned] });
    const withLongContract = compareAll({
      common,
      items: [owned, baseItem('rent', { id: 'long-rent', months: 120 })],
    });
    expect(base.series[0].bestPoint.m).toBe(55);
    expect(withLongContract.horizon).toBe(120);
    expect(withLongContract.gridMonths).toContain(55);
    expect(withLongContract.series[0].bestPoint).toEqual(base.series[0].bestPoint);
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

  it('벤치마크: 50항목 × 17시점 그리드 < 200ms', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      baseItem((['rent', 'oplease', 'finlease', 'installment'] as const)[i % 4], { id: `i${i}` }),
    );
    const t0 = performance.now();
    compareAll({ common: baseCommon({ biz: 'personal' }), items });
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
