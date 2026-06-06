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
    expect(resaleAt(o, 12)).toBeCloseTo(34_000_000, 0); // 다른 시점은 커브 사용
  });
});
