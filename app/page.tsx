'use client';
import { useMemo, useReducer } from 'react';
import { CommonSettingsCard } from '@/components/builder/CommonSettingsCard';
import { ItemList } from '@/components/builder/ItemList';
import { ResultTabs } from '@/components/results/ResultTabs';
import { compareAll } from '@/lib/engine/compare';
import { defaultState } from '@/lib/state/defaults';
import { reducer } from '@/lib/state/reducer';

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const result = useMemo(() => compareAll(state), [state]);

  return (
    <main>
      <div className="topbar">
        <h1>🚗 자동차 금융 비교 계산기</h1>
        <span className="sub">장기렌트 · 운용리스 · 금융리스 · 할부 — 자유 조합 비교</span>
      </div>
      <div className="shell">
        <div className="builder-col">
          <CommonSettingsCard common={state.common} dispatch={dispatch} />
          <ItemList items={state.items} common={state.common} dispatch={dispatch} />
        </div>
        <div className="results-col">
          {state.items.length === 0 ? (
            <div className="card empty-state">
              <p style={{ fontSize: 15, marginBottom: 8 }}>비교 항목이 없습니다</p>
              <p>왼쪽에서 [＋ 비교 항목 추가]로 시작하세요.</p>
            </div>
          ) : (
            <ResultTabs state={state} result={result} />
          )}
          <div className="card disclaimer">
            <strong>한계·면책</strong> — 본 도구는 상대 비교·의사결정 보조용입니다.
            ① 한계세율 근사(누진공제 미반영) ② 감가상각 800만 이월 단순화 ③ 기회비용 단리
            ④ 위약금·정산식은 금융사 약관별 상이 ⑤ 보상판매는 현금 차감 처리
            ⑥ 부가세 환급은 일반과세자 가정 ⑦ 업무전용보험 미가입 페널티 미계산(경고만)
            ⑧ 시세는 단순 감가커브(직접입력으로 보완 가능)
            ⑨ 렌트 부가세 환급은 월렌트료 기준(선납분 미환급).
            실제 계약 전 금융사 견적과 세무사 확인이 필요합니다.
          </div>
        </div>
      </div>
    </main>
  );
}
