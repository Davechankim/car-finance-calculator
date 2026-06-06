import { describe, expect, it } from 'vitest';
import { costAt } from '../snapshot';
import { baseCommon, baseItem } from './fixtures';

describe('costAt 스냅샷 (스펙 §4.6)', () => {
  it('전 과정 손계산: 할부 금리0%·4,000만·취득세 7%·시세 2,500만 — net = 1,808만', () => {
    // monthly = 4,000만/48 = 833,333.33…, m=24
    // sunk = 280만(취득세) + 833,333.33×24(=2,000만) = 2,280만
    // settle = 2,280만 + 잔여대출 2,000만 − 시세 2,500만 = 1,780만
    // 기회비용 = 초기현금 280만 × 5% × 2년 = 28만 → net = 1,780만 + 28만 = 1,808만
    const item = baseItem('installment', {
      ratePct: 0,
      depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [{ atMonths: 24, price: 25_000_000 }] },
    });
    const s = costAt(item, baseCommon({ assetReturnPct: 5 }), 24);
    expect(s.sunk).toBeCloseTo(22_800_000, 0);
    expect(s.bestExit.cost).toBeCloseTo(17_800_000, 0);
    expect(s.initialCash).toBeCloseTo(2_800_000, 0);
    expect(s.oppCost).toBeCloseTo(280_000, 0);
    expect(s.taxSaving).toBe(0); // 비사업자
    expect(s.netCost).toBeCloseTo(18_080_000, 0);
  });

  it('배선 검증: netCost = bestExit.cost − taxSaving + oppCost', () => {
    const item = baseItem('rent', { insuranceYr: 800_000 });
    const s = costAt(item, baseCommon({ biz: 'personal', assetReturnPct: 5, tradeIn: 3_000_000 }), 30);
    expect(s.netCost).toBeCloseTo(s.bestExit.cost - s.taxSaving + s.oppCost, 6);
  });

  it('초기 부가세 환급은 기회비용의 초기현금에서도 차감 (화물+사업자 할부)', () => {
    const item = baseItem('installment', {
      down: { mode: 'amount', value: 12_000_000 },
      vehicle: { ...baseItem('installment').vehicle, category: 'truck', count: 1 },
      acqTaxRatePct: 5,
    });
    const s = costAt(item, baseCommon({ biz: 'personal', assetReturnPct: 5 }), 12);
    // 초기현금 = 선납 1,200만 + 취득세 200만 − 환급 363.6만
    expect(s.initialCash).toBeCloseTo(12_000_000 + 2_000_000 - 40_000_000 * (10 / 110), 0);
  });

  it('m=0: 기회비용 0, 절감 0', () => {
    const s = costAt(baseItem('rent'), baseCommon({ biz: 'personal', assetReturnPct: 5 }), 0);
    expect(s.oppCost).toBe(0);
    expect(s.taxSaving).toBe(0);
  });

  it('만기 이후 고정: m=60 요청 시 m=48 값 + ended=true (스펙 §5)', () => {
    const item = baseItem('oplease');
    const at48 = costAt(item, baseCommon(), 48);
    const at60 = costAt(item, baseCommon(), 60);
    expect(at60.ended).toBe(true);
    expect(at48.ended).toBe(false);
    expect(at60.netCost).toBe(at48.netCost);
    expect(at60.m).toBe(48);
  });

  it('T5 리뷰 후속 — 화물 2대+사업자: VAT 경로 포함 전체가 1대×2와 일치 (tradeIn=0)', () => {
    const c = baseCommon({ biz: 'personal', assetReturnPct: 5 });
    const mk = (count: number) =>
      baseItem('installment', {
        down: { mode: 'amount', value: 12_000_000 },
        vehicle: { ...baseItem('installment').vehicle, category: 'truck', count },
        acqTaxRatePct: 5,
      });
    const one = costAt(mk(1), c, 24);
    const two = costAt(mk(2), c, 24);
    expect(two.initialCash).toBeCloseTo(one.initialCash * 2, 4);
    expect(two.sunk).toBeCloseTo(one.sunk * 2, 4);
    expect(two.netCost).toBeCloseTo(one.netCost * 2, 2);
  });
});
