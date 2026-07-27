import { describe, expect, it } from 'vitest';
import { annualInterestAt, deductibleAt, deductibleFromParts, taxSavingAt } from '../tax';
import { financials, remainingDebtEach } from '../costAt';
import { baseCommon, baseItem } from './fixtures';

const parts = (over: Partial<Parameters<typeof deductibleFromParts>[0]> = {}) =>
  deductibleFromParts({
    annualCost: 18_000_000, depEquiv: 12_600_000, exempt: false,
    useDrivingLog: false, bizUsePct: 100,
    costLimit: 15_000_000, depLimit: 8_000_000,
    ...over,
  });

describe('deductibleFromParts — 한도 5단계 (스펙 §4.5)', () => {
  it('케이스 D(실무형 갱신): 연비용 1,800만·기록부X → 비율 15/18, 업무사용금액 1,500만, 감가초과 250만 → 인정 1,250만', () => {
    // 렌트 월 150만: 연비용 1,800만, 감가상당 = 1,800만×70% = 1,260만
    // 비율 = min(1,500만/1,800만, 1) = 0.8333…, 업무사용금액 = 1,500만
    // 감가초과 = max(1,260만×0.8333 − 800만, 0) = 1,050만 − 800만 = 250만
    // 인정 = 1,500만 − 250만 = 1,250만
    const b = parts();
    expect(b.ratio).toBeCloseTo(15 / 18, 6);
    expect(b.usedAmount).toBeCloseTo(15_000_000, 0);
    expect(b.depExcess).toBeCloseTo(2_500_000, 0);
    expect(b.recognizedEach).toBeCloseTo(12_500_000, 0);
  });

  it('케이스 G: 정액 감가 1,200만(6,000만 차) → 800만 한도, 초과 400만 불인정', () => {
    const b = parts({ annualCost: 12_000_000, depEquiv: 12_000_000 });
    expect(b.ratio).toBe(1); // 1,500만 한도 내
    expect(b.depExcess).toBeCloseTo(4_000_000, 0);
    expect(b.recognizedEach).toBeCloseTo(8_000_000, 0);
  });

  it('케이스 J: 기록부 작성 + 업무사용 80% → 1,500만 초과 인정 가능', () => {
    const b = parts({ annualCost: 20_000_000, depEquiv: 14_000_000, useDrivingLog: true, bizUsePct: 80 });
    expect(b.usedAmount).toBeCloseTo(16_000_000, 0);       // 1,500만 초과 OK
    expect(b.depExcess).toBeCloseTo(14_000_000 * 0.8 - 8_000_000, 0); // 320만
    expect(b.recognizedEach).toBeCloseTo(12_800_000, 0);
  });

  it('한도제외 차량: 업무비율 미입력 시 100% 업무사용 가정 (감가초과 0)', () => {
    const b = parts({ exempt: true, annualCost: 30_000_000, depEquiv: 21_000_000 });
    expect(b.recognizedEach).toBe(30_000_000);
  });

  it('소규모 부동산임대 주업법인 특례 한도 500만·감가 400만을 적용', () => {
    const b = parts({
      annualCost: 12_000_000,
      depEquiv: 12_000_000,
      costLimit: 5_000_000,
      depLimit: 4_000_000,
    });
    expect(b.ratio).toBeCloseTo(5 / 12, 6);
    expect(b.usedAmount).toBeCloseTo(5_000_000, 0);
    expect(b.depExcess).toBeCloseTo(1_000_000, 0);
    expect(b.recognizedEach).toBeCloseTo(4_000_000, 0);
  });
  it('bizUsePct는 0~100으로 클램프 — 150% 입력해도 비율 1', () => {
    const b = parts({ useDrivingLog: true, bizUsePct: 150 });
    expect(b.ratio).toBe(1);
  });
  it('한도제외 차량도 업무사용비율을 입력하면 해당 비율만 인정하고 감가 한도는 적용하지 않는다', () => {
    const b = parts({
      exempt: true,
      annualCost: 30_000_000,
      depEquiv: 21_000_000,
      useDrivingLog: true,
      bizUsePct: 80,
    });
    expect(b.ratio).toBe(0.8);
    expect(b.usedAmount).toBe(24_000_000);
    expect(b.depExcess).toBe(0);
    expect(b.recognizedEach).toBe(24_000_000);
  });
});

