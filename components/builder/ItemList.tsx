'use client';
import { ItemCard } from './ItemCard';
import { METHOD_LABELS, newItem, nextId } from '@/lib/state/defaults';
import type { CommonProfile, FinanceItem, Method } from '@/lib/engine/types';
import type { Action } from '@/lib/state/reducer';
import { MAX_ITEMS } from '@/lib/state/persistence';

const METHODS: Method[] = ['rent', 'oplease', 'finlease', 'installment'];

export function ItemList(props: {
  items: FinanceItem[]; common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { items, common, dispatch } = props;
  const atLimit = items.length >= MAX_ITEMS;
  return (
    <>
      {items.map((item, i) => (
        <ItemCard
          key={item.id} item={item} common={common} index={i}
          canDuplicate={!atLimit}
          onChange={(it) => dispatch({ type: 'replaceItem', item: it })}
          onDuplicate={() => {
            if (!atLimit) dispatch({ type: 'duplicateItem', id: item.id, newId: nextId() });
          }}
          onRemove={() => dispatch({ type: 'removeItem', id: item.id })}
        />
      ))}
      <div className="card">
        <h3>＋ 비교 항목 추가</h3>
        <div className="row" style={{ marginBottom: 0 }}>
          {METHODS.map((m) => (
            <button
              type="button"
              key={m}
              className="btn"
              disabled={atLimit}
              onClick={() => dispatch({ type: 'addItem', item: newItem(m) })}
            >
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
        {atLimit && <p className="muted">비교 항목은 최대 {MAX_ITEMS}개까지 저장할 수 있습니다.</p>}
      </div>
    </>
  );
}
