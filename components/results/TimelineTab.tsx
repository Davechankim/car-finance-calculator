'use client';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

const PALETTE = ['#2563eb', '#059669', '#9333ea', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#db2777'];

export function TimelineTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state, result } = props;
  if (result.series.length === 0) return <div className="card">비교 항목을 추가하세요.</div>;

  // 행: { m, a0: 진행값, e0: 만기후값, a1: …, … }
  const rows = result.gridMonths.map((m) => {
    const row: Record<string, number | null> = { m };
    result.series.forEach((s, i) => {
      const p = s.points.find((x) => x.m === m)!;
      row[`a${i}`] = p.ended ? null : p.netCost;
      row[`e${i}`] = p.ended ? p.netCost : null;
    });
    // 점선이 실선 끝점에서 이어지도록 만기점은 양쪽에 넣는다
    result.series.forEach((s, i) => {
      const item = state.items[i];
      if (m === item.months) row[`e${i}`] = row[`a${i}`];
    });
    return row;
  });

  return (
    <>
      <div className="card">
        <h3>시점별 실질순비용 (3개월 단위) — ★ = 항목별 최적 시점</h3>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="#eef2f7" />
            <XAxis dataKey="m" tickFormatter={(m) => `${m}M`} fontSize={11} />
            <YAxis tickFormatter={(v) => fmtMan(v)} fontSize={11} width={80} />
            <Tooltip
              formatter={(v: number) => `${fmtMan(v)}원`}
              labelFormatter={(m) => `${m}개월 시점`}
            />
            <Legend />
            {result.series.map((s, i) => {
              const item = state.items[i];
              const color = PALETTE[i % PALETTE.length];
              return [
                <Line key={`a${i}`} dataKey={`a${i}`} name={itemTitle(item, i)}
                  stroke={color} strokeWidth={2} dot={false} connectNulls={false} />,
                <Line key={`e${i}`} dataKey={`e${i}`} name={`${itemTitle(item, i)} (만기 후)`}
                  stroke={color} strokeWidth={1.5} strokeDasharray="4 4" dot={false}
                  legendType="none" connectNulls={false} />,
                <ReferenceDot key={`b${i}`} x={s.bestPoint.m} y={s.bestPoint.netCost}
                  r={5} fill={color} stroke="#fff" label={{ value: '★', fontSize: 12 }} />,
              ];
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>시점별 표 — 행마다 최저 비용 항목 강조</h3>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table className="cmp">
            <thead>
              <tr>
                <th>시점</th>
                {state.items.map((it, i) => <th key={it.id}>{itemTitle(it, i)}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.gridMonths.map((m) => {
                const vals = result.series.map((s) => s.points.find((p) => p.m === m)!);
                const live = vals.filter((p) => !p.ended).map((p) => p.netCost);
                const min = Math.min(...(live.length ? live : vals.map((p) => p.netCost)));
                return (
                  <tr key={m}>
                    <td>{m}개월</td>
                    {vals.map((p, i) => (
                      <td key={i} className={p.netCost === min ? 'best' : ''}>
                        {fmtMan(p.netCost)}원{p.ended ? <span className="muted"> 종료</span> : ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">항목별 최적: {result.series.map((s, i) =>
          `${itemTitle(state.items[i], i)} → ${s.bestPoint.m}개월 (${fmtMan(s.bestPoint.netCost)}원, ${s.bestPoint.exitLabel})`,
        ).join(' / ')}</p>
      </div>
    </>
  );
}
