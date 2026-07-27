'use client';
import {
  MoneyInput, NumInput, SelectInput, Chips, Toggle, WarnBadge,
} from '@/components/ui/Field';
import {
  INDUSTRIES, REVENUE_LABELS, TAX_RULE_EFFECTIVE_FROM,
  TAX_RULE_EFFECTIVE_THROUGH, taxRuleMonthsFrom,
} from '@/lib/engine/taxData';
import type {
  BizType, CommonProfile, TaxRuleHorizon, VatTaxType,
} from '@/lib/engine/types';
import { MAX_SCENARIOS } from '@/lib/state/persistence';
import type { Action } from '@/lib/state/reducer';

export function CommonSettingsCard(props: {
  common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { common, dispatch } = props;
  const set = (patch: Partial<CommonProfile>) => dispatch({ type: 'setCommon', patch });
  const atScenarioLimit = common.scenarios.length >= MAX_SCENARIOS;
  const approvedMonths = taxRuleMonthsFrom(common.taxStartDate);
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
            vatTaxType:
              biz === 'corp' && common.vatTaxType === 'simplified'
                ? 'general'
                : common.vatTaxType,
            smallRealEstateCorp: biz === 'corp' ? common.smallRealEstateCorp : false,
            personalInsuranceRequired:
              biz === 'personal' ? common.personalInsuranceRequired : false,
          })}
        />
      </div>
      {common.biz !== 'none' && (
        <>
          <div className="section-label">부가세 과세유형</div>
          <div className="row">
            <Chips<VatTaxType>
              ariaLabel="부가세 과세유형"
              value={common.vatTaxType}
              options={[
                { key: 'general', label: '일반과세' },
                ...(common.biz === 'personal'
                  ? [{ key: 'simplified' as const, label: '간이과세' }]
                  : []),
                { key: 'exempt', label: '면세' },
                { key: 'mixedOrUncertain', label: '겸영·불확실' },
              ]}
              onChange={(vatTaxType) => set({ vatTaxType })}
            />
          </div>
          {common.vatTaxType !== 'general' && (
            <p className="muted" style={{ marginBottom: 8 }}>
              현재 모델은 일반과세자만 매입 VAT 공제를 계산합니다.
              선택한 유형은 보수적으로 VAT 환급 0원 처리합니다.
              {common.vatTaxType === 'simplified' &&
                ' 과세사업용 자산 매각 VAT는 선택 업종의 법정 부가가치율로 추정합니다.'}
              {common.vatTaxType === 'mixedOrUncertain' &&
                ' 과세사업용 자산 매각 VAT는 과소계상 방지를 위해 10/110을 적용합니다.'}
              {common.vatTaxType === 'exempt' &&
                ' 면세사업 전용 자산에는 매각 VAT를 적용하지 않습니다.'}
            </p>
          )}
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
          <div className="section-label">세법 적용기간</div>
          <div className="row">
            <div className="field">
              <label htmlFor="tax-start-date">계산·차량 사용 시작일</label>
              <input
                id="tax-start-date"
                type="date"
                min={TAX_RULE_EFFECTIVE_FROM}
                max={TAX_RULE_EFFECTIVE_THROUGH}
                value={common.taxStartDate}
                onChange={(event) => set({ taxStartDate: event.target.value })}
              />
            </div>
          </div>
          <div className="row">
            <Chips<TaxRuleHorizon>
              ariaLabel="세법 적용기간"
              value={common.taxRuleHorizon}
              options={[
                {
                  key: 'approvedOnly',
                  label: `남은 승인기간 ${Math.round(approvedMonths * 10) / 10}개월만`,
                },
                { key: 'assumeUnchanged', label: '이후에도 동일 가정' },
              ]}
              onChange={(taxRuleHorizon) => set({ taxRuleHorizon })}
            />
          </div>
          {common.taxRuleHorizon === 'assumeUnchanged' ? (
            <div className="row">
              <WarnBadge>
                2026 승인 규칙이 이후에도 바뀌지 않는다는 시나리오입니다.
              </WarnBadge>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 8 }}>
                입력 시작일부터 {TAX_RULE_EFFECTIVE_THROUGH}까지의 승인 범위를
                넘어서는 기간에는 세금절감과 VAT 환급 같은 혜택을 추가하지
                않습니다. 매각 VAT와 인수 취득세는 0원 절벽을 막기 위해
                2026 규칙을 보수적으로 계속 적용합니다.
              </p>
              {approvedMonths <= 0 && (
                <div className="row">
                  <WarnBadge>
                    현재 승인 범위 밖의 시작일이라 세금혜택은 0원이며,
                    납부세금만 2026 규칙으로 보수 추정합니다.
                  </WarnBadge>
                </div>
              )}
            </>
          )}
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
        <>
          <div className="row">
            <Toggle
              label="부동산임대업 주업 소규모 법인 특례 3요건 모두 충족"
              checked={common.smallRealEstateCorp}
              onChange={(smallRealEstateCorp) => set({ smallRealEstateCorp })}
            />
          </div>
          {common.smallRealEstateCorp && (
            <p className="muted" style={{ marginBottom: 8 }}>
              차량 비용한도만 500만·감가상당액 한도 400만원으로 바뀝니다.
              2026 소규모법인 세율 대상·제외법인·과세표준은 별도이므로 세율을
              자동 20%로 강제하지 않습니다.
            </p>
          )}
        </>
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
