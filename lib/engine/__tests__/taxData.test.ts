import { describe, expect, it } from 'vitest';
import {
  annualCostLimit,
  annualDepLimit,
  CATEGORIES,
  INDUSTRIES,
  isExempt,
  marginalRate,
} from '../taxData';
import type { CommonProfile } from '../types';

const common = (over: Partial<CommonProfile>): CommonProfile => ({
  biz: 'personal', industryIndex: 0, revenueIndex: 2,
  marginalRateOverride: null, assetReturnPct: 5, tradeIn: 0,
  targetMonths: 48, smallRealEstateCorp: false, personalInsuranceRequired: false, scenarios: [],
  ...over,
});

describe('taxData', () => {
  it('비사업자는 한계세율 0', () => {
    expect(marginalRate(common({ biz: 'none' }))).toBe(0);
  });
  it('개인 5~8천만 구간 → 15%', () => {
    expect(marginalRate(common({ biz: 'personal', revenueIndex: 2 }))).toBe(0.15);
  });
  it('2026 법인 추정세율: 저구간 10%, 5억 이상 20%', () => {
    expect(marginalRate(common({ biz: 'corp', revenueIndex: 0 }))).toBe(0.10);
    expect(marginalRate(common({ biz: 'corp', revenueIndex: 6 }))).toBe(0.20);
  });
  it('직접입력이 매핑보다 우선', () => {
    expect(marginalRate(common({ marginalRateOverride: 38 }))).toBe(0.38);
    expect(marginalRate(common({ marginalRateOverride: 0 }))).toBe(0);
  });
  it('업종 50% 휴리스틱을 폐지해 모든 업종 인정비율이 100%', () => {
    expect(INDUSTRIES).toHaveLength(6);
    expect(INDUSTRIES.every((industry) => !('deductRate' in industry))).toBe(true);
  });
  it('소규모 부동산임대 주업법인만 비용 500만·감가 400만·세율 20% 특례', () => {
    const normal = common({ biz: 'corp', revenueIndex: 0 });
    const special = common({ biz: 'corp', revenueIndex: 0, smallRealEstateCorp: true });
    expect([annualCostLimit(normal), annualDepLimit(normal)]).toEqual([15_000_000, 8_000_000]);
    expect([annualCostLimit(special), annualDepLimit(special)]).toEqual([5_000_000, 4_000_000]);
    expect(marginalRate(special)).toBe(0.20);
    expect(annualCostLimit(common({
      biz: 'personal',
      smallRealEstateCorp: true,
    }))).toBe(15_000_000);
  });
  it('분류: 승용차만 한도 적용, 9~10인승 7%·11인승 이상 승합 5%', () => {
    expect(isExempt('passenger')).toBe(false);
    expect(isExempt('truck')).toBe(true);
    expect(CATEGORIES.map((c) => c.acqTaxDefaultPct)).toEqual([7, 4, 7, 5, 5, 4]);
  });
});
