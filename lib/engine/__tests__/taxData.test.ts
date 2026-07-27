import { describe, expect, it } from 'vitest';

import {
  APPROVED_TAX_RULE_ID,
  APPROVED_TAX_RULE_SNAPSHOT,
} from '@/lib/tax-rules/snapshot';
import {
  CAR_COST_LIMIT_YR,
  CAR_DEP_LIMIT_YR,
  CATEGORIES,
  COMPACT_ACQ_TAX_RELIEF,
  COMPACT_ACQ_TAX_RELIEF_EFFECTIVE_THROUGH,
  DEP_EQUIV_RATE,
  DEP_YEARS,
  SIMPLIFIED_RESALE_OUTPUT_VAT_VALUE_ADDED_RATES,
  TAX_RULE_HORIZON_MONTHS,
  TAX_RULE_SET_ID,
  VAT_FRACTION,
  VAT_STATUTORY_RATE,
  isCompactAcquisitionTaxReliefApplicable,
  isTaxRuleApplicableAtMonth,
  marginalRate,
  taxRuleApplicableMonths,
  taxRuleMonthsFrom,
} from '../taxData';
import { baseCommon } from './fixtures';

describe('승인 세법 스냅샷과 계산 엔진 연결', () => {
  it('엔진이 승인된 규칙 버전과 핵심 수치를 직접 사용한다', () => {
    const rules = APPROVED_TAX_RULE_SNAPSHOT.rules;

    expect(TAX_RULE_SET_ID).toBe(APPROVED_TAX_RULE_ID);
    expect(TAX_RULE_HORIZON_MONTHS).toBe(12);
    expect(CAR_COST_LIMIT_YR).toBe(
      rules.businessPassengerCar.annualCostLimitWon,
    );
    expect(CAR_DEP_LIMIT_YR).toBe(
      rules.businessPassengerCar.annualDepreciationLimitWon,
    );
    expect(DEP_YEARS).toBe(rules.depreciation.years);
    expect(DEP_EQUIV_RATE.rent).toBe(
      rules.depreciation.equivalentRateByMethod.rent,
    );
    expect(COMPACT_ACQ_TAX_RELIEF).toBe(
      rules.compactAcquisitionTaxRelief.amountWon,
    );
    expect(COMPACT_ACQ_TAX_RELIEF_EFFECTIVE_THROUGH).toBe('2027-12-31');
    expect(VAT_FRACTION).toBe(
      rules.vat.includedTaxNumerator / rules.vat.includedPriceDenominator,
    );
    expect(VAT_STATUTORY_RATE).toBe(0.1);
    expect(SIMPLIFIED_RESALE_OUTPUT_VAT_VALUE_ADDED_RATES).toEqual([
      0.4, 0.15, 0.2, 0.25, 0.3, 0.4,
    ]);
  });

  it('차종별 취득세율·업무용승용차 한도·VAT 적격 여부가 독립 스냅샷과 일치한다', () => {
    const rules = APPROVED_TAX_RULE_SNAPSHOT.rules;

    for (const category of CATEGORIES) {
      expect(category.acqTaxDefaultPct).toBe(
        rules.acquisitionTaxDefaultPct[category.key],
      );
      expect(category.businessPassengerCostLimitExempt).toBe(
        rules.businessPassengerCostLimitExemptByCategory[category.key],
      );
      expect(category.vatInputCreditEligible).toBe(
        rules.vatInputCreditEligibleByCategory[category.key],
      );
    }
  });

  it('소규모 부동산임대 법인 비용한도 선택만으로 20% 세율을 강제하지 않는다', () => {
    const regular = marginalRate(baseCommon({
      biz: 'corp',
      revenueIndex: 2,
      smallRealEstateCorp: false,
    }));
    const reducedLimitEntity = marginalRate(baseCommon({
      biz: 'corp',
      revenueIndex: 2,
      smallRealEstateCorp: true,
    }));
    expect(reducedLimitEntity).toBe(regular);
    expect(marginalRate(baseCommon({
      biz: 'corp',
      smallRealEstateCorp: true,
      marginalRateOverride: 20,
    }))).toBe(0.2);
  });

  it('승인 잔여기간은 실제 계산 시작일에서 2026-12-31까지만 계산한다', () => {
    expect(taxRuleMonthsFrom('2026-01-01')).toBe(12);
    expect(taxRuleMonthsFrom('2026-07-28')).toBeGreaterThan(5);
    expect(taxRuleMonthsFrom('2026-07-28')).toBeLessThan(5.2);
    expect(taxRuleMonthsFrom('2026-12-31')).toBeCloseTo(1 / 31, 8);
    expect(taxRuleMonthsFrom('2027-01-01')).toBe(0);
    expect(taxRuleMonthsFrom('invalid')).toBe(0);
  });

  it('approvedOnly는 기간형·거래시점형 세금 모두 승인 종료에서 차단한다', () => {
    const common = baseCommon({
      taxRuleHorizon: 'approvedOnly',
      taxStartDate: '2026-12-31',
    });
    expect(taxRuleApplicableMonths(common, 48)).toBeCloseTo(1 / 31, 8);
    expect(isTaxRuleApplicableAtMonth(common, 0)).toBe(true);
    expect(isTaxRuleApplicableAtMonth(common, 1)).toBe(false);
    expect(isTaxRuleApplicableAtMonth(
      { ...common, taxRuleHorizon: 'assumeUnchanged' },
      48,
    )).toBe(true);
  });

  it('경차 취득세 감면은 거래일이 2027-12-31을 넘으면 종료한다', () => {
    const common = baseCommon({ taxStartDate: '2026-12-31' });
    expect(isCompactAcquisitionTaxReliefApplicable(common, 12)).toBe(true);
    expect(isCompactAcquisitionTaxReliefApplicable(common, 12.1)).toBe(false);
    expect(isCompactAcquisitionTaxReliefApplicable(common, 48)).toBe(false);
  });
});
