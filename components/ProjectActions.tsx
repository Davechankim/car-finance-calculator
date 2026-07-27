'use client';

import { useRef } from 'react';
import type { ComparisonState } from '@/lib/engine/types';
import { defaultState } from '@/lib/state/defaults';
import {
  MAX_IMPORT_BYTES,
  parsePersistedState,
  serializeState,
  STORAGE_KEY,
} from '@/lib/state/persistence';
import type { Action } from '@/lib/state/reducer';

type Props = {
  state: ComparisonState;
  dispatch: React.Dispatch<Action>;
  onStatus: (message: string) => void;
  onEnableAutosave: () => void;
};

export function ProjectActions({ state, dispatch, onStatus, onEnableAutosave }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportProject = () => {
    try {
      const blob = new Blob([serializeState(state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `자동차-금융-비교-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onStatus('프로젝트 JSON 파일을 내보냈습니다.');
    } catch {
      onStatus('프로젝트 파일을 내보내지 못했습니다.');
    }
  };

  const importProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      onStatus('가져올 파일은 1MB 이하여야 합니다.');
      return;
    }

    try {
      const imported = parsePersistedState(await file.text());
      dispatch({ type: 'replaceState', state: imported });
      onEnableAutosave();
      onStatus('프로젝트를 가져왔습니다.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : '파일 형식을 확인해 주세요.';
      onStatus(`가져오기에 실패했습니다: ${detail}`);
    }
  };

  const resetProject = () => {
    if (!window.confirm('모든 입력을 기본값으로 초기화할까요?')) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 저장소 접근이 차단되어도 화면 초기화는 계속한다.
    }
    dispatch({ type: 'replaceState', state: defaultState() });
    onEnableAutosave();
    onStatus('모든 입력을 기본값으로 초기화했습니다.');
  };

  return (
    <div className="project-actions" aria-label="프로젝트 관리">
      <button type="button" className="btn" onClick={exportProject}>내보내기</button>
      <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
        가져오기
      </button>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={importProject}
        tabIndex={-1}
      />
      <button type="button" className="btn" onClick={resetProject}>초기화</button>
    </div>
  );
}
