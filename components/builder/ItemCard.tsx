'use client';
import { useState } from 'react';
import { Chips, MoneyInput, NumInput, PctOrAmountInput, SelectInput, Toggle, WarnBadge } from '@/components/ui/Field';
import { fmtMan } from '@/lib/format';
import { CATEGORIES, categoryMeta, isExempt } from '@/lib/engine/taxData';
import { resolveAmount } from '@/lib/engine/types';
import type { CommonProfile, FinanceItem, VehicleCategory } from '@/lib/engine/types';
import { METHOD_LABELS } from '@/lib/state/defaults';

export const METHOD_COLORS: Record<FinanceItem['method'], string> = {
  rent: '#2563eb', oplease: '#059669', finlease: '#9333ea', installment: '#d97706',
};

export function ItemCard(props: {
  item: FinanceItem; common: CommonProfile; index: number;
  onChange: (item: FinanceItem) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const { item, common } = props;
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<FinanceItem>) => props.onChange({ ...item, ...patch });
  const P = item.vehicle.price;
  const downA = resolveAmount(item.down, P);
  const resA = resolveAmount(item.residual, P);
  const overCommit = downA + resA + item.subsidy > P;
  const isLease = item.method === 'oplease' || item.method === 'finlease';
  const owns = item.method === 'finlease' || item.method === 'installment';
  const needsInsuranceWarn =
    common.biz !== 'none' && !isExempt(item.vehicle.category);

  const title = item.label?.trim()
    || `${METHOD_LABELS[item.method]}${item.vehicle.name ? ` · ${item.vehicle.name}` : ''}`;

  return (
    <div className="card">
      <div className="item-head" onClick={() => setOpen(!open)}>
        <span className="method-dot" style={{ background: METHOD_COLORS[item.method] }} />
        <span className="title">{props.index + 1}. {title}</span>
        <span className="sub">
          {fmtMan(P)} · {item.months}개월 · {item.vehicle.count}대 {open ? '▲' : '▼'}
        </span>
      </div>
      {overCommit && <div style={{ marginTop: 6 }}><WarnBadge>선납+잔존+지원이 차량가를 초과 — 원금 0으로 계산</WarnBadge></div>}
      {!open ? null : (
        <div style={{ marginTop: 10 }}>
          <div className="section-label">차량</div>
          <div className="row">
            <div className="field">
              <label>차량명 (선택)</label>
              <input value={item.vehicle.name}
                onChange={(e) => set({ vehicle: { ...item.vehicle, name: e.target.value } })} />
            </div>
            <NumInput label="대수" suffix="대" step={1} min={1} value={item.vehicle.count}
              onChange={(count) => set({ vehicle: { ...item.vehicle, count: Math.max(1, Math.round(count)) } })} />
          </div>
          <div className="row">
            <MoneyInput label="차량 가격 (1대, 부가세 포함)" value={P}
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
              value={item.vehicle.isUsed ? 'used' : 'new'}
              options={[{ key: 'new', label: '신차' }, { key: 'used', label: '중고차' }]}
              onChange={(k) => set({ vehicle: { ...item.vehicle, isUsed: k === 'used' } })}
            />
          </div>

          <div className="section-label">계약</div>
          <div className="row">
            <NumInput label="기간" suffix="개월" step={6} min={12} max={72} value={item.months}
              onChange={(months) => set({ months })} />
            <NumInput label="금리" suffix="%" step={0.1} min={0} max={15} value={item.ratePct}
              onChange={(ratePct) => set({ ratePct })} />
          </div>
          <div className="row">
            <PctOrAmountInput label="선납금 (1대당)" mv={item.down} base={P}
              onChange={(down) => set({ down })} />
            {isLease && item.residual && (
              <PctOrAmountInput label="잔존가치 (1대당)" mv={item.residual} base={P}
                onChange={(residual) => set({ residual })} />
            )}
          </div>
          {item.method === 'installment' && (
            <div className="row">
              <MoneyInput label="대출 금액 (1대당 · 0 = 전액 현금)" value={item.loanAmount ?? 0}
                onChange={(loanAmount) => set({ loanAmount })} />
            </div>
          )}
          <div className="row">
            <MoneyInput label="지원금 (1대당)" value={item.subsidy}
              onChange={(subsidy) => set({ subsidy })} />
            {owns && (
              <NumInput label="취득세율" suffix="%" step={0.5} min={0} max={10} value={item.acqTaxRatePct}
                onChange={(acqTaxRatePct) => set({ acqTaxRatePct })} />
            )}
          </div>

          <div className="section-label">연간 비용 (1대당)</div>
          <div className="row">
            <MoneyInput label="보험료 (연)" value={item.insuranceYr}
              onChange={(insuranceYr) => set({ insuranceYr })} />
            <MoneyInput label="정비비 (연)" value={item.maintenanceYr}
              onChange={(maintenanceYr) => set({ maintenanceYr })} />
          </div>

          {common.biz !== 'none' && (
            <>
              <div className="section-label">세무</div>
              <div className="row">
                <Toggle label="운행기록부 작성" checked={item.tax.useDrivingLog}
                  onChange={(useDrivingLog) => set({ tax: { ...item.tax, useDrivingLog } })} />
                {item.tax.useDrivingLog && (
                  <NumInput label="업무사용비율" suffix="%" step={5} min={0} max={100} value={item.tax.bizUsePct}
                    onChange={(bizUsePct) => set({ tax: { ...item.tax, bizUsePct } })} />
                )}
              </div>
              {needsInsuranceWarn && (
                <div className="row"><WarnBadge>법인·성실신고자는 업무전용자동차보험 필수 (미가입 시 불인정 — 계산 미반영)</WarnBadge></div>
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
                  label={`${s.atMonths}개월 시점 예상시세 (비우면 자동 감가)`}
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
                <MoneyInput label="반납 점검비" value={item.exit.returnInspFee}
                  onChange={(returnInspFee) => set({ exit: { ...item.exit, returnInspFee } })} />
              </div>
              <div className="row">
                <MoneyInput label="초과주행 위약금 (예상)" value={item.exit.mileagePenalty}
                  onChange={(mileagePenalty) => set({ exit: { ...item.exit, mileagePenalty } })} />
              </div>
            </>
          )}
          {item.method !== 'rent' && (
            <div className="row">
              <MoneyInput
                label={item.method === 'oplease' ? '조기인수 할인' : '조기정산·중도상환 감면'}
                value={item.exit.earlyDiscount}
                onChange={(earlyDiscount) => set({ exit: { ...item.exit, earlyDiscount } })}
              />
            </div>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            <div className="field">
              <label>항목 이름 (선택)</label>
              <input value={item.label ?? ''} placeholder={title}
                onChange={(e) => set({ label: e.target.value || undefined })} />
            </div>
            <button className="btn" onClick={props.onDuplicate}>복제</button>
            <button className="btn" onClick={props.onRemove}>삭제</button>
          </div>
        </div>
      )}
    </div>
  );
}
