import { describe, expect, it } from 'vitest';
import { TAX_RULE_SET_ID } from '@/lib/engine/taxData';
import { defaultState } from '../defaults';
import {
  MAX_RESALE_OVERRIDES,
  MAX_SCENARIOS,
  parsePersistedProject,
  parsePersistedState,
  MAX_ITEMS,
  PERSISTENCE_VERSION,
  serializeState,
} from '../persistence';

describe('comparison state persistence', () => {
  it('현재 상태를 직렬화한 뒤 모든 입력을 동일하게 복원한다', () => {
    const state = defaultState();
    state.common.targetMonths = 60;
    state.common.marginalRateOverride = 0;
    state.common.vatTaxType = 'mixedOrUncertain';
    state.common.taxRuleHorizon = 'assumeUnchanged';
    state.common.smallRealEstateCorp = false;
    state.items[0].deposit = { mode: 'amount', value: 3_000_000 };
    state.items[0].monthlyQuote = {
      financePayment: 600_000,
      insurance: 80_000,
      vehicleTax: 30_000,
      maintenance: 40_000,
      maintenanceBreakdownKnown: true,
      serviceFee: 27_000,
    };
    state.items[0].upfrontFee = 250_000;
    state.items[0].vehicleTaxYr = 520_000;
    state.items[0].postFinanceAnnualCosts = {
      insurance: 900_000,
      vehicleTax: 500_000,
      maintenance: 700_000,
    };
    state.items[0].tax.hasQualifiedEvidence = true;
    state.items[0].tax.hasDedicatedInsurance = false;
    state.items[1].tax.corporatePlateRequired = true;
    state.items[1].tax.hasCorporatePlate = false;

    const restored = parsePersistedState(serializeState(state));

    expect(restored).toEqual(state);
  });

  it('깨진 JSON, 지원하지 않는 버전, 잘못된 항목 배열을 거부한다', () => {
    expect(() => parsePersistedState('{')).toThrow();
    expect(() => parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION + 1,
      state: { common: {}, items: [] },
    }))).toThrow('지원하지 않는 저장 형식');
    expect(() => parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION,
      taxRuleSetId: TAX_RULE_SET_ID,
      state: { common: {}, items: {} },
    }))).toThrow('비교 항목 형식');
    expect(() => parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION,
      taxRuleSetId: TAX_RULE_SET_ID,
      state: { common: {}, items: [{ method: 'unknown' }] },
    }))).toThrow('손상된 항목');
  });

  it('유효한 형식 안의 위험한 값은 허용 범위로 정규화하고 중복 시나리오를 제거한다', () => {
    const state = defaultState();
    const rawItem = {
      ...state.items[0],
      months: 999,
      ratePct: -10,
      down: { mode: 'amount', value: 1.6 },
      monthlyQuote: {
        financePayment: 5_000_000_000,
        insurance: -1,
        vehicleTax: 100_000.4,
        maintenance: 200_000,
        maintenanceBreakdownKnown: true,
        serviceFee: 300_000,
      },
      upfrontFee: 1.6,
      vehicle: { ...state.items[0].vehicle, count: 0, price: -1 },
      tax: { ...state.items[0].tax, bizUsePct: 500 },
      depreciation: {
        ...state.items[0].depreciation,
        resaleOverrides: [
          { atMonths: 24, price: 20_000_000.4 },
          { atMonths: 99, price: 10_000_000 },
        ],
      },
    };
    const restored = parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION,
      taxRuleSetId: TAX_RULE_SET_ID,
      state: {
        common: {
          ...state.common,
          targetMonths: 999,
          scenarios: [
            {},
            { atMonths: 24, label: '첫 번째' },
            { atMonths: 24, label: '중복' },
          ],
        },
        items: [rawItem],
      },
    }));

    expect(restored.common.targetMonths).toBe(120);
    expect(restored.common.scenarios).toEqual([
      { atMonths: 3, label: '3개월 후' },
      { atMonths: 24, label: '첫 번째' },
      { atMonths: 99, label: '8.3년 후' },
    ]);
    expect(restored.items[0].months).toBe(120);
    expect(restored.items[0].ratePct).toBe(0);
    expect(restored.items[0].vehicle.price).toBe(0);
    expect(restored.items[0].vehicle.count).toBe(1);
    expect(restored.items[0].tax.bizUsePct).toBe(100);
    expect(restored.items[0].down).toEqual({ mode: 'amount', value: 2 });
    expect(restored.items[0].monthlyQuote).toEqual({
      financePayment: 5_000_000_000,
      insurance: 0,
      vehicleTax: 100_000,
      maintenance: 200_000,
      maintenanceBreakdownKnown: true,
      serviceFee: 300_000,
    });
    expect(restored.items[0].upfrontFee).toBe(2);
    expect(restored.items[0].depreciation.resaleOverrides)
      .toEqual([
        { atMonths: 24, price: 20_000_000 },
        { atMonths: 99, price: 10_000_000 },
      ]);
  });
  it('방식상 필수인 보증금·잔존가 null은 편집 가능한 기본값으로 복구한다', () => {
    const raw = JSON.parse(serializeState(defaultState()));
    raw.state.items[0].deposit = null;
    raw.state.items[0].residual = null;
    const restored = parsePersistedState(JSON.stringify(raw));
    expect(restored.items[0].deposit).not.toBeNull();
    expect(restored.items[0].residual).not.toBeNull();
  });
  it('v1 실제 총 월납액은 v3 금융·차량대금 월납으로 손실 없이 마이그레이션한다', () => {
    const raw = JSON.parse(serializeState(defaultState()));
    raw.version = 1;
    delete raw.taxRuleSetId;
    delete raw.state.common.vatTaxType;
    delete raw.state.common.taxRuleHorizon;
    delete raw.state.items[0].monthlyQuote;
    delete raw.state.items[0].vehicleTaxYr;
    delete raw.state.items[0].postFinanceAnnualCosts;
    delete raw.state.items[0].tax.hasQualifiedEvidence;
    raw.state.items[0].monthlyOverride = 777_000;

    const restored = parsePersistedState(JSON.stringify(raw));

    expect(restored.items[0].monthlyQuote).toEqual({
      financePayment: 777_000,
      insurance: 0,
      vehicleTax: 0,
      maintenance: 0,
      maintenanceBreakdownKnown: false,
      serviceFee: 0,
    });
    expect(restored.items[0].vehicleTaxYr).toBe(0);
    expect(restored.items[0].postFinanceAnnualCosts).toEqual({
      insurance: 0,
      vehicleTax: 0,
      maintenance: 0,
    });
    expect(restored.items[0].tax.hasQualifiedEvidence).toBe(true);
    expect(restored.common.vatTaxType).toBe('general');
    expect(restored.common.taxRuleHorizon).toBe('assumeUnchanged');
    const restoredProject = parsePersistedProject(JSON.stringify(raw));
    expect(restoredProject.sourceTaxRuleSetId).toBeNull();
    expect(restoredProject.taxRuleMismatch).toBe(true);
  });
  it('v2는 기존 VAT 가정·장기 세법 반복을 명시적 v3 입력으로 마이그레이션한다', () => {
    const raw = JSON.parse(serializeState(defaultState()));
    raw.version = 2;
    delete raw.taxRuleSetId;
    delete raw.state.common.vatTaxType;
    delete raw.state.common.taxRuleHorizon;
    delete raw.state.items[0].postFinanceAnnualCosts;
    delete raw.state.items[0].tax.hasQualifiedEvidence;

    const restored = parsePersistedState(JSON.stringify(raw));

    expect(restored.common.vatTaxType).toBe('general');
    expect(restored.common.taxRuleHorizon).toBe('assumeUnchanged');
    expect(restored.items[0].tax.hasQualifiedEvidence).toBe(true);
    const restoredProject = parsePersistedProject(JSON.stringify(raw));
    expect(restoredProject.sourceTaxRuleSetId).toBeNull();
    expect(restoredProject.taxRuleMismatch).toBe(true);
  });
  it('v3 envelope은 규칙 ID 불일치 시 입력을 복구하고 재계산 경고 메타데이터를 반환한다', () => {
    const serialized = JSON.parse(serializeState(defaultState()));
    expect(serialized.taxRuleSetId).toBe(TAX_RULE_SET_ID);

    serialized.taxRuleSetId = 'KR-2099-unknown';
    const restored = parsePersistedProject(JSON.stringify(serialized));
    expect(restored.taxRuleMismatch).toBe(true);
    expect(restored.sourceTaxRuleSetId).toBe('KR-2099-unknown');
    expect(restored.state.items).toHaveLength(defaultState().items.length);
  });
  it('법인 저장본의 불가능한 간이과세 조합은 일반과세로 정규화한다', () => {
    const serialized = JSON.parse(serializeState(defaultState()));
    serialized.state.common.biz = 'corp';
    serialized.state.common.vatTaxType = 'simplified';
    const restored = parsePersistedProject(JSON.stringify(serialized));
    expect(restored.state.common.biz).toBe('corp');
    expect(restored.state.common.vatTaxType).toBe('general');
  });
  it('저장·가져오기 모두 최대 항목 수를 강제한다', () => {
    const state = defaultState();
    state.items = Array.from({ length: MAX_ITEMS + 1 }, (_, index) => ({
      ...structuredClone(state.items[0]),
      id: `item-${index}`,
    }));
    expect(() => serializeState(state)).toThrow(`최대 ${MAX_ITEMS}개`);
    expect(() => parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION,
      taxRuleSetId: TAX_RULE_SET_ID,
      state,
    }))).toThrow(`최대 ${MAX_ITEMS}개`);
  });

  it('UI가 허용하는 40개 시나리오·예상시세는 보존하고 초과 입력은 거부한다', () => {
    const state = defaultState();
    state.common.scenarios = Array.from({ length: MAX_SCENARIOS }, (_, index) => ({
      atMonths: (index + 1) * 3,
      label: `${(index + 1) * 3}개월 후`,
    }));
    state.items[0].depreciation.resaleOverrides = Array.from(
      { length: MAX_RESALE_OVERRIDES },
      (_, index) => ({ atMonths: (index + 1) * 3, price: 40_000_000 - index * 100_000 }),
    );
    const restored = parsePersistedState(serializeState(state));
    expect(restored.common.scenarios).toHaveLength(MAX_SCENARIOS);
    expect(restored.items[0].depreciation.resaleOverrides)
      .toHaveLength(MAX_RESALE_OVERRIDES);

    const raw = JSON.parse(serializeState(state));
    raw.state.common.scenarios.push({ atMonths: 3, label: '초과' });
    expect(() => parsePersistedState(JSON.stringify(raw)))
      .toThrow(`최대 ${MAX_SCENARIOS}개`);
  });
});
