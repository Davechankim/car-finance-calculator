import { describe, expect, it } from 'vitest';
import { defaultState, newItem, nextId } from '../defaults';
import { reducer } from '../reducer';

describe('defaults (스펙 §6.3)', () => {
  it('방식별 기본값: 금리·선납·잔존', () => {
    expect(newItem('rent').ratePct).toBe(5.9);
    expect(newItem('oplease').ratePct).toBe(4.5);
    expect(newItem('finlease').ratePct).toBe(5.0);
    expect(newItem('installment').ratePct).toBe(5.5);
    expect(newItem('rent').residual).toBeNull();
    expect(newItem('oplease').residual).toEqual({ mode: 'pct', value: 30 });
    expect(newItem('finlease').residual).toEqual({ mode: 'pct', value: 30 });
    expect(newItem('rent').insuranceYr).toBe(0); // 렌트는 보험 포함
    expect(newItem('oplease').insuranceYr).toBe(800_000);
  });
  it('id는 호출마다 고유', () => {
    expect(newItem('rent').id).not.toBe(newItem('rent').id);
  });
  it('초기 상태: 3항목(rent/oplease/installment), 시나리오 12/24/36', () => {
    const s = defaultState();
    expect(s.items.map((i) => i.method)).toEqual(['rent', 'oplease', 'installment']);
    expect(s.common.scenarios.map((x) => x.atMonths)).toEqual([12, 24, 36]);
  });
});

describe('reducer (스펙 §6.2)', () => {
  it('setCommon: 부분 패치', () => {
    const s = reducer(defaultState(), { type: 'setCommon', patch: { biz: 'corp' } });
    expect(s.common.biz).toBe('corp');
  });
  it('addItem / removeItem / duplicateItem / replaceItem', () => {
    let s = defaultState();
    s = reducer(s, { type: 'addItem', item: newItem('finlease') });
    expect(s.items).toHaveLength(4);
    expect(s.items[3].method).toBe('finlease');

    const target = s.items[0];
    s = reducer(s, { type: 'duplicateItem', id: target.id, newId: nextId() });
    expect(s.items).toHaveLength(5);
    expect(s.items[1].method).toBe(target.method); // 복제는 원본 바로 뒤
    expect(s.items[1].id).not.toBe(target.id);

    const edited = { ...s.items[0], months: 60 };
    s = reducer(s, { type: 'replaceItem', item: edited });
    expect(s.items[0].months).toBe(60);

    const n = s.items.length;
    s = reducer(s, { type: 'removeItem', id: s.items[0].id });
    expect(s.items).toHaveLength(n - 1);
  });
  it('reducer는 순수 — 같은 액션 두 번 적용해도 id 충돌 없음 (StrictMode 안전)', () => {
    const s0 = defaultState();
    const item = newItem('rent');
    const s1 = reducer(s0, { type: 'addItem', item });
    const s2 = reducer(s0, { type: 'addItem', item }); // 동일 액션 재적용 (이중 호출 시뮬레이션)
    expect(s1.items[s1.items.length - 1].id).toBe(s2.items[s2.items.length - 1].id); // 결정론
  });
});
