import { describe, expect, it } from 'vitest';

import {
  CAR_COST_LIMIT_YR,
  CAR_DEP_LIMIT_YR,
  CATEGORIES,
  COMPACT_ACQ_TAX_RELIEF,
  DEP_EQUIV_RATE,
  DEP_YEARS,
  VAT_FRACTION,
  annualCostLimit,
  annualDepLimit,
  marginalRate,
} from '../../engine/taxData';
import { baseCommon } from '../../engine/__tests__/fixtures';
import {
  APPROVED_TAX_RULE_ID,
  APPROVED_TAX_RULE_SNAPSHOT,
  PROVENANCE_SCOPE_VALUES,
  getApprovedTaxRuleSnapshot,
} from '../snapshot';
import rawSnapshot from '../../../tax-rules/approved/KR/2026.json';

describe('approved KR tax rule snapshot', () => {
  it('현재 taxData 계산 상수와 정확히 일치한다', () => {
    const rules = APPROVED_TAX_RULE_SNAPSHOT.rules;

    expect(rules.businessPassengerCar.annualCostLimitWon).toBe(CAR_COST_LIMIT_YR);
    expect(rules.businessPassengerCar.annualDepreciationLimitWon).toBe(CAR_DEP_LIMIT_YR);
    expect(rules.businessPassengerCar.smallRealEstateCorpAnnualCostLimitWon).toBe(
      annualCostLimit(baseCommon({ biz: 'corp', smallRealEstateCorp: true })),
    );
    expect(rules.businessPassengerCar.smallRealEstateCorpAnnualDepreciationLimitWon).toBe(
      annualDepLimit(baseCommon({ biz: 'corp', smallRealEstateCorp: true })),
    );
    expect(
      rules.vat.includedTaxNumerator / rules.vat.includedPriceDenominator,
    ).toBe(VAT_FRACTION);
    expect(rules.depreciation.years).toBe(DEP_YEARS);
    expect(rules.depreciation.equivalentRateByMethod).toEqual(DEP_EQUIV_RATE);
    expect(rules.compactAcquisitionTaxRelief.amountWon).toBe(COMPACT_ACQ_TAX_RELIEF);

    expect(rules.acquisitionTaxDefaultPct).toEqual(
      Object.fromEntries(CATEGORIES.map((category) => [
        category.key,
        category.acqTaxDefaultPct,
      ])),
    );
    expect(rules.businessPassengerCostLimitExemptByCategory).toEqual(
      Object.fromEntries(CATEGORIES.map((category) => [
        category.key,
        category.businessPassengerCostLimitExempt,
      ])),
    );
    expect(rules.vatInputCreditEligibleByCategory).toEqual(
      Object.fromEntries(CATEGORIES.map((category) => [
        category.key,
        category.vatInputCreditEligible,
      ])),
    );

    const personalRates = Array.from({ length: 7 }, (_, revenueIndex) => marginalRate(
      baseCommon({ biz: 'personal', revenueIndex }),
    ));
    const corporateRates = Array.from({ length: 7 }, (_, revenueIndex) => marginalRate(
      baseCommon({ biz: 'corp', revenueIndex }),
    ));
    expect(rules.estimatedMarginalRateByRevenueBand.personal).toEqual(personalRates);
    expect(rules.estimatedMarginalRateByRevenueBand.corp).toEqual(corporateRates);
  });

  it('승인 상태·적용일·공식 source URL·provenance를 강제한다', () => {
    expect(APPROVED_TAX_RULE_SNAPSHOT.status).toBe('approved');
    expect(APPROVED_TAX_RULE_SNAPSHOT.effectiveFrom).toBe('2026-01-01');
    expect(APPROVED_TAX_RULE_SNAPSHOT.effectiveThrough).toBe('2026-12-31');
    expect(APPROVED_TAX_RULE_SNAPSHOT.sourceUrl).toMatch(/^https:\/\/www\.law\.go\.kr/);
    expect(APPROVED_TAX_RULE_SNAPSHOT.provenance.length).toBeGreaterThan(0);
    const sourceIds = new Set<string>();
    const coveredScopes = new Set<string>();
    for (const source of APPROVED_TAX_RULE_SNAPSHOT.provenance) {
      expect(source.sourceUrl).toMatch(/^https:\/\//);
      expect(source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.scope.length).toBeGreaterThan(0);
      expect(sourceIds.has(source.sourceId)).toBe(false);
      sourceIds.add(source.sourceId);
      source.scope.forEach((scope) => coveredScopes.add(scope));
    }
    expect([...coveredScopes].sort()).toEqual([...PROVENANCE_SCOPE_VALUES].sort());
  });

  it('파싱한 스냅샷 전체를 깊게 동결하고 원본 JSON 객체와 분리한다', () => {
    expect(APPROVED_TAX_RULE_SNAPSHOT).not.toBe(rawSnapshot);
    expect(Object.isFrozen(APPROVED_TAX_RULE_SNAPSHOT)).toBe(true);
    expect(Object.isFrozen(APPROVED_TAX_RULE_SNAPSHOT.rules)).toBe(true);
    expect(Object.isFrozen(
      APPROVED_TAX_RULE_SNAPSHOT.rules.businessPassengerCar,
    )).toBe(true);
    expect(Object.isFrozen(APPROVED_TAX_RULE_SNAPSHOT.provenance)).toBe(true);
    expect(Object.isFrozen(APPROVED_TAX_RULE_SNAPSHOT.provenance[0])).toBe(true);

    expect(() => {
      const mutableView = APPROVED_TAX_RULE_SNAPSHOT as unknown as {
        rules: { businessPassengerCar: { annualCostLimitWon: number } };
      };
      mutableView.rules.businessPassengerCar.annualCostLimitWon = 1;
    }).toThrow(TypeError);
    expect(APPROVED_TAX_RULE_SNAPSHOT.rules.businessPassengerCar.annualCostLimitWon).toBe(
      CAR_COST_LIMIT_YR,
    );
  });

  it('알려진 ID와 적용 기간에 대해서만 같은 불변 객체를 반환한다', () => {
    expect(getApprovedTaxRuleSnapshot(APPROVED_TAX_RULE_ID, '2026-07-28')).toBe(
      APPROVED_TAX_RULE_SNAPSHOT,
    );
    expect(() => getApprovedTaxRuleSnapshot('KR-2027-car-finance')).toThrow(
      '승인된 세금 규칙 스냅샷을 찾지 못했습니다.',
    );
    expect(() => getApprovedTaxRuleSnapshot(APPROVED_TAX_RULE_ID, '2027-01-01')).toThrow(
      '조회 기준일에 적용되는 승인 스냅샷이 없습니다.',
    );
    expect(() => getApprovedTaxRuleSnapshot(APPROVED_TAX_RULE_ID, '2026-02-30')).toThrow(
      '조회 기준일은 유효한 YYYY-MM-DD 형식이어야 합니다.',
    );
  });
});
