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
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}>
          <div className="tabs">
            {TABS.filter((t) => !(single && t.key === 'scenario')).map((t) => (
              <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <Chips<Norm>
            value={norm}
            options={[
              { key: 'total', label: '총액' },
              { key: 'perVehicle', label: '대당' },
              { key: 'perMonth', label: '월평균' },
            ]}
            onChange={setNorm}
          />
        </div>
      </div>
      {tab === 'summary' && <SummaryTab {...props} norm={norm} />}
      {tab === 'timeline' && <TimelineTab {...props} />}
      {tab === 'scenario' && <ScenarioTab {...props} norm={norm} />}
      {tab === 'tax' && <TaxTab {...props} />}
      {tab === 'detail' && <DetailTab {...props} />}
    </>
  );
}
