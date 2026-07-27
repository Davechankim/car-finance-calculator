import { describe, expect, it } from 'vitest';
import { defaultState } from '../defaults';
import {
  MAX_RESALE_OVERRIDES,
  MAX_SCENARIOS,
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
    state.common.smallRealEstateCorp = false;
    state.items[0].deposit = { mode: 'amount', value: 3_000_000 };
    state.items[0].monthlyOverride = 777_000;
    state.items[0].upfrontFee = 250_000;
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
      state: { common: {}, items: {} },
    }))).toThrow('비교 항목 형식');
    expect(() => parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION,
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
      monthlyOverride: 5_000_000_000,
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
    expect(restored.items[0].monthlyOverride).toBe(5_000_000_000);
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
  it('저장·가져오기 모두 최대 항목 수를 강제한다', () => {
    const state = defaultState();
    state.items = Array.from({ length: MAX_ITEMS + 1 }, (_, index) => ({
      ...structuredClone(state.items[0]),
      id: `item-${index}`,
    }));
    expect(() => serializeState(state)).toThrow(`최대 ${MAX_ITEMS}개`);
    expect(() => parsePersistedState(JSON.stringify({
      version: PERSISTENCE_VERSION,
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
