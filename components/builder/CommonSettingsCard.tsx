'use client';
import { MoneyInput, NumInput, SelectInput, Chips, Toggle } from '@/components/ui/Field';
import { INDUSTRIES, REVENUE_LABELS } from '@/lib/engine/taxData';
import type { BizType, CommonProfile } from '@/lib/engine/types';
import { MAX_SCENARIOS } from '@/lib/state/persistence';
import type { Action } from '@/lib/state/reducer';

export function CommonSettingsCard(props: {
  common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { common, dispatch } = props;
  const set = (patch: Partial<CommonProfile>) => dispatch({ type: 'setCommon', patch });
  const atScenarioLimit = common.scenarios.length >= MAX_SCENARIOS;
  return (
    <div className="card">
      <h3>공통 설정</h3>
      <div className="row">
        <Chips<BizType>
          ariaLabel="사업자 유형"
          value={common.biz}
          options={[
            { key: 'none', label: '비사업자' },
            { key: 'personal', label: '개인사업자' },
            { key: 'corp', label: '법인' },
          ]}
          onChange={(biz) => set({
            biz,
            smallRealEstateCorp: biz === 'corp' ? common.smallRealEstateCorp : false,
            personalInsuranceRequired:
              biz === 'personal' ? common.personalInsuranceRequired : false,
          })}
        />
      </div>
      {common.biz !== 'none' && (
        <>
          <div className="row">
            <SelectInput
              label="업종" value={common.industryIndex}
              options={INDUSTRIES.map((i) => i.label)}
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
              min={0}
              max={100}
              empty={common.marginalRateOverride == null}
              onEmpty={() => set({ marginalRateOverride: null })}
              onChange={(marginalRateOverride) => set({ marginalRateOverride })}
            />
          </div>
          {common.biz === 'personal' && (
            <div className="row">
              <Toggle
                label="업무전용자동차보험 의무 대상 (성실신고확인대상·전문직 등)"
                checked={common.personalInsuranceRequired}
                onChange={(personalInsuranceRequired) => set({ personalInsuranceRequired })}
              />
            </div>
          )}
        </>
      )}
      <div className="row">
        <NumInput label="자산 기대수익률" suffix="%" min={-100} max={100}
          value={common.assetReturnPct}
          onChange={(assetReturnPct) => set({ assetReturnPct })} />
        <MoneyInput label="보상판매 (내 차)" value={common.tradeIn}
          onChange={(tradeIn) => set({ tradeIn })} />
      </div>
      <div className="row">
        <NumInput
          label="목표 보유기간" suffix="개월" step={3} min={3} max={120}
          integer
          value={common.targetMonths}
          onChange={(targetMonths) => set({ targetMonths })}
        />
      </div>
      {common.biz === 'corp' && (
        <div className="row">
          <Toggle
            label="부동산임대업 주업 소규모 법인 특례 3요건 모두 충족"
            checked={common.smallRealEstateCorp}
            onChange={(smallRealEstateCorp) => set({ smallRealEstateCorp })}
          />
        </div>
      )}
      <div className="section-label">비교 시점 시나리오</div>
      {common.scenarios.map((s, i) => (
        <div className="row" key={s.atMonths}>
          <NumInput
            label={`시점 ${i + 1}`} suffix="개월 후" step={3} min={3} max={120} value={s.atMonths}
            integer
            onChange={(atMonths) => {
              if (common.scenarios.some((x, j) => j !== i && x.atMonths === atMonths)) return false;
              props.dispatch({
                type: 'updateScenario',
                index: i,
                scenario: {
                  atMonths,
                  label: `${Math.round(atMonths / 12 * 10) / 10}년 후`,
                },
              });
              return true;
            }}
          />
          <button
            type="button"
            className="btn"
            aria-label={`${s.atMonths}개월 시나리오 삭제`}
            onClick={() => props.dispatch({ type: 'removeScenario', index: i })}
          >삭제</button>
        </div>
      ))}
      <button
        type="button"
        className="btn ghost"
        disabled={atScenarioLimit}
        onClick={() => {
          const used = new Set(common.scenarios.map((s) => s.atMonths));
          const candidates = [...Array.from({ length: 37 }, (_, i) => 12 + i * 3), 3, 6, 9];
          const at = candidates
            .find((candidate) => !used.has(candidate));
          if (at == null) return;
          props.dispatch({
            type: 'addScenario',
            scenario: {
              atMonths: at,
              label: `${Math.round((at / 12) * 10) / 10}년 후`,
            },
          });
        }}
      >＋ 시나리오 추가</button>
      {atScenarioLimit && (
        <p className="muted">비교 시나리오는 최대 {MAX_SCENARIOS}개까지 추가할 수 있습니다.</p>
      )}
    </div>
  );
}
