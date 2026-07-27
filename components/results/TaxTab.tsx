'use client';
import { deductibleAt, taxSavingAt } from '@/lib/engine/tax';
import {
  annualCostLimit, annualDepLimit, isBusinessPassengerLimitExempt,
  marginalRate, taxRuleApplicableMonths, taxRuleMonthsFrom,
} from '@/lib/engine/taxData';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { isOwnershipMethod } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

export function TaxTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state } = props;
  if (state.common.biz === 'none') {
    return <div className="card">비사업자는 차량 비용처리(세금절감)가 없습니다. 공통 설정에서 사업자 유형을 선택하세요.</div>;
  }
  const mr = marginalRate(state.common);
  const approvedMonths = taxRuleMonthsFrom(state.common.taxStartDate);
  const displayMonths = (value: number) => Math.round(value * 10) / 10;
  return (
    <div className="card">
      <h3>비용 인정 계산 과정 (항목별 유효 비교시점의 마지막 과세기간 · 1대당 연환산)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp">
          <thead>
            <tr>
              <th>항목</th><th>연비용</th><th>감가상당액</th><th>업무사용비율</th>
              <th>업무사용금액</th><th>감가 한도초과</th><th>연 인정액</th><th>세금절감 (목표기간 누적)</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item, i) => {
              const requestedTaxMonth = isOwnershipMethod(item.method)
                ? state.common.targetMonths
                : Math.min(state.common.targetMonths, item.months);
              const taxMonth = taxRuleApplicableMonths(
                state.common,
                requestedTaxMonth,
              );
              const b = deductibleAt(item, state.common, taxMonth);
              const saving = taxSavingAt(item, state.common, state.common.targetMonths);
              const exempt =
                isBusinessPassengerLimitExempt(item.vehicle.category);
              return (
                <tr key={item.id}>
                  <td>
                    {itemTitle(item, i)}{exempt ? ' (한도제외)' : ''}
                    <div className="muted">
                      {displayMonths(taxMonth)}개월 기준
                      {!isOwnershipMethod(item.method) &&
                      state.common.targetMonths > item.months
                        ? ' · 계약만기'
                        : ''}
                      {taxMonth < requestedTaxMonth
                        ? ' · 승인 세법기간 상한'
                        : ''}
                    </div>
                  </td>
                  <td>{fmtMan(b.annualCost)}원</td>
                  <td>{fmtMan(b.depEquiv)}원</td>
                  <td style={{ textAlign: 'center' }}>{Math.round(b.ratio * 100)}%</td>
                  <td>{fmtMan(b.usedAmount)}원</td>
                  <td>{b.depExcess > 0 ? `−${fmtMan(b.depExcess)}원` : '—'}</td>
                  <td>{fmtMan(b.recognizedEach)}원</td>
                  <td>
                    {b.complianceBlocked ? '필수요건 미충족 · 0원' : `${fmtMan(saving)}원`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        한계세율 {Math.round(mr * 1000) / 10}% 적용 (누진공제 미반영 근사) ·
        한도제외 차량은 입력 업무비율 적용 (미입력 시 100% 업무사용 가정) ·
        승용차는 연 {fmtMan(annualCostLimit(state.common))}원
        (기록부 작성 시 업무비율)·감가 {fmtMan(annualDepLimit(state.common))}원 한도 (대당) ·
        세금절감 열은 목표 보유기간 누적액이며, 렌트·운용리스의 연환산 값은
        목표보다 먼저 끝나면 계약만기의 마지막 과세기간을 표시 ·
        금융리스·할부는 금융 만기 후 보유비용과 감가를 계속 반영 ·
        {state.common.taxRuleHorizon === 'approvedOnly'
          ? ` 승인된 2026 규칙 혜택은 입력 시작일부터 남은 ${displayMonths(approvedMonths)}개월까지만 적용`
          : ' 승인 규칙이 비교기간 내내 동일하다고 가정'}
      </p>
    </div>
  );
}
