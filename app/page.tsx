'use client';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { CommonSettingsCard } from '@/components/builder/CommonSettingsCard';
import { ItemList } from '@/components/builder/ItemList';
import { ProjectActions } from '@/components/ProjectActions';
import { AdSlot } from '@/components/AdSlot';
import { ResultTabs } from '@/components/results/ResultTabs';
import { compareAll } from '@/lib/engine/compare';
import { defaultState } from '@/lib/state/defaults';
import {
  parsePersistedProject, serializeState, STORAGE_KEY,
} from '@/lib/state/persistence';
import { reducer } from '@/lib/state/reducer';

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [taxRuleMigrationPending, setTaxRuleMigrationPending] = useState(false);
  const [storageStatus, setStorageStatus] = useState('입력 내용은 이 브라우저에 자동 저장됩니다.');
  const result = useMemo(() => compareAll(state), [state]);

  useEffect(() => {
    let canAutosave = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = parsePersistedProject(saved);
        dispatch({ type: 'replaceState', state: restored.state });
        if (restored.taxRuleMismatch) {
          canAutosave = false;
          setTaxRuleMigrationPending(true);
          setStorageStatus(
            `이전 세법 규칙(${restored.sourceTaxRuleSetId ?? '알 수 없음'})의 입력을 복구했습니다. 원본은 보존 중이며 현재 규칙으로 다시 저장할 수 있습니다.`,
          );
        } else {
          setStorageStatus('이전에 저장한 프로젝트를 불러왔습니다.');
        }
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
            taxRuleMigrationPending={taxRuleMigrationPending}
            onEnableAutosave={() => {
              setTaxRuleMigrationPending(false);
              setAutosaveEnabled(true);
            }}
          />
          <span className="save-status" role="status" aria-live="polite">{storageStatus}</span>
        </div>
      </div>
      <section className="calculator-intro" aria-labelledby="calculator-intro-title">
        <div>
          <h2 id="calculator-intro-title">같은 보유기간으로 실제 현금흐름을 비교하세요</h2>
          <p>
            광고성 월납 비교가 아니라 선납금, 보증금, 금융 원리금, 보험·자동차세·정비,
            중도정산, 예상 매각가와 세금효과를 한 흐름으로 계산합니다. 견적 월납에
            부대비용이 섞여 있다면 항목별로 나눠 입력해 잔여채무가 과도하게 줄어드는
            오류를 피할 수 있습니다.
          </p>
        </div>
        <div className="intro-links">
          <a href="/guide">처음 사용하는 방법</a>
          <a href="/methodology">공식·세금 근거와 한계</a>
        </div>
      </section>
      <AdSlot
        placement="calculatorTop"
        label="계산기 안내 다음 광고"
      />
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
            ⑥ 부가세는 일반과세·VAT 적격 차종·적격 증빙을 모두 선택한 경우만
            매입세액 공제. 과세사업용 자산 매각 VAT는 별도 선택
            (매각손익의 소득·법인세 미반영)
            ⑦ 업무전용보험·법인 전용번호판 요건은 단순화해 적용
            (부분 가입일수·개인사업자 1대 예외 미반영)
            ⑧ 시세는 단순 감가커브(직접입력으로 보완 가능)
            ⑨ 렌트 부가세 환급은 선납금과 입력한 차량대금·정비·서비스 포함분을
            과세분으로 보되 실제 세금계산서 구성을 확인해야 함
            ⑩ 운용리스 감가상각비 상당액은 입력한 금융·리스료에서
            보험·자동차세·정비 포함분을 제외하되 정비비 미구분 시 차감 후
            금액의 7%를 정비비로 적용
            ⑪ 한도 제외 차량은 업무비율 미입력 시 100% 업무사용 가정
            ⑫ 기본 설정은 입력한 시작일부터 2026-12-31까지 승인된 범위만
            세금절감·VAT 환급 혜택을 계산하며, 기간 밖 납부세금은 과소계상
            방지를 위해 2026 규칙을 보수 적용.
            실제 계약 전 금융사 견적과 세무사 확인이 필요합니다.
          </div>
        </div>
      </div>
      <AdSlot
        placement="calculatorBottom"
        label="계산 결과 다음 광고"
      />
    </main>
  );
}
