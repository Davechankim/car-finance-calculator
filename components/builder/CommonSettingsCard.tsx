'use client';
import { MoneyInput, NumInput, SelectInput, Chips } from '@/components/ui/Field';
import { INDUSTRIES, REVENUE_LABELS } from '@/lib/engine/taxData';
import type { BizType, CommonProfile } from '@/lib/engine/types';
import type { Action } from '@/lib/state/reducer';

export function CommonSettingsCard(props: {
  common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { common, dispatch } = props;
  const set = (patch: Partial<CommonProfile>) => dispatch({ type: 'setCommon', patch });
  return (
    <div className="card">
      <h3>공통 설정</h3>
      <div className="row">
        <Chips<BizType>
          value={common.biz}
          options={[
            { key: 'none', label: '비사업자' },
            { key: 'personal', label: '개인사업자' },
            { key: 'corp', label: '법인' },
          ]}
          onChange={(biz) => set({ biz })}
        />
      </div>
      {common.biz !== 'none' && (
        <>
          <div className="row">
            <SelectInput
              label="업종" value={common.industryIndex}
              options={INDUSTRIES.map((i) => `${i.label}${i.deductRate < 1 ? ` (인정 ${i.deductRate * 100}%)` : ''}`)}
              onChange={(industryIndex) => set({ industryIndex })}
            />
            <SelectInput
              label="연매출 구간" value={common.revenueIndex}
              options={REVENUE_LABELS} onChange={(revenueIndex) => set({ revenueIndex })}
            />
          </div>
          <div className="row">
            <NumInput
              label="한계세율 직접 입력 (비우면 자동)" suffix="%"
              value={common.marginalRateOverride ?? 0}
              onChange={(v) => set({ marginalRateOverride: v > 0 ? v : null })}
            />
          </div>
        </>
      )}
      <div className="row">
        <NumInput label="자산 기대수익률" suffix="%" value={common.assetReturnPct}
          onChange={(assetReturnPct) => set({ assetReturnPct })} />
        <MoneyInput label="보상판매 (내 차)" value={common.tradeIn}
          onChange={(tradeIn) => set({ tradeIn })} />
      </div>
      <div className="section-label">비교 시점 시나리오</div>
      {common.scenarios.map((s, i) => (
        <div className="row" key={i}>
          <NumInput
            label={`시점 ${i + 1}`} suffix="개월 후" step={3} min={3} max={120} value={s.atMonths}
            onChange={(atMonths) => {
              const scenarios = common.scenarios.map((x, j) =>
                j === i ? { atMonths, label: `${Math.round(atMonths / 12 * 10) / 10}년 후` } : x);
              set({ scenarios });
            }}
          />
          <button className="btn" onClick={() => set({ scenarios: common.scenarios.filter((_, j) => j !== i) })}>삭제</button>
        </div>
      ))}
      <button
        className="btn ghost"
        onClick={() => set({
          scenarios: [...common.scenarios, { atMonths: 12, label: '1년 후' }],
        })}
      >＋ 시나리오 추가</button>
    </div>
  );
}
