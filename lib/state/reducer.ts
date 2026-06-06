// lib/state/reducer.ts — 단일 스토어 액션 (스펙 §6.2)
import type { CommonProfile, ComparisonState, FinanceItem, Method } from '@/lib/engine/types';
import { newItem } from './defaults';

export type Action =
  | { type: 'setCommon'; patch: Partial<CommonProfile> }
  | { type: 'addItem'; method: Method }
  | { type: 'replaceItem'; item: FinanceItem }
  | { type: 'duplicateItem'; id: string }
  | { type: 'removeItem'; id: string };

export function reducer(state: ComparisonState, action: Action): ComparisonState {
  switch (action.type) {
    case 'setCommon':
      return { ...state, common: { ...state.common, ...action.patch } };
    case 'addItem':
      return { ...state, items: [...state.items, newItem(action.method)] };
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
        id: newItem(src.method).id,
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
