'use client';
import { useId, useState } from 'react';
import { Chips, MoneyInput, NumInput, PctOrAmountInput, SelectInput, Toggle, WarnBadge } from '@/components/ui/Field';
import { fmtMan } from '@/lib/format';
import {
  cumulativeFinancePaymentsEach, financials,
} from '@/lib/engine/costAt';
import {
  CATEGORIES, categoryMeta, isBusinessPassengerLimitExempt,
  isVatInputCreditEligible,
} from '@/lib/engine/taxData';
import { resolveAmount } from '@/lib/engine/types';
import type { CommonProfile, FinanceItem, VehicleCategory } from '@/lib/engine/types';
import { METHOD_LABELS } from '@/lib/state/defaults';

export const METHOD_COLORS: Record<FinanceItem['method'], string> = {
  rent: '#2563eb', oplease: '#059669', finlease: '#9333ea', installment: '#d97706',
};

export function ItemCard(props: {
  item: FinanceItem; common: CommonProfile; index: number;
  canDuplicate: boolean;
  onChange: (item: FinanceItem) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const { item, common } = props;
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const titleId = `${contentId}-title`;
  const vehicleNameId = `${contentId}-vehicle-name`;
  const itemNameId = `${contentId}-item-name`;
  const set = (patch: Partial<FinanceItem>) => props.onChange({ ...item, ...patch });
  const setMonthlyQuote = (patch: Partial<FinanceItem['monthlyQuote']>) =>
    set({ monthlyQuote: { ...item.monthlyQuote, ...patch } });
  const setPostFinanceAnnualCosts = (
    patch: Partial<FinanceItem['postFinanceAnnualCosts']>,
  ) => set({
    postFinanceAnnualCosts: {
      ...item.postFinanceAnnualCosts,
      ...patch,
    },
  });
  const P = item.vehicle.price;
  const downA = resolveAmount(item.down, P);
  const resA = resolveAmount(item.residual, P);
  const hasResidual = item.method !== 'installment';
  const hasRefundableDeposit = item.method !== 'installment';
  const owns = item.method === 'finlease' || item.method === 'installment';
  const hasResaleExit = owns || item.method === 'oplease';
  const taxLimitExempt =
    isBusinessPassengerLimitExempt(item.vehicle.category);
  const vatCategoryEligible = isVatInputCreditEligible(item.vehicle.category);
  const complianceApplies = common.biz !== 'none' && !taxLimitExempt;
  const insuranceRequired =
    complianceApplies &&
    (common.biz === 'corp' || (common.biz === 'personal' && common.personalInsuranceRequired));
  const derived = financials(item);
  const calculatedMonthly = derived.calculatedMonthly;
  const hasQuotedMonthly =
    item.monthlyQuote.financePayment != null || derived.monthlyAncillary > 0;
  const financePaymentLabel =
    item.method === 'installment'
      ? '월 금융 원리금'
      : item.method === 'rent'
        ? '월 차량대금·렌트료'
        : '월 금융·리스료';
  const upfrontExceedsPrice = downA + item.subsidy > P;
  const residualCapped = hasResidual && resA > derived.resEach + 0.5;
  const quotedFinanceTotal = derived.financeMonthly * item.months;
  const cappedFinanceTotal = cumulativeFinancePaymentsEach(item, item.months);
  const installmentPaysOffEarly =
    item.method === 'installment' &&
    cappedFinanceTotal + 0.5 < quotedFinanceTotal;
  const duplicateAnnualCostLabels = [
    item.monthlyQuote.insurance > 0 && item.insuranceYr > 0 ? '보험' : null,
    item.monthlyQuote.vehicleTax > 0 && item.vehicleTaxYr > 0 ? '자동차세' : null,
    item.monthlyQuote.maintenance > 0 && item.maintenanceYr > 0 ? '정비' : null,
  ].filter((label): label is string => label != null);

  const title = item.label?.trim()
    || `${METHOD_LABELS[item.method]}${item.vehicle.isUsed ? ' · 중고' : ''}` +
      `${item.vehicle.name ? ` · ${item.vehicle.name}` : ''}`;

  return (
    <div className="card">
      <button
        type="button"
        className="item-head"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
      >
        <span className="method-dot" aria-hidden="true" style={{ background: METHOD_COLORS[item.method] }} />
        <span className="title" id={titleId}>{props.index + 1}. {title}</span>
        <span className="sub">
          {fmtMan(P)} · {owns ? '금융' : '계약'} {item.months}개월 · {item.vehicle.count}대
          <span aria-hidden="true"> {open ? '▲' : '▼'}</span>
        </span>
      </button>
      {(upfrontExceedsPrice || residualCapped) && (
        <div style={{ marginTop: 6 }}>
          {upfrontExceedsPrice ? (
            <WarnBadge>선납금+지원금이 차량가를 초과합니다.</WarnBadge>
          ) : (
            <WarnBadge>
              입력 잔존가치가 금리·기간상 가능한 범위를 초과해 계산에서는
              {' '}{fmtMan(derived.resEach)}원으로 제한됩니다.
            </WarnBadge>
          )}
        </div>
      )}
      {!open ? null : (
        <div id={contentId} role="region" aria-labelledby={titleId} style={{ marginTop: 10 }}>
          <div className="section-label">차량</div>
          <div className="row">
            <div className="field">
              <label htmlFor={vehicleNameId}>차량명 (선택)</label>
              <input id={vehicleNameId} value={item.vehicle.name} maxLength={100}
                onChange={(e) => set({ vehicle: { ...item.vehicle, name: e.target.value } })} />
            </div>
            <NumInput label="대수" suffix="대" step={1} min={1} max={100} integer value={item.vehicle.count}
              onChange={(count) => set({ vehicle: { ...item.vehicle, count: Math.max(1, Math.round(count)) } })} />
          </div>
          <div className="row">
            <MoneyInput
              label={`차량 가격 (1대${item.vehicle.priceIncludesVat ? ' · VAT 포함' : ' · VAT 없음'})`}
              value={P}
              onChange={(price) => set({ vehicle: { ...item.vehicle, price } })} />
            <SelectInput
              label="차량 분류"
              value={CATEGORIES.findIndex((c) => c.key === item.vehicle.category)}
              options={CATEGORIES.map((c) => c.label)}
              onChange={(i) => {
                const category = CATEGORIES[i].key as VehicleCategory;
                set({
                  vehicle: { ...item.vehicle, category },
                  acqTaxRatePct: categoryMeta(category).acqTaxDefaultPct,
                });
              }}
            />
          </div>
          <div className="row">
            <Chips<'new' | 'used'>
              ariaLabel="차량 상태"
              value={item.vehicle.isUsed ? 'used' : 'new'}
              options={[{ key: 'new', label: '신차' }, { key: 'used', label: '중고차' }]}
              onChange={(k) => set({ vehicle: { ...item.vehicle, isUsed: k === 'used' } })}
            />
            {owns && (
              <Toggle
                label="입력 가격에 VAT 포함"
                checked={item.vehicle.priceIncludesVat}
                onChange={(priceIncludesVat) =>
                  set({ vehicle: { ...item.vehicle, priceIncludesVat } })}
              />
            )}
          </div>

          <div className="section-label">{owns ? '금융 조건' : '계약 조건'}</div>
          <div className="row">
            <NumInput label={owns ? '금융기간' : '계약기간'} suffix="개월" step={6} min={12} max={120} integer value={item.months}
              onChange={(months) => set({ months })} />
            <NumInput label="금리" suffix="%" step={0.1} min={0} max={15} value={item.ratePct}
              onChange={(ratePct) => set({ ratePct })} />
          </div>
          <div className="row">
            <PctOrAmountInput label="선납금 (1대당)" mv={item.down} base={P}
              onChange={(down) => set({ down })} />
            {hasResidual && item.residual && (
              <PctOrAmountInput
                label={item.method === 'rent' ? '예상 만기 잔존가치 (1대당)' : '잔존가치 (1대당)'}
                mv={item.residual} base={P}
                onChange={(residual) => set({ residual })} />
            )}
          </div>
          {hasRefundableDeposit && item.deposit && (
            <div className="row">
              <PctOrAmountInput label="반환형 보증금 (1대당)" mv={item.deposit} base={P}
                onChange={(deposit) => set({ deposit })} />
            </div>
          )}
          {item.method === 'installment' && (
            <div className="row">
              <MoneyInput label="대출 금액 (1대당 · 0 = 전액 현금)" value={item.loanAmount ?? 0}
                onChange={(loanAmount) => set({ loanAmount })} />
            </div>
          )}
          <div className="row">
            <MoneyInput label="지원금 (1대당)" value={item.subsidy}
              onChange={(subsidy) => set({ subsidy })} />
            {(owns || item.method === 'oplease') && (
              <NumInput
                label={item.method === 'oplease' ? '인수 시 취득세율' : '취득세율'}
                suffix="%" step={0.5} min={0} max={10} value={item.acqTaxRatePct}
                onChange={(acqTaxRatePct) => set({ acqTaxRatePct })} />
            )}
          </div>

          <div className="row">
            <MoneyInput
              label={`${financePaymentLabel} (1대당 · 0 = 자동계산)`}
              value={item.monthlyQuote.financePayment ?? 0}
              onChange={(financePayment) => setMonthlyQuote({
                financePayment: financePayment > 0 ? financePayment : null,
              })}
            />
            <MoneyInput label="기타 초기비용 (1대당)" value={item.upfrontFee}
              onChange={(upfrontFee) => set({ upfrontFee })} />
          </div>
          {item.monthlyQuote.financePayment != null && (
            <p className="muted" style={{ marginBottom: 8 }}>
              자동 산식의 금융·차량대금 월납은 {fmtMan(calculatedMonthly)}원입니다.
              입력한 금융 원리금만 잔여채무와 중도·만기 정산에 반영합니다.
              {installmentPaysOffEarly && (
                <>
                  {' '}조기 완납되는 입력이므로 누적 금융납입은
                  {' '}{fmtMan(cappedFinanceTotal)}원에서 멈춥니다.
                </>
              )}
            </p>
          )}

          <div className="section-label">견적 월납에 포함된 부대비용 (1대당)</div>
          <div className="row">
            <MoneyInput label="월 보험료 포함분" value={item.monthlyQuote.insurance}
              onChange={(insurance) => setMonthlyQuote({ insurance })} />
            <MoneyInput label="월 자동차세 포함분" value={item.monthlyQuote.vehicleTax}
              onChange={(vehicleTax) => setMonthlyQuote({ vehicleTax })} />
          </div>
          <div className="row">
            <MoneyInput label="월 정비비 포함분" value={item.monthlyQuote.maintenance}
              onChange={(maintenance) => setMonthlyQuote({ maintenance })} />
            <MoneyInput label="월 서비스·기타 수수료" value={item.monthlyQuote.serviceFee}
              onChange={(serviceFee) => setMonthlyQuote({ serviceFee })} />
          </div>
          {item.method === 'oplease' && (
            <div className="row">
              <Toggle
                label="계약서에서 정비비 구분 가능"
                checked={item.monthlyQuote.maintenanceBreakdownKnown}
                onChange={(maintenanceBreakdownKnown) =>
                  setMonthlyQuote({ maintenanceBreakdownKnown })}
              />
              {!item.monthlyQuote.maintenanceBreakdownKnown && (
                item.monthlyQuote.maintenance > 0 ? (
                  <WarnBadge>
                    입력한 월 정비비는 현금흐름에만 반영됩니다. 세무 계산에는
                    입력액 대신 보험·자동차세 차감 후 7% 대체규칙을 적용합니다.
                  </WarnBadge>
                ) : (
                  <WarnBadge>정비비 미구분: 보험·자동차세 차감 후 7% 적용</WarnBadge>
                )
              )}
            </div>
          )}
          {hasQuotedMonthly && (
            <p className="muted" style={{ marginBottom: 8 }}>
              실제 총 월 현금납입은 {fmtMan(derived.monthly)}원입니다.
              보험·자동차세·정비·서비스비는 금융잔액을 줄이지 않습니다.
            </p>
          )}

          <div className="section-label">
            월납 외 별도 연간 비용 (1대당 · 보유기간 전체)
          </div>
          <div className="row">
            <MoneyInput label="보험료 (연)" value={item.insuranceYr}
              onChange={(insuranceYr) => set({ insuranceYr })} />
            <MoneyInput label="자동차세 (연)" value={item.vehicleTaxYr}
              onChange={(vehicleTaxYr) => set({ vehicleTaxYr })} />
          </div>
          <div className="row">
            <MoneyInput label="정비비 (연)" value={item.maintenanceYr}
              onChange={(maintenanceYr) => set({ maintenanceYr })} />
          </div>
          {duplicateAnnualCostLabels.length > 0 && (
            <div className="row">
              <WarnBadge>
                {duplicateAnnualCostLabels.join('·')} 비용이 월납 포함분과 별도 연간비용에
                모두 입력되어 중복 합산됩니다.
              </WarnBadge>
            </div>
          )}
          {owns && (
            <>
              <div className="section-label">
                금융 종료 후 추가 연간 비용 (1대당)
              </div>
              <div className="row">
                <MoneyInput
                  label="종료 후 추가 보험료 (연)"
                  value={item.postFinanceAnnualCosts.insurance}
                  onChange={(insurance) => setPostFinanceAnnualCosts({ insurance })}
                />
                <MoneyInput
                  label="종료 후 추가 자동차세 (연)"
                  value={item.postFinanceAnnualCosts.vehicleTax}
                  onChange={(vehicleTax) => setPostFinanceAnnualCosts({ vehicleTax })}
                />
              </div>
              <div className="row">
                <MoneyInput
                  label="종료 후 추가 정비비 (연)"
                  value={item.postFinanceAnnualCosts.maintenance}
                  onChange={(maintenance) => setPostFinanceAnnualCosts({ maintenance })}
                />
              </div>
              <p className="muted" style={{ marginBottom: 8 }}>
                금융기간 중 월납에 포함되다가 종료 뒤 직접 부담하는 비용을 입력하세요.
                위의 보유기간 전체 연간비용에 추가로 합산됩니다.
              </p>
            </>
          )}

          {common.biz !== 'none' && (
            <>
              <div className="section-label">세무</div>
              <div className="row">
                <Toggle
                  label={taxLimitExempt ? '업무사용비율 직접 반영' : '운행기록부 작성'}
                  checked={item.tax.useDrivingLog}
                  onChange={(useDrivingLog) => set({ tax: { ...item.tax, useDrivingLog } })} />
                {item.tax.useDrivingLog && (
                  <NumInput label="업무사용비율" suffix="%" step={5} min={0} max={100} value={item.tax.bizUsePct}
                    onChange={(bizUsePct) => set({ tax: { ...item.tax, bizUsePct } })} />
                )}
              </div>
              {taxLimitExempt && !item.tax.useDrivingLog && (
                <p className="muted" style={{ marginBottom: 8 }}>
                  한도 제외 차량은 업무사용비율 미입력 시 100% 업무사용으로 가정합니다.
                </p>
              )}
              {vatCategoryEligible && (
                <div className="row">
                  <Toggle
                    label="VAT 적격 증빙 수취·업무 관련성 충족"
                    checked={item.tax.hasQualifiedEvidence}
                    onChange={(hasQualifiedEvidence) =>
                      set({ tax: { ...item.tax, hasQualifiedEvidence } })}
                  />
                  {common.vatTaxType === 'general' &&
                    !item.tax.hasQualifiedEvidence && (
                      <WarnBadge>적격 증빙 미확인으로 VAT 환급 0원 처리</WarnBadge>
                    )}
                </div>
              )}
              {common.vatTaxType !== 'exempt' && hasResaleExit && (
                <div className="row">
                  <Toggle
                    label="과세사업용 자산 (매각 시 매출 VAT)"
                    checked={item.tax.isTaxableBusinessAsset}
                    onChange={(isTaxableBusinessAsset) =>
                      set({ tax: { ...item.tax, isTaxableBusinessAsset } })}
                  />
                  {!item.tax.isTaxableBusinessAsset && (
                    <WarnBadge>매각 시 VAT를 차감하지 않음</WarnBadge>
                  )}
                  {item.tax.isTaxableBusinessAsset &&
                    common.vatTaxType === 'simplified' && (
                      <WarnBadge>
                        매각 VAT는 선택한 업종별 간이과세 산식으로 추정합니다.
                      </WarnBadge>
                    )}
                  {item.tax.isTaxableBusinessAsset &&
                    common.vatTaxType === 'mixedOrUncertain' && (
                      <WarnBadge>
                        겸영·불확실 매각 VAT는 과소계상 방지를 위해 일반세율
                        (부가세 포함가의 10/110) 보수값을 적용합니다.
                      </WarnBadge>
                    )}
                </div>
              )}
              {insuranceRequired && (
                <div className="row">
                  <Toggle
                    label="업무전용자동차보험 가입"
                    checked={item.tax.hasDedicatedInsurance}
                    onChange={(hasDedicatedInsurance) =>
                      set({ tax: { ...item.tax, hasDedicatedInsurance } })}
                  />
                  {!item.tax.hasDedicatedInsurance && (
                    <WarnBadge>필수보험 미가입으로 세금절감 0원 처리</WarnBadge>
                  )}
                </div>
              )}
              {common.biz === 'corp' && complianceApplies && (
                <>
                  <div className="row">
                    <Toggle
                      label="법인 전용번호판 부착 대상"
                      checked={item.tax.corporatePlateRequired}
                      onChange={(corporatePlateRequired) =>
                        set({ tax: { ...item.tax, corporatePlateRequired } })}
                    />
                    {item.tax.corporatePlateRequired && (
                      <Toggle
                        label="전용번호판 부착 완료"
                        checked={item.tax.hasCorporatePlate}
                        onChange={(hasCorporatePlate) =>
                          set({ tax: { ...item.tax, hasCorporatePlate } })}
                      />
                    )}
                  </div>
                  {item.tax.corporatePlateRequired && !item.tax.hasCorporatePlate && (
                    <div className="row">
                      <WarnBadge>전용번호판 미부착으로 세금절감 0원 처리</WarnBadge>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="section-label">감가·시세</div>
          <div className="row">
            <NumInput label="연 감가율" suffix="%" step={1} min={5} max={30} value={item.depreciation.depRatePct}
              onChange={(depRatePct) => set({ depreciation: { ...item.depreciation, depRatePct } })} />
            <NumInput label="최저 잔존비율" suffix="%" step={5} min={10} max={50} value={item.depreciation.floorPct}
              onChange={(floorPct) => set({ depreciation: { ...item.depreciation, floorPct } })} />
          </div>
          {common.scenarios.map((s) => {
            const ov = item.depreciation.resaleOverrides.find((o) => o.atMonths === s.atMonths);
            return (
              <div className="row" key={s.atMonths}>
                <MoneyInput
                  label={`${s.atMonths}개월 시점 예상시세 (부가세 포함 · 비우면 자동 감가)`}
                  value={ov?.price ?? 0}
                  onChange={(price) => {
                    const rest = item.depreciation.resaleOverrides.filter((o) => o.atMonths !== s.atMonths);
                    set({
                      depreciation: {
                        ...item.depreciation,
                        resaleOverrides: price > 0 ? [...rest, { atMonths: s.atMonths, price }] : rest,
                      },
                    });
                  }}
                />
              </div>
            );
          })}

          <div className="section-label">해지·승계 조건</div>
          {item.method !== 'installment' && (
            <div className="row">
              <Toggle label="승계 가능" checked={item.exit.canTransfer}
                onChange={(canTransfer) => set({ exit: { ...item.exit, canTransfer } })} />
              {item.exit.canTransfer && (
                <MoneyInput label="승계 수수료 (1대당)" value={item.exit.transferFee}
                  onChange={(transferFee) => set({ exit: { ...item.exit, transferFee } })} />
              )}
            </div>
          )}
          {(item.method === 'rent' || item.method === 'oplease') && (
            <>
              <div className="row">
                <NumInput label="위약금 비율 (잔여납입 대비)" suffix="%" step={5} min={0} max={50}
                  value={item.exit.penaltyPct}
                  onChange={(penaltyPct) => set({ exit: { ...item.exit, penaltyPct } })} />
                <MoneyInput label="반납 점검비 (1대당)" value={item.exit.returnInspFee}
                  onChange={(returnInspFee) => set({ exit: { ...item.exit, returnInspFee } })} />
              </div>
              <div className="row">
                <MoneyInput label="초과주행 위약금 (예상·1대당)" value={item.exit.mileagePenalty}
                  onChange={(mileagePenalty) => set({ exit: { ...item.exit, mileagePenalty } })} />
              </div>
            </>
          )}
          {item.method !== 'rent' && (
            <div className="row">
              <MoneyInput
                label={item.method === 'oplease' ? '조기인수 할인 (1대당)' : '조기정산·중도상환 감면 (1대당)'}
                value={item.exit.earlyDiscount}
                onChange={(earlyDiscount) => set({ exit: { ...item.exit, earlyDiscount } })}
              />
              {(item.method === 'oplease' || item.method === 'finlease') && (
                <MoneyInput
                  label="인수·소유권 이전 기타비용 (1대당)"
                  value={item.exit.buyoutFee}
                  onChange={(buyoutFee) => set({ exit: { ...item.exit, buyoutFee } })}
                />
              )}
            </div>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor={itemNameId}>항목 이름 (선택)</label>
              <input id={itemNameId} value={item.label ?? ''} placeholder={title} maxLength={100}
                onChange={(e) => set({ label: e.target.value || undefined })} />
            </div>
            <button
              type="button"
              className="btn"
              aria-label={`${title} 복제`}
              disabled={!props.canDuplicate}
              onClick={props.onDuplicate}
            >복제</button>
            <button type="button" className="btn" aria-label={`${title} 삭제`} onClick={props.onRemove}>삭제</button>
          </div>
        </div>
      )}
    </div>
  );
}
