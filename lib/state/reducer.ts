// lib/state/reducer.ts — 단일 스토어 액션 (스펙 §6.2)
import type {
  CommonProfile, ComparisonState, FinanceItem, Scenario,
} from '@/lib/engine/types';

export type Action =
  | { type: 'setCommon'; patch: Partial<CommonProfile> }
  | { type: 'addScenario'; scenario: Scenario }
  | { type: 'updateScenario'; index: number; scenario: Scenario }
  | { type: 'removeScenario'; index: number }
  | { type: 'replaceState'; state: ComparisonState }
  | { type: 'addItem'; item: FinanceItem }
  | { type: 'replaceItem'; item: FinanceItem }
  | { type: 'duplicateItem'; id: string; newId: string }
  | { type: 'removeItem'; id: string };

function normalizeCommonProfile(common: CommonProfile): CommonProfile {
  return common.biz === 'corp' && common.vatTaxType === 'simplified'
    ? { ...common, vatTaxType: 'general' }
    : common;
}

export function reducer(state: ComparisonState, action: Action): ComparisonState {
  switch (action.type) {
    case 'replaceState': {
      const common = normalizeCommonProfile(action.state.common);
      return common === action.state.common
        ? action.state
        : { ...action.state, common };
    }
    case 'setCommon': {
      const common = normalizeCommonProfile({
        ...state.common,
        ...action.patch,
      });
      return { ...state, common };
    }
    case 'addScenario':
      return {
        ...state,
        common: {
          ...state.common,
          scenarios: [...state.common.scenarios, action.scenario],
        },
      };
    case 'updateScenario': {
      const previous = state.common.scenarios[action.index];
      if (!previous) return state;
      const scenarios = state.common.scenarios.map((scenario, index) =>
        index === action.index ? action.scenario : scenario);
      const items = state.items.map((item) => {
        const moved = item.depreciation.resaleOverrides
          .find((override) => override.atMonths === previous.atMonths);
        if (!moved) return item;
        const resaleOverrides = item.depreciation.resaleOverrides
          .filter((override) =>
            override.atMonths !== previous.atMonths &&
            override.atMonths !== action.scenario.atMonths);
        resaleOverrides.push({ ...moved, atMonths: action.scenario.atMonths });
        return {
          ...item,
          depreciation: { ...item.depreciation, resaleOverrides },
        };
      });
      return { ...state, common: { ...state.common, scenarios }, items };
    }
    case 'removeScenario': {
      const removed = state.common.scenarios[action.index];
      if (!removed) return state;
      return {
        ...state,
        common: {
          ...state.common,
          scenarios: state.common.scenarios.filter((_, index) => index !== action.index),
        },
        items: state.items.map((item) => ({
          ...item,
          depreciation: {
            ...item.depreciation,
            resaleOverrides: item.depreciation.resaleOverrides
              .filter((override) => override.atMonths !== removed.atMonths),
          },
        })),
      };
    }
    case 'addItem':
      return { ...state, items: [...state.items, action.item] };
    case 'replaceItem':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.item.id ? action.item : i)),
      };
    case 'duplicateItem': {
      const idx = state.items.findIndex((i) => i.id === action.id);
      if (idx < 0) return state;
      const src = state.items[idx];
      const copy: FinanceItem = {
        ...structuredClone(src),
        id: action.newId,
        label: src.label ? `${src.label.slice(0, 95)} (복제)` : undefined,
      };
      const items = [...state.items];
      items.splice(idx + 1, 0, copy);
      return { ...state, items };
    }
    case 'removeItem':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
  }
}