describe('annualInterestAt / deductibleAt — 항목 조립', () => {
  it('m=0이면 연이자 0', () => {
    expect(annualInterestAt(baseItem('installment'), 0)).toBe(0);
  });
  it('할부 마지막 과세기간 연비용 = 정액감가 + 해당 기간 이자 (보험·정비 0)', () => {
    const item = baseItem('installment');
    const i = annualInterestAt(item, 24);
    expect(i).toBeGreaterThan(0);
    const b = deductibleAt(item, baseCommon({ biz: 'personal' }), 24);
    const f = financials(item);
    const yearTwoInterest =
      f.monthly * 12 - (remainingDebtEach(item, 12) - remainingDebtEach(item, 24));
    const basis = 40_000_000 + f.acqTaxEach;
    expect(b.annualCost).toBeCloseTo(basis / 5 + yearTwoInterest, 4);
    expect(b.depEquiv).toBeCloseTo(basis / 5, 4);
  });
  it('렌트 감가상당액은 연렌트료×70%, 운용리스는 서비스비 포함 리스료를 사용', () => {
    const rent = baseItem('rent');
    const op = baseItem('oplease', {
      monthlyQuote: {
        financePayment: 700_000,
        insurance: 100_000,
        vehicleTax: 50_000,
        maintenance: 30_000,
        maintenanceBreakdownKnown: true,
        serviceFee: 20_000,
      },
    });
    const c = baseCommon({ biz: 'personal' });
    expect(deductibleAt(rent, c, 24).depEquiv)
      .toBeCloseTo(financials(rent).monthly * 12 * 0.7, 4);
    expect(deductibleAt(op, c, 24).depEquiv).toBe(720_000 * 12);
    expect(deductibleAt(op, c, 24).annualCost).toBe(900_000 * 12);
  });
  it('운용리스 정비비 미구분 시 보험·자동차세 차감액의 7%를 정비비로 본다', () => {
    const op = baseItem('oplease', {
      monthlyQuote: {
        financePayment: 700_000,
        insurance: 100_000,
        vehicleTax: 50_000,
        maintenance: 0,
        maintenanceBreakdownKnown: false,
        serviceFee: 20_000,
      },
    });
    expect(deductibleAt(op, baseCommon({ biz: 'personal' }), 24).depEquiv)
      .toBeCloseTo((700_000 + 20_000) * 0.93 * 12, 4);
  });
  it('동일한 렌트 총대가는 선납·월납 구성과 무관하게 같은 비용과 감가상당액을 만든다', () => {
    const noDown = baseItem('rent', {
      months: 48,
      ratePct: 0,
      down: { mode: 'amount', value: 0 },
      residual: { mode: 'amount', value: 0 },
      vehicle: {
        ...baseItem('rent').vehicle,
        price: 48_000_000,
      },
    });
    const withDown = baseItem('rent', {
      ...noDown,
      down: { mode: 'amount', value: 12_000_000 },
    });
    const common = baseCommon({ biz: 'personal' });
    const without = deductibleAt(noDown, common, 24);
    const prepaid = deductibleAt(withDown, common, 24);
    expect(financials(noDown).monthly).toBe(1_000_000);
    expect(financials(withDown).monthly).toBe(750_000);
    expect(prepaid.annualCost).toBeCloseTo(without.annualCost, 4);
    expect(prepaid.depEquiv).toBeCloseTo(without.depEquiv, 4);
    expect(taxSavingAt(withDown, common, 24))
      .toBeCloseTo(taxSavingAt(noDown, common, 24), 4);
  });
  it('만기 초과 m은 만기로 클램프 — 이자 발산 방지', () => {
    const item = baseItem('installment');
    expect(annualInterestAt(item, 120)).toBeCloseTo(annualInterestAt(item, 48), 4);
  });
  it('실제 금융 원리금 월납은 잔액과 금융비용 계산에 함께 반영', () => {
    const calculated = baseItem('installment');
    const quoted = baseItem('installment', {
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        financePayment: 2_000_000,
      },
    });
    expect(annualInterestAt(quoted, 24)).not.toBeCloseTo(annualInterestAt(calculated, 24), 6);
    expect(remainingDebtEach(quoted, 24)).toBeLessThan(remainingDebtEach(calculated, 24));
  });
  it('보유 60개월 이후에는 신규 감가상각비를 만들지 않는다', () => {
    const item = baseItem('installment', {
      months: 72,
      ratePct: 0,
      loanAmount: 40_000_000,
    });
    const common = baseCommon({ biz: 'personal', revenueIndex: 2 });
    expect(deductibleAt(item, common, 60).depEquiv)
      .toBeCloseTo((40_000_000 + financials(item).acqTaxEach) / 5, 4);
    expect(deductibleAt(item, common, 72).depEquiv).toBe(0);
    expect(taxSavingAt(item, common, 72)).toBeCloseTo(taxSavingAt(item, common, 60), 4);
  });
  it('36개월 금융 종료 후에도 60개월까지 감가·보험·정비 세금효과를 계속 계산', () => {
    const item = baseItem('installment', {
      months: 36,
      ratePct: 0,
      insuranceYr: 1_200_000,
      maintenanceYr: 600_000,
    });
    const common = baseCommon({ biz: 'personal', revenueIndex: 2 });
    const basis = 40_000_000 + financials(item).acqTaxEach;

    expect(deductibleAt(item, common, 48).depEquiv)
      .toBeCloseTo(basis / 5, 4);
    expect(deductibleAt(item, common, 48).annualCost)
      .toBeCloseTo(basis / 5 + 1_800_000, 4);
    expect(deductibleAt(item, common, 72).depEquiv).toBe(0);
    expect(deductibleAt(item, common, 72).annualCost).toBeCloseTo(1_800_000, 4);
    expect(taxSavingAt(item, common, 60)).toBeGreaterThan(taxSavingAt(item, common, 36));
    expect(taxSavingAt(item, common, 72)).toBeGreaterThan(taxSavingAt(item, common, 60));
  });
  it('VAT 환급 차량은 공급가액만 감가상각 basis로 사용', () => {
    const item = baseItem('installment', {
      vehicle: { ...baseItem('installment').vehicle, category: 'truck' },
    });
    const b = deductibleAt(item, baseCommon({ biz: 'personal' }), 12);
    const f = financials(item);
    expect(b.depEquiv).toBeCloseTo((40_000_000 / 1.1 + f.acqTaxEach) / 5, 4);
  });
  it('VAT 환급 렌트는 환급 VAT를 연비용과 감가상당액에서 제외', () => {
    const item = baseItem('rent', {
      vehicle: { ...baseItem('rent').vehicle, category: 'truck' },
      monthlyQuote: {
        ...baseItem('rent').monthlyQuote,
        financePayment: 1_100_000,
      },
    });
    const b = deductibleAt(item, baseCommon({ biz: 'personal' }), 12);
    expect(b.annualCost).toBeCloseTo(1_000_000 * 12, 4);
    expect(b.depEquiv).toBeCloseTo(1_000_000 * 12 * 0.7, 4);
  });
  it('소유형 월 부대비용은 비용에는 포함되지만 금융이자·잔액에는 섞이지 않는다', () => {
    const base = baseItem('installment', {
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        financePayment: 900_000,
      },
    });
    const bundled = baseItem('installment', {
      monthlyQuote: {
        ...base.monthlyQuote,
        insurance: 100_000,
        vehicleTax: 50_000,
        maintenance: 30_000,
        serviceFee: 20_000,
      },
    });
    const common = baseCommon({ biz: 'personal' });
    expect(annualInterestAt(bundled, 24)).toBeCloseTo(annualInterestAt(base, 24), 6);
    expect(remainingDebtEach(bundled, 24)).toBeCloseTo(remainingDebtEach(base, 24), 6);
    expect(deductibleAt(bundled, common, 24).annualCost -
      deductibleAt(base, common, 24).annualCost).toBeCloseTo(200_000 * 12, 4);
  });
  it('할부 조기 완납 뒤에는 추가 금융납입·이자를 비용으로 만들지 않는다', () => {
    const item = baseItem('installment', {
      ratePct: 0,
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        financePayment: 10_000_000,
      },
    });
    const common = baseCommon({ biz: 'personal' });
    const at12 = deductibleAt(item, common, 12);
    const at24 = deductibleAt(item, common, 24);
    expect(annualInterestAt(item, 48)).toBe(0);
    expect(at12.annualCost).toBeGreaterThan(0);
    expect(at24.annualCost).toBeCloseTo(at12.depEquiv, 4);
  });
  it('VAT 적격 별도 연간 정비비는 공급가액만 비용에 포함한다', () => {
    const item = baseItem('installment', {
      vehicle: {
        ...baseItem('installment').vehicle,
        category: 'truck',
      },
      ratePct: 0,
      maintenanceYr: 1_100_000,
    });
    const deductible = deductibleAt(
      item,
      baseCommon({ biz: 'personal' }),
      12,
    );
    const f = financials(item);
    expect(deductible.annualCost).toBeCloseTo(
      (40_000_000 / 1.1 + f.acqTaxEach) / 5 + 1_000_000,
      4,
    );
  });
  it('VAT 적격 월 정비비와 같은 연간 정비비는 동일한 비용 기준을 만든다', () => {
    const vehicle = {
      ...baseItem('installment').vehicle,
      category: 'truck' as const,
    };
    const monthly = baseItem('installment', {
      vehicle,
      ratePct: 0,
      monthlyQuote: {
        ...baseItem('installment').monthlyQuote,
        maintenance: 110_000,
      },
    });
    const annual = baseItem('installment', {
      vehicle,
      ratePct: 0,
      maintenanceYr: 1_320_000,
    });
    const common = baseCommon({ biz: 'personal' });
    expect(deductibleAt(monthly, common, 12).annualCost)
      .toBeCloseTo(deductibleAt(annual, common, 12).annualCost, 4);
  });
  it('금융 종료 후 추가 연간비용은 종료 뒤 과세기간부터 비용에 포함한다', () => {
    const item = baseItem('installment', {
      months: 12,
      ratePct: 0,
      insuranceYr: 1_200_000,
      postFinanceAnnualCosts: {
        insurance: 1_200_000,
        vehicleTax: 600_000,
        maintenance: 600_000,
      },
    });
    const common = baseCommon({ biz: 'personal' });
    const yearOne = deductibleAt(item, common, 12);
    const yearTwo = deductibleAt(item, common, 24);
    expect(yearTwo.annualCost - yearOne.annualCost).toBeCloseTo(2_400_000, 4);
  });
});

