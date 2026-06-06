import { describe, expect, it } from 'vitest';
import { resaleAt } from '../resale';
import { baseItem } from './fixtures';

describe('resaleAt (스펙 §4.4)', () => {
  const item = baseItem('installment'); // 4,000만, 감가 15%, floor 25%

  it('m=0이면 차량가 그대로', () => {
    expect(resaleAt(item, 0)).toBe(40_000_000);
  });
  it('24개월(2년): 4,000만 × 0.85² = 28,900,000', () => {
    expect(resaleAt(item, 24)).toBeCloseTo(28_900_000, 0);
  });
  it('최저 잔존비율(25%)에서 멈춤: 120개월에도 1,000만', () => {
    expect(resaleAt(item, 120)).toBe(10_000_000);
  });
  it('직접입력이 감가커브보다 우선', () => {
    const o = baseItem('installment', {
      depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [{ atMonths: 24, price: 25_000_000 }] },
    });
    expect(resaleAt(o, 24)).toBe(25_000_000);
    expect(resaleAt(o, 12)).toBe(34_000_000); // 다른 시점은 커브 사용
  });
  it('count=2여도 1대 가격 반환 (대수 곱셈은 호출자 책임)', () => {
    const two = baseItem('installment', { vehicle: { ...baseItem('installment').vehicle, count: 2 } });
    expect(two.vehicle.count).toBe(2);
    expect(resaleAt(two, 24)).toBeCloseTo(28_900_000, 0);
  });
  it('감가율 100% 이상이어도 NaN 없이 floor로 멈춤', () => {
    const x = baseItem('installment', {
      depreciation: { depRatePct: 120, floorPct: 25, resaleOverrides: [] },
    });
    expect(resaleAt(x, 6)).toBe(10_000_000);
  });
});
