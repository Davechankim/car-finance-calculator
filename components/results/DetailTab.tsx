'use client';
import { useState } from 'react';
import { Chips, NumInput } from '@/components/ui/Field';
import { costAt } from '@/lib/engine/snapshot';
import { financials, vatRefundCumEach } from '@/lib/engine/costAt';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

export function DetailTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state } = props;
  const [sel, setSel] = useState(0);
  const [m, setM] = useState(24);
  if (state.items.length === 0) return <div className="card">비교 항목을 추가하세요.</div>;

  const item = state.items[Math.min(sel, state.items.length - 1)];
  const s = costAt(item, state.common, m);
  const f = financials(item);
  const count = item.vehicle.count;
  const vatCum = vatRefundCumEach(item, state.common, s.m) * count;

  const parts: { label: string; value: number }[] = [
    { label: '선납금', value: f.downEach * count },
    { label: '현금 추가 (할부)', value: f.cashExtraEach * count },
    { label: '취득세', value: f.acqTaxEach * count },
    { label: `누적 납입 (${s.m}개월)`, value: f.monthly * s.m * count },
    { label: '보험·정비 누적', value: (item.insuranceYr + item.maintenanceYr) * (s.m / 12) * count },
    { label: '보상판매 차감', value: -state.common.tradeIn },
    { label: '부가세 환급', value: -vatCum },
    { label: `출구 정산 (${s.bestExit.label})`, value: s.bestExit.cost - s.sunk },
    { label: '세금절감', value: -s.taxSaving },
    { label: '기회비용', value: s.oppCost },
  ].filter((p) => p.value !== 0);
  const maxAbs = Math.max(...parts.map((p) => Math.abs(p.value)), 1);

  return (
    <div className="card">
      <h3>비용 구성 분해</h3>
      <div className="row">
        <Chips
          value={String(Math.min(sel, state.items.length - 1))}
          options={state.items.map((it, i) => ({ key: String(i), label: itemTitle(it, i) }))}
          onChange={(k) => setSel(Number(k))}
        />
        <NumInput label="시점" suffix="개월" step={3} min={0} max={item.months} value={m} onChange={setM} />
      </div>
      {parts.map((p) => (
        <div className="bar-row" key={p.label}>
          <span className="bar-label">{p.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{
              width: `${(Math.abs(p.value) / maxAbs) * 100}%`,
              background: p.value < 0 ? 'var(--good)' : '#94a3b8',
            }} />
          </div>
          <span className="bar-val" style={{ color: p.value < 0 ? 'var(--good)' : undefined }}>
            {fmtMan(p.value)}원
          </span>
        </div>
      ))}
      <div className="row" style={{ justifyContent: 'flex-end', fontWeight: 700 }}>
        실질순비용 = {fmtMan(s.netCost)}원 {s.ended ? '(만기 고정)' : ''}
      </div>
      <p className="muted">
        월납 {fmtMan(s.monthly)}원/대 · 원금 {fmtMan(s.principal)}원/대 · 시세 {fmtMan(s.resaleEach)}원/대 ·
        연 인정액 {fmtMan(s.annualDeductible)}원/대
      </p>
    </div>
  );
}
