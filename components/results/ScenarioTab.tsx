'use client';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';
import { normalize, type Norm } from './ResultTabs';

export function ScenarioTab(props: { state: ComparisonState; result: CompareResult; norm: Norm }) {
  const { state, result, norm } = props;
  if (result.scenarioRows.length === 0) {
    return <div className="card">공통 설정에서 비교 시점 시나리오를 추가하세요.</div>;
  }
  return (
    <div className="card">
      <h3>시나리오별 실질순비용 — 시점마다 최적 출구 방법 자동 선택</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp">
          <thead>
            <tr>
              <th>시점</th>
              {state.items.map((it, i) => <th key={it.id}>{itemTitle(it, i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.scenarioRows.map((row) => (
              <tr key={row.scenario.atMonths}>
                <td>{row.scenario.label} ({row.scenario.atMonths}개월)</td>
                {row.cells.map((cell) => {
                  const item = state.items.find((it) => it.id === cell.itemId)!;
                  const v = normalize(cell.snapshot.netCost, item.vehicle.count, cell.snapshot.m, norm);
                  return (
                    <td key={cell.itemId} className={row.bestItemId === cell.itemId ? 'best' : ''}>
                      {fmtMan(v)}원
                      <div className="muted">
                        {cell.snapshot.bestExit.label}{cell.snapshot.ended ? ' · 만기 종료' : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
