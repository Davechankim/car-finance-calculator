'use client';
import { useState } from 'react';
import { Chips, NumInput } from '@/components/ui/Field';
import { costAt } from '@/lib/engine/snapshot';
import {
  cumulativeFinancePaymentsEach, financials, ownershipMaturityNetOutflowEach,
  postFinanceYearsAt, vatRefundCumEach,
} from '@/lib/engine/costAt';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { isOwnershipMethod } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

export function DetailTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state } = props;
  const [sel, setSel] = useState(0);
  const [m, setM] = useState(24);
  if (state.items.length === 0) return <div className="card">비교 항목을 추가하세요.</div>;

  const item = state.items[Math.min(sel, state.items.length - 1)];
  const analysisLimit = isOwnershipMethod(item.method)
    ? Math.max(
        item.months,
        state.common.targetMonths,
        ...state.common.scenarios.map((scenario) => scenario.atMonths),
      )
    : item.months;
  const effM = Math.min(m, analysisLimit);
  const s = costAt(item, state.common, effM);
  const f = financials(item, state.common);
  const count = item.vehicle.count;
  const paymentMonths = Math.min(s.m, item.months);
  const vatCum = vatRefundCumEach(item, state.common, s.m) * count;
  const cumulativeFinancePaid =
    cumulativeFinancePaymentsEach(item, paymentMonths) * count;
  const financePaymentWasCapped =
    cumulativeFinancePaid + 0.5 <
    f.financeMonthly * paymentMonths * count;
  const postFinanceYears = postFinanceYearsAt(item, s.m);

  const parts: { label: string; value: number }[] = [
    { label: '선납금', value: f.downEach * count },
    { label: '반환형 보증금', value: f.depositEach * count },
    { label: '현금 추가 (할부)', value: f.cashExtraEach * count },
    { label: '취득세', value: f.acqTaxEach * count },
    { label: '기타 초기비용', value: item.upfrontFee * count },
    {
      label:
        `누적 금융·차량대금 (${paymentMonths}개월` +
        `${financePaymentWasCapped ? ' · 조기완납 상한' : ''})`,
      value: cumulativeFinancePaid,
    },
    {
      label: `월납 포함 부대비용 (${paymentMonths}개월)`,
      value: f.monthlyAncillary * paymentMonths * count,
    },
    {
      label: '월납 외 보유기간 전체 보험·자동차세·정비 누적',
      value:
        (item.insuranceYr + item.vehicleTaxYr + item.maintenanceYr) *
        (s.m / 12) *
        count,
    },
    {
      label: '금융 종료 후 추가 보험·자동차세·정비 누적',
      value:
        (
          item.postFinanceAnnualCosts.insurance +
          item.postFinanceAnnualCosts.vehicleTax +
          item.postFinanceAnnualCosts.maintenance
        ) *
        postFinanceYears *
        count,
    },
    {
      label: '금융 만기 정산·보증금 반환',
      value:
        isOwnershipMethod(item.method) && s.m >= item.months
          ? ownershipMaturityNetOutflowEach(item) * count
          : 0,
    },
    { label: '보상판매 차감', value: -state.common.tradeIn },
    { label: '부가세 환급', value: -vatCum },
    { label: `출구 정산 순효과 (${s.bestExit.label})`, value: s.bestExit.cost - s.sunk },
    { label: '세금절감', value: -s.taxSaving },
    { label: '기회비용', value: s.oppCost },
  ].filter((p) => p.value !== 0);
  const maxAbs = Math.max(...parts.map((p) => Math.abs(p.value)), 1);

  return (
    <div className="card">
      <h3>비용 구성 분해</h3>
      <div className="row">
        <Chips
          ariaLabel="상세 비교 항목"
          value={String(Math.min(sel, state.items.length - 1))}
          options={state.items.map((it, i) => ({ key: String(i), label: itemTitle(it, i) }))}
          onChange={(k) => setSel(Number(k))}
        />
        <NumInput label="보유 시점" suffix="개월" step={3} min={0} max={analysisLimit} integer value={effM}
          onChange={(v) => setM(Math.min(v, analysisLimit))} />
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
        실질순비용 = {fmtMan(s.netCost)}원 {s.ended ? '(계약 만기 고정)' : ''}
      </div>
      <p className="muted">
        총 월납 {fmtMan(s.monthly)}원/대 · 금융·차량대금 {fmtMan(s.financeMonthly)}원/대 ·
        월 부대비용 {fmtMan(s.monthlyAncillary)}원/대 ·
        최초 금융잔액 {fmtMan(s.principal)}원/대 · 시세 {fmtMan(s.resaleEach)}원/대 ·
        연 인정액 {fmtMan(s.annualDeductible)}원/대
      </p>
    </div>
  );
}