describe('taxSavingAt (스펙 §4.5 단계5)', () => {
  it('비사업자 → 0', () => {
    const item = baseItem('rent');
    const common = baseCommon();
    expect(deductibleAt(item, common, 24).recognizedEach).toBe(0);
    expect(taxSavingAt(item, common, 24)).toBe(0);
  });
  it('절감 = 인정액 × 연수 × 한계세율 × 대수', () => {
    const c = baseCommon({ biz: 'personal', revenueIndex: 2 }); // 15%
    const item = baseItem('rent');
    const b = deductibleAt(item, c, 24);
    expect(taxSavingAt(item, c, 24)).toBeCloseTo(b.recognizedEach * 2 * 0.15, 4);
  });
  it('케이스 H: 3대면 절감도 3배 — 한도가 대당 적용된다는 의미', () => {
    const c = baseCommon({ biz: 'personal' });
    const one = baseItem('oplease', { insuranceYr: 800_000, maintenanceYr: 300_000 });
    const three = baseItem('oplease', {
      insuranceYr: 800_000, maintenanceYr: 300_000,
      vehicle: { ...one.vehicle, count: 3 },
    });
    expect(taxSavingAt(three, c, 24)).toBeCloseTo(taxSavingAt(one, c, 24) * 3, 4);
  });
  it('만기 초과 m은 만기로 동결', () => {
    const c = baseCommon({ biz: 'personal' });
    const item = baseItem('rent');
    expect(taxSavingAt(item, c, 120)).toBeCloseTo(taxSavingAt(item, c, 48), 4);
  });
  it('법인 전용보험 미가입이면 승용차 비용 인정·세금절감이 0', () => {
    const c = baseCommon({ biz: 'corp' });
    const item = baseItem('rent', {
      tax: { ...baseItem('rent').tax, hasDedicatedInsurance: false },
    });
    const breakdown = deductibleAt(item, c, 24);
    expect(breakdown.complianceBlocked).toBe(true);
    expect(breakdown.recognizedEach).toBe(0);
    expect(taxSavingAt(item, c, 24)).toBe(0);
  });
  it('법인번호판 의무 대상이 미부착이면 비용 인정·세금절감이 0', () => {
    const c = baseCommon({ biz: 'corp' });
    const item = baseItem('oplease', {
      tax: {
        ...baseItem('oplease').tax,
        corporatePlateRequired: true,
        hasCorporatePlate: false,
      },
    });
    const breakdown = deductibleAt(item, c, 24);
    expect(breakdown.complianceBlocked).toBe(true);
    expect(breakdown.recognizedEach).toBe(0);
    expect(taxSavingAt(item, c, 24)).toBe(0);
  });
  it('보험·번호판 미준수 차단은 업무용승용차 한도 제외 차량에는 적용하지 않는다', () => {
    const c = baseCommon({ biz: 'corp' });
    const item = baseItem('installment', {
      vehicle: { ...baseItem('installment').vehicle, category: 'truck' },
      tax: {
        ...baseItem('installment').tax,
        hasDedicatedInsurance: false,
        corporatePlateRequired: true,
        hasCorporatePlate: false,
      },
    });
    expect(deductibleAt(item, c, 24).complianceBlocked).toBe(false);
    expect(taxSavingAt(item, c, 24)).toBeGreaterThan(0);
  });
  it('기본 승인기간 모드는 2026 스냅샷 12개월까지만 절감하고 장기 반복은 명시 선택한다', () => {
    const item = baseItem('rent');
    const approvedOnly = baseCommon({
      biz: 'personal',
      taxRuleHorizon: 'approvedOnly',
    });
    const assumeUnchanged = baseCommon({
      biz: 'personal',
      taxRuleHorizon: 'assumeUnchanged',
    });
    expect(taxSavingAt(item, approvedOnly, 48)).toBeCloseTo(
      taxSavingAt(item, approvedOnly, 12),
      4,
    );
    expect(taxSavingAt(item, assumeUnchanged, 48)).toBeCloseTo(
      taxSavingAt(item, assumeUnchanged, 12) * 4,
      4,
    );
  });
  it('2026년 중간 시작은 연말까지 남은 승인기간만 세금절감을 계산한다', () => {
    const item = baseItem('rent');
    const january = baseCommon({
      biz: 'personal',
      taxRuleHorizon: 'approvedOnly',
      taxStartDate: '2026-01-01',
    });
    const lateJuly = baseCommon({
      biz: 'personal',
      taxRuleHorizon: 'approvedOnly',
      taxStartDate: '2026-07-28',
    });
    expect(taxSavingAt(item, lateJuly, 12)).toBeLessThan(
      taxSavingAt(item, january, 12),
    );
    expect(taxSavingAt(item, lateJuly, 120)).toBeCloseTo(
      taxSavingAt(item, lateJuly, 12),
      4,
    );
  });
});
