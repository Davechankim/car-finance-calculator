'use client';
import { costAt } from '@/lib/engine/snapshot';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle, METHOD_LABELS } from '@/lib/state/defaults';
import { itemColor } from './palette';
import { normalize, type Norm } from './ResultTabs';

const TRAITS: Record<string, [string, string, string, string]> = {
  // [초기부담, 소유권, 비용처리, 만기]
  rent: ['선납·보증금', '렌트사', '렌트료 (한도 내)', '반납'],
  oplease: ['선납·보증금', '리스사', '리스료 (한도 내)', '반납/인수 (승계는 중도만)'],
  finlease: ['선납·보증금·취득세', '이용자 (자산 계상)', '감가상각+이자', '잔존가 지급 후 소유'],
  installment: ['높음 (현금+취득세)', '이용자', '감가상각+이자', '소유 유지'],
};

export function SummaryTab(props: { state: ComparisonState; result: CompareResult; norm: Norm }) {
  const { state, norm } = props;
  if (state.items.length === 0) {
    return <div className="card">비교 항목을 추가하면 결과가 표시됩니다.</div>;
  }
  const targetMonths = state.common.targetMonths;
  const atTarget = state.items.map((item, i) => ({
    item, i, s: costAt(item, state.common, targetMonths),
  }));
  const vals = atTarget.map((x) =>
    normalize(x.s.netCost, x.item.vehicle.count, x.s.m, norm));
  const maxAbs = Math.max(...vals.map(Math.abs), 1);
  const comparableIndexes = atTarget
    .map((x, index) => (!x.s.ended ? index : -1))
    .filter((index) => index >= 0);
  const bestIdx = comparableIndexes.length > 0
    ? comparableIndexes.reduce((best, index) => vals[index] < vals[best] ? index : best)
    : -1;
  const best = bestIdx >= 0 ? atTarget[bestIdx] : null;
  const normLabel = norm === 'total' ? '총액' : norm === 'perVehicle' ? '대당' : '월평균';

  return (
    <>
      {best ? (
        <div className="verdict">
          <div className="muted">{targetMonths}개월 동일 보유기간 기준 최적 · {normLabel}</div>
          <div className="big">
            {itemTitle(best.item, best.i)} · {best.s.bestExit.label}
          </div>
          <div>실질순비용 {fmtMan(vals[bestIdx])}원</div>
        </div>
      ) : (
        <div className="card">
          {targetMonths}개월까지 이어지는 소유형 항목 또는 렌트·운용리스 계약이 없습니다.
          목표 보유기간을 줄이거나 계약기간을 늘려주세요.
        </div>
      )}
      <div className="card">
        <h3>{targetMonths}개월 기준 실질순비용 ({normLabel})</h3>
        {atTarget.map((x, idx) => (
          <div className={`bar-row ${x.s.ended ? 'is-ended' : ''}`} key={x.item.id}>
            <span className="bar-label">{itemTitle(x.item, x.i)}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(Math.abs(vals[idx]) / maxAbs) * 100}%`,
                  background: idx === bestIdx ? 'var(--good)' : itemColor(idx),
                  opacity: x.s.ended ? 0.2 : idx === bestIdx ? 1 : 0.45,
                }}
              />
            </div>
            <span className="bar-val">
              {fmtMan(vals[idx])}원{x.s.ended ? ' · 종료' : ''}
            </span>
          </div>
        ))}
        <p className="muted">
          장기렌트·운용리스가 목표 보유기간 전에 끝나면 최적 선정에서 제외합니다.
          금융리스·할부는 금융기간 후 월납을 멈추고 보유비용·세금·시세를 계속 반영합니다.
          음수는 매각차익이 비용을 초과한다는 뜻입니다.
        </p>
      </div>
      <div className="card">
        <h3>방식별 특징</h3>
        <div className="table-scroll">
          <table className="cmp">
            <thead>
              <tr><th>항목</th><th>초기부담</th><th>소유권</th><th>비용처리</th><th>만기</th></tr>
            </thead>
            <tbody>
              {atTarget.map((x) => (
                <tr key={x.item.id}>
                  <td>{itemTitle(x.item, x.i)}</td>
                  {TRAITS[x.item.method].map((t, j) => <td key={j} style={{ textAlign: 'center' }}>{t}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          {atTarget.map((x) => `${METHOD_LABELS[x.item.method]} 계약·금융 월납 ${fmtMan(x.s.monthly)}원`).join(' · ')}
        </p>
      </div>
    </>
  );
}
