import { describe, expect, it } from 'vitest';
import { CATEGORIES, industryRate, isExempt, marginalRate } from '../taxData';
import type { CommonProfile } from '../types';

const common = (over: Partial<CommonProfile>): CommonProfile => ({
  biz: 'personal', industryIndex: 0, revenueIndex: 2,
  marginalRateOverride: null, assetReturnPct: 5, tradeIn: 0, scenarios: [],
  ...over,
});

describe('taxData', () => {
  it('비사업자는 한계세율 0', () => {
    expect(marginalRate(common({ biz: 'none' }))).toBe(0);
  });
  it('개인 5~8천만 구간 → 15%', () => {
    expect(marginalRate(common({ biz: 'personal', revenueIndex: 2 }))).toBe(0.15);
  });
  it('법인 5억~ 구간 → 19%', () => {
    expect(marginalRate(common({ biz: 'corp', revenueIndex: 6 }))).toBe(0.19);
  });
  it('직접입력이 매핑보다 우선', () => {
    expect(marginalRate(common({ marginalRateOverride: 38 }))).toBe(0.38);
  });
  it('부동산임대업 비용인정 50%', () => {
    expect(industryRate(common({ industryIndex: 5 }))).toBe(0.5);
  });
  it('분류: 승용차만 한도 적용, 취득세 기본값 7/4/7/5/4', () => {
    expect(isExempt('passenger')).toBe(false);
    expect(isExempt('truck')).toBe(true);
    expect(CATEGORIES.map((c) => c.acqTaxDefaultPct)).toEqual([7, 4, 7, 5, 4]);
  });
});
