'use client';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { CommonSettingsCard } from '@/components/builder/CommonSettingsCard';
import { ItemList } from '@/components/builder/ItemList';
import { ProjectActions } from '@/components/ProjectActions';
import { ResultTabs } from '@/components/results/ResultTabs';
import { compareAll } from '@/lib/engine/compare';
import { defaultState } from '@/lib/state/defaults';
import { parsePersistedState, serializeState, STORAGE_KEY } from '@/lib/state/persistence';
import { reducer } from '@/lib/state/reducer';

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [storageStatus, setStorageStatus] = useState('입력 내용은 이 브라우저에 자동 저장됩니다.');
  const result = useMemo(() => compareAll(state), [state]);

  useEffect(() => {
    let canAutosave = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        dispatch({ type: 'replaceState', state: parsePersistedState(saved) });
        setStorageStatus('이전에 저장한 프로젝트를 불러왔습니다.');
      }
    } catch {
      canAutosave = false;
      setStorageStatus('저장 데이터가 손상되어 원본을 보존했습니다. 가져오기 또는 초기화 후 자동 저장됩니다.');
    } finally {
      setAutosaveEnabled(canAutosave);
    }
  }, []);

  useEffect(() => {
    if (!autosaveEnabled) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, serializeState(state));
        setStorageStatus('입력 내용이 이 브라우저에 자동 저장되었습니다.');
      } catch {
        setStorageStatus('브라우저 저장소를 사용할 수 없어 자동 저장하지 못했습니다.');
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [autosaveEnabled, state]);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>🚗 자동차 금융 비교 계산기</h1>
          <span className="sub">장기렌트 · 운용리스 · 금융리스 · 할부 — 자유 조합 비교</span>
        </div>
        <div className="topbar-tools">
          <ProjectActions
            state={state}
            dispatch={dispatch}
            onStatus={setStorageStatus}
            onEnableAutosave={() => setAutosaveEnabled(true)}
          />
          <span className="save-status" role="status" aria-live="polite">{storageStatus}</span>
        </div>
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
            ① 한계세율 근사(누진공제 미반영) ② 감가상각 한도 초과액 이월 미반영
            ③ 기회비용 단리
            ④ 위약금·정산식은 금융사 약관별 상이 ⑤ 보상판매는 현금 차감 처리
            ⑥ 부가세는 일반과세자·세금계산서 수취 가정(매각손익의 소득·법인세 미반영)
            ⑦ 업무전용보험·법인 전용번호판 요건은 단순화해 적용
            (부분 가입일수·개인사업자 1대 예외 미반영)
            ⑧ 시세는 단순 감가커브(직접입력으로 보완 가능)
            ⑨ 렌트 부가세 환급은 월렌트료 전액이 과세분이라고 가정(선납분 미환급)
            ⑩ 운용리스 비용 인정액은 월 납입액의 93% 근사
            ⑪ 한도 제외 차량은 업무비율 미입력 시 100% 업무사용 가정.
            실제 계약 전 금융사 견적과 세무사 확인이 필요합니다.
          </div>
        </div>
      </div>
    </main>
  );
}
