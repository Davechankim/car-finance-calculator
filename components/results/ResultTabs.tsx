'use client';
import { useState } from 'react';
import { Chips } from '@/components/ui/Field';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { SummaryTab } from './SummaryTab';
import { TimelineTab } from './TimelineTab';
import { ScenarioTab } from './ScenarioTab';
import { TaxTab } from './TaxTab';
import { DetailTab } from './DetailTab';

export type Norm = 'total' | 'perVehicle' | 'perMonth';
export const normalize = (v: number, count: number, m: number, norm: Norm): number =>
  norm === 'perVehicle' ? v / count : norm === 'perMonth' ? v / Math.max(m, 1) : v;

const TABS = [
  { key: 'summary', label: '🏆 종합' },
  { key: 'timeline', label: '📈 시점별' },
  { key: 'scenario', label: '🔄 시나리오' },
  { key: 'tax', label: '🧾 세금' },
  { key: 'detail', label: '📋 상세' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function ResultTabs(props: { state: ComparisonState; result: CompareResult }) {
  const [tab, setTab] = useState<TabKey>('summary');
  const [norm, setNorm] = useState<Norm>('total');
  const single = props.state.items.length === 1;
  const effectiveTab = single && tab === 'scenario' ? 'summary' : tab;
  const showNorm = effectiveTab === 'summary' || effectiveTab === 'scenario';
  const visibleTabs = TABS.filter((t) => !(single && t.key === 'scenario'));
  const moveTabFocus = (current: TabKey, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    const index = visibleTabs.findIndex((item) => item.key === current);
    let nextIndex = index;
    if (key === 'ArrowRight') nextIndex = (index + 1) % visibleTabs.length;
    else if (key === 'ArrowLeft') nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
    else if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = visibleTabs.length - 1;
    else return;
    event.preventDefault();
    const next = visibleTabs[nextIndex].key;
    setTab(next);
    window.requestAnimationFrame(() => document.getElementById(`result-tab-${next}`)?.focus());
  };

  const panel =
    effectiveTab === 'summary' ? <SummaryTab {...props} norm={norm} /> :
    effectiveTab === 'timeline' ? <TimelineTab {...props} /> :
    effectiveTab === 'scenario' ? <ScenarioTab {...props} norm={norm} /> :
    effectiveTab === 'tax' ? <TaxTab {...props} /> :
    <DetailTab {...props} />;

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}>
          <div className="tabs" role="tablist" aria-label="결과 보기">
            {visibleTabs.map((t) => (
              <button
                type="button"
                role="tab"
                id={`result-tab-${t.key}`}
                aria-controls="result-panel"
                aria-selected={effectiveTab === t.key}
                tabIndex={effectiveTab === t.key ? 0 : -1}
                key={t.key}
                className={`tab ${effectiveTab === t.key ? 'on' : ''}`}
                onClick={() => setTab(t.key)}
                onKeyDown={(event) => moveTabFocus(t.key, event)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {showNorm && (
            <Chips<Norm>
              ariaLabel="결과 금액 표시 기준"
              value={norm}
              options={[
                { key: 'total', label: '총액' },
                { key: 'perVehicle', label: '대당' },
                { key: 'perMonth', label: '월평균' },
              ]}
              onChange={setNorm}
            />
          )}
        </div>
      </div>
      <div
        role="tabpanel"
        id="result-panel"
        aria-labelledby={`result-tab-${effectiveTab}`}
      >
        {panel}
      </div>
    </>
  );
}
