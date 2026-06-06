// lib/state/reducer.ts — 단일 스토어 액션 (스펙 §6.2)
import type { CommonProfile, ComparisonState, FinanceItem } from '@/lib/engine/types';

export type Action =
  | { type: 'setCommon'; patch: Partial<CommonProfile> }
  | { type: 'addItem'; item: FinanceItem }
  | { type: 'replaceItem'; item: FinanceItem }
  | { type: 'duplicateItem'; id: string; newId: string }
  | { type: 'removeItem'; id: string };

export function reducer(state: ComparisonState, action: Action): ComparisonState {
  switch (action.type) {
    case 'setCommon':
      return { ...state, common: { ...state.common, ...action.patch } };
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
        label: src.label ? `${src.label} (복제)` : undefined,
      };
      const items = [...state.items];
      items.splice(idx + 1, 0, copy);
      return { ...state, items };
    }
    case 'removeItem':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
  }
}
