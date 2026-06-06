'use client';
import { costAt } from '@/lib/engine/snapshot';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle, METHOD_LABELS } from '@/lib/state/defaults';
import { METHOD_COLORS } from '@/components/builder/ItemCard';
import { normalize, type Norm } from './ResultTabs';

const TRAITS: Record<string, [string, string, string, string]> = {
  // [초기부담, 소유권, 비용처리, 만기]
  rent: ['낮음 (선납만)', '렌트사', '렌트료 (한도 내)', '반납'],
  oplease: ['낮음 (선납만)', '리스사', '리스료 (한도 내)', '반납/인수/승계'],
  finlease: ['취득세 포함', '이용자 (자산 계상)', '감가상각+이자', '잔존가 지급 후 소유'],
  installment: ['높음 (현금+취득세)', '이용자', '감가상각+이자', '소유 유지'],
};

export function SummaryTab(props: { state: ComparisonState; result: CompareResult; norm: Norm }) {
  const { state, result, norm } = props;
  if (state.items.length === 0) {
    return <div className="card">비교 항목을 추가하면 결과가 표시됩니다.</div>;
  }
  // 만기 기준 스냅샷 (각자 자기 계약기간)
  const atEnd = state.items.map((item, i) => ({
    item, i, s: costAt(item, state.common, item.months),
  }));
  const vals = atEnd.map((x) => normalize(x.s.netCost, x.item.vehicle.count, x.item.months, norm));
  const maxAbs = Math.max(...vals.map(Math.abs), 1);
  const minVal = Math.min(...vals);
  const gb = result.globalBest;
  const gbItem = gb ? state.items.find((it) => it.id === gb.itemId) : null;
  const gbIdx = gb ? state.items.findIndex((it) => it.id === gb.itemId) : -1;

  return (
    <>
      {gb && gbItem && (
        <div className="verdict">
          <div className="muted">전체 최적 (모든 항목 × 시점 탐색)</div>
          <div className="big">
            {itemTitle(gbItem, gbIdx)} — {gb.m}개월 시점 · {gb.exitLabel}
          </div>
          <div>실질순비용 {fmtMan(gb.netCost)}원</div>
        </div>
      )}
      <div className="card">
        <h3>만기 기준 실질순비용 ({norm === 'total' ? '총액' : norm === 'perVehicle' ? '대당' : '월평균'})</h3>
        {atEnd.map((x, idx) => (
          <div className="bar-row" key={x.item.id}>
            <span className="bar-label">{itemTitle(x.item, x.i)}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(Math.abs(vals[idx]) / maxAbs) * 100}%`,
                  background: vals[idx] === minVal ? 'var(--good)' : METHOD_COLORS[x.item.method],
                  opacity: vals[idx] === minVal ? 1 : 0.45,
                }}
              />
            </div>
            <span className="bar-val">{fmtMan(vals[idx])}원</span>
          </div>
        ))}
        <p className="muted">각 항목의 자기 만기 시점 기준. 음수는 매각차익이 비용을 초과한다는 뜻.</p>
      </div>
      <div className="card">
        <h3>방식별 특징</h3>
        <table className="cmp">
          <thead>
            <tr><th>항목</th><th>초기부담</th><th>소유권</th><th>비용처리</th><th>만기</th></tr>
          </thead>
          <tbody>
            {atEnd.map((x) => (
              <tr key={x.item.id}>
                <td>{itemTitle(x.item, x.i)}</td>
                {TRAITS[x.item.method].map((t, j) => <td key={j} style={{ textAlign: 'center' }}>{t}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 6 }}>
          {atEnd.map((x) => `${METHOD_LABELS[x.item.method]} 월납 ${fmtMan(x.s.monthly)}원`).join(' · ')}
        </p>
      </div>
    </>
  );
}
