'use client';
import { deductibleAt, taxSavingAt } from '@/lib/engine/tax';
import { marginalRate } from '@/lib/engine/taxData';
import { isExempt } from '@/lib/engine/taxData';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

export function TaxTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state } = props;
  if (state.common.biz === 'none') {
    return <div className="card">비사업자는 차량 비용처리(세금절감)가 없습니다. 공통 설정에서 사업자 유형을 선택하세요.</div>;
  }
  const mr = marginalRate(state.common);
  return (
    <div className="card">
      <h3>비용 인정 계산 과정 (각 항목 만기 기준 · 1대당 연간)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp">
          <thead>
            <tr>
              <th>항목</th><th>연비용</th><th>감가상당액</th><th>업무사용비율</th>
              <th>업무사용금액</th><th>감가 한도초과</th><th>연 인정액</th><th>세금절감 (만기·전체)</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item, i) => {
              const b = deductibleAt(item, state.common, item.months);
              const saving = taxSavingAt(item, state.common, item.months);
              const exempt = isExempt(item.vehicle.category);
              return (
                <tr key={item.id}>
                  <td>{itemTitle(item, i)}{exempt ? ' (한도제외)' : ''}</td>
                  <td>{fmtMan(b.annualCost)}원</td>
                  <td>{fmtMan(b.depEquiv)}원</td>
                  <td style={{ textAlign: 'center' }}>{Math.round(b.ratio * 100)}%</td>
                  <td>{fmtMan(b.usedAmount)}원</td>
                  <td>{b.depExcess > 0 ? `−${fmtMan(b.depExcess)}원` : '—'}</td>
                  <td>{fmtMan(b.recognizedEach)}원</td>
                  <td className="best">{fmtMan(saving)}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        한계세율 {Math.round(mr * 1000) / 10}% 적용 (누진공제 미반영 근사) ·
        한도제외 차량은 전액 인정 · 승용차는 연 1,500만(기록부 작성 시 업무비율)·감가 800만 한도 (대당)
      </p>
    </div>
  );
}
