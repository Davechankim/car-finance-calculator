'use client';
import { ItemCard } from './ItemCard';
import { METHOD_LABELS } from '@/lib/state/defaults';
import type { CommonProfile, FinanceItem, Method } from '@/lib/engine/types';
import type { Action } from '@/lib/state/reducer';

const METHODS: Method[] = ['rent', 'oplease', 'finlease', 'installment'];

export function ItemList(props: {
  items: FinanceItem[]; common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { items, common, dispatch } = props;
  return (
    <>
      {items.map((item, i) => (
        <ItemCard
          key={item.id} item={item} common={common} index={i}
          onChange={(it) => dispatch({ type: 'replaceItem', item: it })}
          onDuplicate={() => dispatch({ type: 'duplicateItem', id: item.id })}
          onRemove={() => dispatch({ type: 'removeItem', id: item.id })}
        />
      ))}
      <div className="card">
        <h3>＋ 비교 항목 추가</h3>
        <div className="row" style={{ marginBottom: 0 }}>
          {METHODS.map((m) => (
            <button key={m} className="btn" onClick={() => dispatch({ type: 'addItem', method: m })}>
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
