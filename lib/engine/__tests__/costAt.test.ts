import { describe, expect, it } from 'vitest';
import {
  cumulativeFinancePaymentsEach, financials, remainingDebtEach, sunkAt,
  vatRefundCumEach,
} from '../costAt';
import { baseCommon, baseItem } from './fixtures';

describe('financials — 방식별 금융 구조 (스펙 §4.2)', () => {
  it('케이스 B: 리스 최초잔액은 차량가−선납, 잔존은 balloon으로 이자를 포함한다', () => {
    const op = financials(baseItem('oplease', { ratePct: 4.5, down: { mode: 'pct', value: 30 } }));
    const rent = financials(baseItem('rent', { ratePct: 5.9, down: { mode: 'pct', value: 30 } }));
    const inst = financials(baseItem('installment', { ratePct: 5.5, down: { mode: 'pct', value: 30 } }));
    expect(op.principal).toBe(28_000_000);
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

  it('케이스 K: 취득세는 금융리스·할부만 (부가세 제외 공급가액×7%)', () => {
    const expected = Math.round((40_000_000 / 1.1) * 0.07);
    expect(financials(baseItem('finlease')).acqTaxEach).toBe(expected);
    expect(financials(baseItem('installment')).acqTaxEach).toBe(expected);
    expect(financials(baseItem('rent')).acqTaxEach).toBe(0);
    expect(financials(baseItem('oplease')).acqTaxEach).toBe(0);
    const compact = baseItem('installment', {
      vehicle: { ...baseItem('installment').vehicle, category: 'compact' },
      acqTaxRatePct: 4,
    });
    expect(financials(compact).acqTaxEach)
      .toBe(Math.max(Math.round((40_000_000 / 1.1) * 0.04) - 750_000, 0));
  });

  it('VAT 없는 개인 간 중고차 가격은 전액을 취득세 과표로 사용한다', () => {
    const usedPrivateSale = baseItem('installment', {
      vehicle: {
        ...baseItem('installment').vehicle,
        isUsed: true,
        priceIncludesVat: false,
      },
      acqTaxRatePct: 7,
    });
    expect(financials(usedPrivateSale).acqTaxEach).toBe(2_800_000);
  });

  it('엣지: 과도한 잔존은 무납입 만기잔액으로 제한해 가상 채무를 만들지 않는다', () => {
    const item = baseItem('finlease', {
      down: { mode: 'pct', value: 80 },
      residual: { mode: 'pct', value: 30 },
    });
    const f = financials(item);
    expect(f.principal).toBe(8_000_000);
    expect(f.monthly).toBe(0);
    expect(remainingDebtEach(item, 0)).toBe(f.principal);
    expect(remainingDebtEach(item, item.months)).toBeCloseTo(f.resEach, 4);
    expect(f.resEach).toBeLessThan(12_000_000);
  });

  it('실제 금융 월납은 표시·현금흐름에 쓰되 계산 월납액과 금융원금은 보존', () => {
    const baseline = financials(baseItem('oplease'));
    const quoted = financials(baseItem('oplease', {
      monthlyQuote: {
        ...baseItem('oplease').monthlyQuote,
        financePayment: 990_000,
      },
    }));
    expect(quoted.monthly).toBe(990_000);
    expect(quoted.financeMonthly).toBe(990_000);
    expect(quoted.calculatedMonthly).toBeCloseTo(baseline.calculatedMonthly, 6);
    expect(quoted.principal).toBe(baseline.principal);
  });
  it('실제 금융 월납이 낮으면 그 차이를 만기 금융잔액으로 보존', () => {
    const item = baseItem('installment', {
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        financePayment: 1,
      },
    });
    expect(remainingDebtEach(item, item.months)).toBeGreaterThan(item.vehicle.price);
  });
  it('월 부대비용은 현금유출을 늘리지만 금융잔액을 줄이지 않는다', () => {
    const base = baseItem('oplease', {
      monthlyQuote: {
        ...baseItem('oplease').monthlyQuote,
        financePayment: 700_000,
      },
    });
    const withService = baseItem('oplease', {
      monthlyQuote: {
        ...base.monthlyQuote,
        serviceFee: 200_000,
        insurance: 100_000,
      },
    });
    expect(financials(withService).financeMonthly).toBe(700_000);
    expect(financials(withService).monthly).toBe(1_000_000);
    expect(remainingDebtEach(withService, 24)).toBeCloseTo(remainingDebtEach(base, 24), 6);
    expect(sunkAt(withService, baseCommon(), 24) - sunkAt(base, baseCommon(), 24))
      .toBe(300_000 * 24);
  });
  it('VAT 공제 가능 사업용 차량의 취득세 과표는 환급 VAT를 제외', () => {
    const truck = baseItem('installment', {
      vehicle: { ...baseItem('installment').vehicle, category: 'truck' },
      acqTaxRatePct: 5,
    });
    const f = financials(truck);
    expect(f.acqTaxEach).toBe(Math.round((40_000_000 / 1.1) * 0.05));
  });
  it('장기렌트 자동 월납도 예상 잔존가치를 balloon으로 반영', () => {
    const lowResidual = financials(baseItem('rent', { residual: { mode: 'pct', value: 20 } }));
    const highResidual = financials(baseItem('rent', { residual: { mode: 'pct', value: 40 } }));
    expect(highResidual.monthly).toBeLessThan(lowResidual.monthly);
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
  it('렌트의 월 보험·자동차세 포함분에는 VAT 환급을 만들지 않는다', () => {
    const item = baseItem('rent', {
      vehicle: { ...baseItem('rent').vehicle, category: 'truck' },
      monthlyQuote: {
        financePayment: 1_000_000,
        insurance: 100_000,
        vehicleTax: 50_000,
        maintenance: 30_000,
        maintenanceBreakdownKnown: true,
        serviceFee: 20_000,
      },
    });
    expect(vatRefundCumEach(item, biz, 12))
      .toBeCloseTo((1_000_000 + 30_000 + 20_000) * 12 * (10 / 110), 4);
  });
  it('일반과세·VAT 적격 차종·적격증빙을 모두 충족할 때만 환급한다', () => {
    const truck = baseItem('installment', {
      vehicle: {
        ...baseItem('installment').vehicle,
        category: 'truck',
      },
    });
    const expected = 40_000_000 * (10 / 110);
    expect(vatRefundCumEach(truck, biz, 0)).toBeCloseTo(expected, 4);
    expect(vatRefundCumEach(
      { ...truck, tax: { ...truck.tax, hasQualifiedEvidence: false } },
      biz,
      0,
    )).toBe(0);
    for (const vatTaxType of [
      'simplified', 'exempt', 'mixedOrUncertain',
    ] as const) {
      expect(vatRefundCumEach(
        truck,
        baseCommon({ biz: 'personal', vatTaxType }),
        0,
      )).toBe(0);
    }
  });
  it('별도 연간 정비비와 금융 종료 후 추가 정비비의 VAT도 누적 환급한다', () => {
    const item = baseItem('installment', {
      months: 12,
      vehicle: {
        ...baseItem('installment').vehicle,
        category: 'truck',
      },
      maintenanceYr: 1_100_000,
      postFinanceAnnualCosts: {
        insurance: 0,
        vehicleTax: 0,
        maintenance: 2_200_000,
      },
    });
    expect(vatRefundCumEach(item, biz, 24)).toBeCloseTo(
      (40_000_000 + 1_100_000 * 2 + 2_200_000) * (10 / 110),
      4,
    );
  });

  it('VAT 적격 렌트 선납금은 초기 매입 VAT로 환급한다', () => {
    const item = baseItem('rent', {
      vehicle: {
        ...baseItem('rent').vehicle,
        category: 'truck',
      },
      down: { mode: 'amount', value: 11_000_000 },
    });
    expect(vatRefundCumEach(item, biz, 0)).toBeCloseTo(1_000_000, 4);
  });

  it('VAT 적격 소유형의 월 정비비도 연간 정비비와 같은 순액·환급을 적용한다', () => {
    const monthly = baseItem('installment', {
      vehicle: {
        ...baseItem('installment').vehicle,
        category: 'truck',
      },
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        maintenance: 110_000,
      },
    });
    const annual = baseItem('installment', {
      vehicle: {
        ...baseItem('installment').vehicle,
        category: 'truck',
      },
      maintenanceYr: 1_320_000,
    });
    const vehicleRefund = 40_000_000 * (10 / 110);
    expect(vatRefundCumEach(monthly, biz, 12) - vehicleRefund)
      .toBeCloseTo(120_000, 4);
    expect(vatRefundCumEach(annual, biz, 12) - vehicleRefund)
      .toBeCloseTo(120_000, 4);
  });

  it('VAT 없는 차량 가격에는 매입 VAT 환급을 만들지 않는다', () => {
    const item = baseItem('installment', {
      vehicle: {
        ...baseItem('installment').vehicle,
        category: 'truck',
        priceIncludesVat: false,
      },
    });
    expect(vatRefundCumEach(item, biz, 0)).toBe(0);
  });

  it('approvedOnly는 렌트 선납 거래 뒤 월·연 VAT 환급을 승인 잔여기간까지만 반영한다', () => {
    const item = baseItem('rent', {
      vehicle: {
        ...baseItem('rent').vehicle,
        category: 'truck',
      },
      down: { mode: 'amount', value: 11_000_000 },
      monthlyQuote: {
        ...baseItem('rent').monthlyQuote,
        financePayment: 1_100_000,
      },
      maintenanceYr: 1_320_000,
    });
    const approvedOnly = baseCommon({
      biz: 'personal',
      taxRuleHorizon: 'approvedOnly',
      taxStartDate: '2026-12-31',
    });
    const applicableMonths = 1 / 31;
    expect(vatRefundCumEach(item, approvedOnly, 48)).toBeCloseTo(
      (
        11_000_000
        + 1_100_000 * applicableMonths
        + 1_320_000 * (applicableMonths / 12)
      ) * (10 / 110),
      4,
    );
    expect(vatRefundCumEach(
      item,
      { ...approvedOnly, taxRuleHorizon: 'assumeUnchanged' },
      48,
    )).toBeCloseTo(
      (11_000_000 + 1_100_000 * 48 + 1_320_000 * 4) * (10 / 110),
      4,
    );
  });
});

describe('sunkAt — 누적지출 (스펙 §4.3)', () => {
  it('m=0: 선납+현금추가+취득세만 (할부), 렌트는 선납만', () => {
    const inst = baseItem('installment', { down: { mode: 'amount', value: 12_000_000 } });
    expect(sunkAt(inst, baseCommon(), 0))
      .toBe(12_000_000 + Math.round((40_000_000 / 1.1) * 0.07));
    expect(sunkAt(baseItem('rent', { down: { mode: 'amount', value: 12_000_000 } }), baseCommon(), 0)).toBe(12_000_000);
  });
  it('반환형 보증금과 기타 초기비용은 초기 누적지출에 포함', () => {
    const item = baseItem('rent', {
      deposit: { mode: 'pct', value: 10 },
      upfrontFee: 300_000,
    });
    expect(sunkAt(item, baseCommon(), 0)).toBe(4_300_000);
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
  it('만기 초과 m은 만기로 클램프 (납입·환급 비대칭 방지)', () => {
    const c = baseCommon({ biz: 'personal' });
    const truck = baseItem('rent', { vehicle: { ...baseItem('rent').vehicle, category: 'truck' } });
    expect(sunkAt(truck, c, 60)).toBe(sunkAt(truck, c, 48));
  });
  it('소유형은 금융 만기 후 월납을 멈추고 보험·정비만 실제 보유기간까지 누적', () => {
    for (const method of ['finlease', 'installment'] as const) {
      const item = baseItem(method, {
        months: 36,
        insuranceYr: 1_200_000,
        maintenanceYr: 600_000,
      });
      const at36 = sunkAt(item, baseCommon(), 36);
      const at60 = sunkAt(item, baseCommon(), 60);
      expect(at60 - at36).toBeCloseTo((1_200_000 + 600_000) * 2, 4);
    }
  });
  it('종료 후 추가 연간비용은 소유형 금융 만기 뒤부터만 기존 연간비용에 더한다', () => {
    const item = baseItem('installment', {
      months: 36,
      insuranceYr: 1_200_000,
      vehicleTaxYr: 600_000,
      postFinanceAnnualCosts: {
        insurance: 1_200_000,
        vehicleTax: 600_000,
        maintenance: 600_000,
      },
    });
    const at36 = sunkAt(item, baseCommon(), 36);
    const at60 = sunkAt(item, baseCommon(), 60);
    const withoutPostFinanceCosts = baseItem('installment', {
      months: 36,
      insuranceYr: 1_200_000,
      vehicleTaxYr: 600_000,
    });
    expect(at36).toBeCloseTo(
      sunkAt(withoutPostFinanceCosts, baseCommon(), 36),
      4,
    );
    expect(at60 - sunkAt(withoutPostFinanceCosts, baseCommon(), 60))
      .toBeCloseTo(2_400_000 * 2, 4);
    expect(at60 - at36).toBeCloseTo(
      (1_800_000 + 2_400_000) * 2,
      4,
    );
  });
});

describe('cumulativeFinancePaymentsEach — 실제 누적 금융납입 상한', () => {
  it('과도한 할부 월납은 최종 잔액까지만 내고 조기 완납 뒤 중단한다', () => {
    const item = baseItem('installment', {
      ratePct: 0,
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        financePayment: 10_000_000,
      },
    });
    expect(cumulativeFinancePaymentsEach(item, 2)).toBe(20_000_000);
    expect(cumulativeFinancePaymentsEach(item, 12)).toBe(40_000_000);
    expect(cumulativeFinancePaymentsEach(item, 48)).toBe(40_000_000);
    expect(remainingDebtEach(item, 12)).toBe(0);
    expect(sunkAt(item, baseCommon(), 48)).toBeCloseTo(
      financials(item).acqTaxEach + 40_000_000,
      4,
    );
  });

  it('balloon 리스는 기존 약정 월납 누적 규약을 유지한다', () => {
    const item = baseItem('finlease', {
      monthlyQuote: {
        ...baseItem('finlease').monthlyQuote,
        financePayment: 10_000_000,
      },
    });
    expect(cumulativeFinancePaymentsEach(item, 24)).toBe(240_000_000);
  });
});
