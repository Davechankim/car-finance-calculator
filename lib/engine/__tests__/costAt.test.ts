import { describe, expect, it } from 'vitest';
import { financials, sunkAt, vatRefundCumEach } from '../costAt';
import { baseCommon, baseItem } from './fixtures';

describe('financials — 방식별 금융 구조 (스펙 §4.2)', () => {
  it('케이스 B: 운용리스 원금 = 4,000만−1,200만−1,200만 = 1,600만, 월납은 렌트·할부보다 낮다', () => {
    const op = financials(baseItem('oplease', { ratePct: 4.5, down: { mode: 'pct', value: 30 } }));
    const rent = financials(baseItem('rent', { ratePct: 5.9, down: { mode: 'pct', value: 30 } }));
    const inst = financials(baseItem('installment', { ratePct: 5.5, down: { mode: 'pct', value: 30 } }));
    expect(op.principal).toBe(16_000_000);
    expect(rent.principal).toBe(28_000_000);
    expect(inst.principal).toBe(28_000_000); // loanAmount null → 상한 = 차량가−선납
    expect(op.monthly).toBeLessThan(rent.monthly);
    expect(op.monthly).toBeLessThan(inst.monthly);
  });

  it('할부 대출 상한: 대출금이 차량가−선납−지원을 넘으면 잘리고, 모자라면 현금추가 발생', () => {
    const over = financials(baseItem('installment', { down: { mode: 'amount', value: 12_000_000 }, loanAmount: 99_000_000 }));
    expect(over.principal).toBe(28_000_000);
    expect(over.cashExtraEach).toBe(0);
    const under = financials(baseItem('installment', { down: { mode: 'amount', value: 12_000_000 }, loanAmount: 20_000_000 }));
    expect(under.principal).toBe(20_000_000);
    expect(under.cashExtraEach).toBe(8_000_000);
  });

  it('케이스 K: 취득세는 금융리스·할부만 (4,000만×7% = 280만)', () => {
    expect(financials(baseItem('finlease')).acqTaxEach).toBe(2_800_000);
    expect(financials(baseItem('installment')).acqTaxEach).toBe(2_800_000);
    expect(financials(baseItem('rent')).acqTaxEach).toBe(0);
    expect(financials(baseItem('oplease')).acqTaxEach).toBe(0);
  });

  it('엣지: 선납+잔존 > 차량가 → 원금 0, 월납 0', () => {
    const f = financials(baseItem('finlease', { down: { mode: 'pct', value: 80 }, residual: { mode: 'pct', value: 30 } }));
    expect(f.principal).toBe(0);
    expect(f.monthly).toBe(0);
  });
});

describe('vatRefundCumEach — 부가세 환급 (스펙 §4.2 각주2, 케이스 I)', () => {
  const biz = baseCommon({ biz: 'personal' });
  it('화물(exempt)+사업자: 렌트는 매월 렌트료×10/110 누적', () => {
    const item = baseItem('rent', { vehicle: { ...baseItem('rent').vehicle, category: 'truck' } });
    const { monthly } = financials(item);
    expect(vatRefundCumEach(item, biz, 12)).toBeCloseTo(monthly * 12 * (10 / 110), 4);
  });
  it('화물+사업자: 할부·금융리스는 초기 1회 차량가×10/110, 운용리스는 0', () => {
    const truck = (m: 'installment' | 'finlease' | 'oplease') =>
      baseItem(m, { vehicle: { ...baseItem(m).vehicle, category: 'truck' } });
    expect(vatRefundCumEach(truck('installment'), biz, 0)).toBeCloseTo(40_000_000 * (10 / 110), 4);
    expect(vatRefundCumEach(truck('finlease'), biz, 0)).toBeCloseTo(40_000_000 * (10 / 110), 4);
    expect(vatRefundCumEach(truck('oplease'), biz, 24)).toBe(0);
  });
  it('일반 승용차이거나 비사업자면 환급 0', () => {
    expect(vatRefundCumEach(baseItem('rent'), biz, 12)).toBe(0); // passenger
    const truck = baseItem('installment', { vehicle: { ...baseItem('installment').vehicle, category: 'truck' } });
    expect(vatRefundCumEach(truck, baseCommon(), 12)).toBe(0); // biz none
  });
});

describe('sunkAt — 누적지출 (스펙 §4.3)', () => {
  it('m=0: 선납+현금추가+취득세만 (할부), 렌트는 선납만', () => {
    const inst = baseItem('installment', { down: { mode: 'amount', value: 12_000_000 } });
    expect(sunkAt(inst, baseCommon(), 0)).toBe(12_000_000 + 2_800_000);
    expect(sunkAt(baseItem('rent', { down: { mode: 'amount', value: 12_000_000 } }), baseCommon(), 0)).toBe(12_000_000);
  });
  it('월납·연간비용·대수 반영: 2대면 정확히 2배 (tradeIn=0)', () => {
    const one = baseItem('rent', { insuranceYr: 800_000, maintenanceYr: 300_000 });
    const two = baseItem('rent', {
      insuranceYr: 800_000, maintenanceYr: 300_000,
      vehicle: { ...one.vehicle, count: 2 },
    });
    expect(sunkAt(two, baseCommon(), 24)).toBeCloseTo(sunkAt(one, baseCommon(), 24) * 2, 4);
  });
  it('보상판매는 항목당 1회 차감 (대수와 무관)', () => {
    const c = baseCommon({ tradeIn: 5_000_000 });
    const one = baseItem('rent');
    const two = baseItem('rent', { vehicle: { ...one.vehicle, count: 2 } });
    expect(sunkAt(one, c, 0)).toBe(-5_000_000);
    expect(sunkAt(two, c, 0)).toBe(-5_000_000); // 선납 0이므로 −tradeIn만
  });
  it('손계산 대조: 렌트 1,200만 선납·연보험 80만·24개월', () => {
    const item = baseItem('rent', {
      ratePct: 5.9, down: { mode: 'amount', value: 12_000_000 }, insuranceYr: 800_000,
    });
    const { monthly } = financials(item);
    // 선납 1,200만 + 월납×24 + 보험 80만×2년
    expect(sunkAt(item, baseCommon(), 24)).toBeCloseTo(12_000_000 + monthly * 24 + 1_600_000, 4);
  });
});
