import { describe, expect, it } from 'vitest';
import {
  exitOptionsAt, financials, ownershipMaturityNetOutflowEach,
  remainingDebtEach, resaleOutputVatFraction, sunkAt,
} from '../costAt';
import { monthlyRate, remBal } from '../pmt';
import { baseCommon, baseItem } from './fixtures';

const common = baseCommon();

describe('exitOptionsAt (스펙 §4.4)', () => {
  it('렌트: 승계가 해지보다 싸면 bestExit는 transfer', () => {
    const item = baseItem('rent', {
      exit: { canTransfer: true, transferFee: 500_000, penaltyPct: 30, returnInspFee: 200_000, mileagePenalty: 0, earlyDiscount: 0, buyoutFee: 0 },
    });
    const { monthly } = financials(item);
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    const terminate = sunk + 24 * monthly * 0.3 + 200_000; // 잔여 24개월
    expect(r.options.find((o) => o.kind === 'terminate')!.cost).toBeCloseTo(terminate, 4);
    expect(r.options.find((o) => o.kind === 'transfer')!.cost).toBeCloseTo(sunk + 500_000, 4);
    expect(r.best.kind).toBe('transfer');
  });

  it('렌트 만기(m=n): 위약금 0, 점검비만 — 승계 옵션 없음', () => {
    const item = baseItem('rent', {
      exit: { canTransfer: true, transferFee: 500_000, penaltyPct: 30, returnInspFee: 200_000, mileagePenalty: 0, earlyDiscount: 0, buyoutFee: 0 },
    });
    const r = exitOptionsAt(item, common, 48);
    expect(r.options).toHaveLength(1);
    expect(r.options[0].kind).toBe('return');
    expect(r.options[0].cost).toBeCloseTo(sunkAt(item, common, 48) + 200_000, 4);
  });

  it('운용리스 조기인수: 실제 납입 기반 잔여채무와 인수 취득세를 반영', () => {
    const item = baseItem('oplease');
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    const debt = remainingDebtEach(item, 24);
    const buyoutTax = Math.round((debt / 1.1) * 0.07);
    const buyout = r.options.find((o) => o.kind === 'buyoutSell')!;
    expect(buyout.cost).toBeCloseTo(sunk + debt + buyoutTax - 28_900_000, 0);
    expect(r.best.kind).toBe('buyoutSell');
  });

  it('금융리스: 표준 balloon 상환표는 만기에 잔존가치만 남긴다', () => {
    const item = baseItem('finlease');
    const f = financials(item);
    expect(f.principal).toBe(40_000_000);
    const r24 = exitOptionsAt(item, common, 24);
    const debt24 = remainingDebtEach(item, 24);
    expect(r24.options.find((o) => o.kind === 'settleSell')!.cost)
      .toBeCloseTo(sunkAt(item, common, 24) + debt24 - 28_900_000, 0);
    const r48 = exitOptionsAt(item, common, 48);
    const resale48 = 40_000_000 * 0.85 ** 4; // 20,880,250
    expect(remainingDebtEach(item, 48)).toBeCloseTo(12_000_000, 4);
    expect(ownershipMaturityNetOutflowEach(item)).toBeCloseTo(12_000_000, 4);
    expect(r48.options.find((o) => o.kind === 'settleSell')!.cost)
      .toBeCloseTo(sunkAt(item, common, 48) - resale48, 0);
  });

  it('금융리스 만기 잔존정산·보증금 반환은 한 번만 반영하고 이후 시세로 매각', () => {
    const item = baseItem('finlease', {
      months: 36,
      deposit: { mode: 'amount', value: 5_000_000 },
      exit: {
        ...baseItem('finlease').exit,
        earlyDiscount: 1_000_000,
        buyoutFee: 300_000,
      },
    });
    const debtAtMaturity = remainingDebtEach(item, item.months);
    const settlementNet = debtAtMaturity + 300_000 - 5_000_000;

    const at36 = exitOptionsAt(item, common, 36);
    const at60 = exitOptionsAt(item, common, 60);
    const exit36 = at36.options.find((option) => option.kind === 'settleSell')!;
    const exit60 = at60.options.find((option) => option.kind === 'settleSell')!;

    const f = financials(item);
    expect(ownershipMaturityNetOutflowEach(item)).toBeCloseTo(settlementNet, 4);
    expect(sunkAt(item, common, 36) - sunkAt(item, common, 35))
      .toBeCloseTo(f.monthly + settlementNet, 4);
    expect(sunkAt(item, common, 60) - sunkAt(item, common, 36)).toBe(0);
    expect(exit36.cost).toBeCloseTo(sunkAt(item, common, 36) - at36.resaleEach, 4);
    expect(exit60.cost).toBeCloseTo(sunkAt(item, common, 60) - at60.resaleEach, 4);
    expect(at60.resaleEach).toBeLessThan(at36.resaleEach);
    expect(exit36.label).toBe('만기정산 후 매각');
    expect(exit60.label).toBe('보유차량 매각 (만기정산 반영)');
  });

  it('케이스 E: 할부 24개월, 시세 2,500만 > 잔여대출 → 매각차익이 누적지출 상쇄(음수 가능)', () => {
    const item = baseItem('installment', {
      ratePct: 5.5,
      down: { mode: 'amount', value: 12_000_000 },
      loanAmount: 28_000_000,
      depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [{ atMonths: 24, price: 25_000_000 }] },
    });
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    const bal = remBal(28_000_000, monthlyRate(5.5), 48, 24); // ≈ 원금의 52.7% ≈ 1,477만
    expect(r.best.cost).toBeCloseTo(sunk + bal - 25_000_000, 4);
    expect(r.best.cost - sunk).toBeGreaterThan(-10_500_000);
    expect(r.best.cost - sunk).toBeLessThan(-10_000_000);
  });

  it('중도상환 감면(earlyDiscount)은 잔여채무에서 차감, 바닥은 0', () => {
    const item = baseItem('installment', {
      loanAmount: 28_000_000,
      exit: { ...baseItem('installment').exit, earlyDiscount: 99_000_000 },
    });
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    expect(r.best.cost).toBeCloseTo(sunk + 0 - 28_900_000, 0); // max(잔여−감면,0)=0
  });

  it('대수 반영: 2대면 (출구비용−sunk) 차액도 2배 (tradeIn=0)', () => {
    const one = baseItem('oplease');
    const two = baseItem('oplease', { vehicle: { ...one.vehicle, count: 2 } });
    const d1 = exitOptionsAt(one, common, 24).best.cost - sunkAt(one, common, 24);
    const d2 = exitOptionsAt(two, common, 24).best.cost - sunkAt(two, common, 24);
    expect(d2).toBeCloseTo(d1 * 2, 4);
  });

  it('금융리스 earlyDiscount 부분 감면: 잔여채무에서 그만큼만 차감', () => {
    const base = baseItem('finlease');
    const disc = baseItem('finlease', { exit: { ...base.exit, earlyDiscount: 1_000_000 } });
    const d0 = exitOptionsAt(base, common, 24).options.find((o) => o.kind === 'settleSell')!.cost;
    const d1 = exitOptionsAt(disc, common, 24).options.find((o) => o.kind === 'settleSell')!.cost;
    expect(d0 - d1).toBeCloseTo(1_000_000, 4);
  });
  it('운용·금융리스 인수 부대비용은 인수 출구에 대당 가산', () => {
    for (const method of ['oplease', 'finlease'] as const) {
      const base = baseItem(method);
      const withFee = baseItem(method, {
        exit: { ...base.exit, buyoutFee: 700_000 },
      });
      const kind = method === 'oplease' ? 'buyoutSell' : 'settleSell';
      const before = exitOptionsAt(base, common, 24).options.find((o) => o.kind === kind)!.cost;
      const after = exitOptionsAt(withFee, common, 24).options.find((o) => o.kind === kind)!.cost;
      expect(after - before).toBeCloseTo(700_000, 4);
    }
  });

  it('운용리스 만기: [반납, 인수후매각] 2옵션 중 최소 선택', () => {
    const item = baseItem('oplease'); // 만기 시세 2,088만 > 잔존 1,200만 → 인수후매각 유리
    const r = exitOptionsAt(item, common, 48);
    expect(r.options.map((o) => o.kind).sort()).toEqual(['buyoutSell', 'return']);
    expect(r.best.kind).toBe('buyoutSell');
  });

  it('초과주행 위약금은 반납 계열 비용에 가산', () => {
    const base = baseItem('rent');
    const mp = baseItem('rent', { exit: { ...base.exit, mileagePenalty: 700_000 } });
    const c0 = exitOptionsAt(base, common, 24).options.find((o) => o.kind === 'terminate')!.cost;
    const c1 = exitOptionsAt(mp, common, 24).options.find((o) => o.kind === 'terminate')!.cost;
    expect(c1 - c0).toBeCloseTo(700_000, 4);
  });

  it('렌트·리스 반환형 보증금은 출구비용에서 전액 환급', () => {
    const without = baseItem('rent');
    const withDeposit = baseItem('rent', {
      deposit: { mode: 'amount', value: 5_000_000 },
    });
    const baseExit = exitOptionsAt(without, common, 24).best.cost;
    const depositExit = exitOptionsAt(withDeposit, common, 24).best.cost;
    expect(depositExit).toBeCloseTo(baseExit, 4);
  });

  it('일반과세 사업용 자산 매각은 매입 VAT 공제 여부와 별개로 매출 VAT를 차감한다', () => {
    const biz = baseCommon({ biz: 'personal' });
    const truckVehicle = {
      ...baseItem('installment').vehicle,
      category: 'truck' as const,
    };
    const installment = baseItem('installment', { vehicle: truckVehicle });
    const instResult = exitOptionsAt(installment, biz, 24);
    const instDebt = remainingDebtEach(installment, 24);
    expect(instResult.best.cost).toBeCloseTo(
      sunkAt(installment, biz, 24) + instDebt - (28_900_000 / 1.1),
      4,
    );

    const passengerWithoutEvidence = baseItem('installment', {
      tax: {
        ...baseItem('installment').tax,
        hasQualifiedEvidence: false,
      },
    });
    const passengerResult = exitOptionsAt(passengerWithoutEvidence, biz, 24);
    expect(passengerResult.best.cost).toBeCloseTo(
      sunkAt(passengerWithoutEvidence, biz, 24) +
        remainingDebtEach(passengerWithoutEvidence, 24) -
        28_900_000 / 1.1,
      4,
    );

    const op = baseItem('oplease', {
      vehicle: { ...truckVehicle },
      acqTaxRatePct: 5,
    });
    const opResult = exitOptionsAt(op, biz, 24);
    const debt = remainingDebtEach(op, 24);
    const tax = Math.round((debt / 1.1) * 0.05);
    const buyout = opResult.options.find((option) => option.kind === 'buyoutSell')!;
    expect(buyout.cost).toBeCloseTo(
      sunkAt(op, biz, 24) + debt / 1.1 + tax - 28_900_000 / 1.1,
      4,
    );
  });

  it('개인·면세 전용 등 과세사업용 자산이 아니면 매각 시 매출 VAT를 차감하지 않는다', () => {
    const biz = baseCommon({ biz: 'personal' });
    const item = baseItem('installment', {
      tax: {
        ...baseItem('installment').tax,
        isTaxableBusinessAsset: false,
      },
    });
    const result = exitOptionsAt(item, biz, 24);
    expect(result.best.cost).toBeCloseTo(
      sunkAt(item, biz, 24) + remainingDebtEach(item, 24) - 28_900_000,
      4,
    );
  });

  it('간이과세 매각 VAT는 선택 업종 부가가치율을, 겸영·불확실은 일반세율을 보수 적용한다', () => {
    const item = baseItem('installment');
    const simplifiedRetail = baseCommon({
      biz: 'personal',
      vatTaxType: 'simplified',
      industryIndex: 1,
    });
    const mixed = baseCommon({
      biz: 'personal',
      vatTaxType: 'mixedOrUncertain',
    });
    const exempt = baseCommon({
      biz: 'personal',
      vatTaxType: 'exempt',
    });

    expect(resaleOutputVatFraction(item, simplifiedRetail, 24)).toBeCloseTo(0.15 * 0.1, 8);
    expect(resaleOutputVatFraction(item, mixed, 24)).toBeCloseTo(10 / 110, 8);
    expect(resaleOutputVatFraction(item, exempt, 24)).toBe(0);

    const simplifiedExit = exitOptionsAt(item, simplifiedRetail, 24);
    expect(simplifiedExit.best.cost).toBeCloseTo(
      sunkAt(item, simplifiedRetail, 24)
        + remainingDebtEach(item, 24)
        - 28_900_000 * (1 - 0.15 * 0.1),
      4,
    );
  });

  it('approvedOnly는 승인기간 뒤 혜택은 중단하고 매각·인수 납부세금은 보수 유지한다', () => {
    const approvedOnly = baseCommon({
      biz: 'personal',
      taxRuleHorizon: 'approvedOnly',
      taxStartDate: '2026-01-01',
    });
    const repeated = {
      ...approvedOnly,
      taxRuleHorizon: 'assumeUnchanged' as const,
    };
    const installment = baseItem('installment');
    const approvedExit = exitOptionsAt(installment, approvedOnly, 24);
    const repeatedExit = exitOptionsAt(installment, repeated, 24);
    expect(approvedExit.best.cost).toBeCloseTo(repeatedExit.best.cost, 4);
    expect(resaleOutputVatFraction(installment, approvedOnly, 11.999999))
      .toBeCloseTo(resaleOutputVatFraction(installment, approvedOnly, 12), 8);

    const operatingLease = baseItem('oplease', {
      vehicle: {
        ...baseItem('oplease').vehicle,
        category: 'truck',
      },
      tax: {
        ...baseItem('oplease').tax,
        isTaxableBusinessAsset: false,
      },
      acqTaxRatePct: 0,
    });
    const approvedBuyout = exitOptionsAt(operatingLease, approvedOnly, 24)
      .options.find((option) => option.kind === 'buyoutSell')!;
    const repeatedBuyout = exitOptionsAt(operatingLease, repeated, 24)
      .options.find((option) => option.kind === 'buyoutSell')!;
    expect(approvedBuyout.cost - repeatedBuyout.cost).toBeCloseTo(
      remainingDebtEach(operatingLease, 24) * (10 / 110),
      4,
    );

    const acquisitionTaxLease = baseItem('oplease', {
      tax: {
        ...baseItem('oplease').tax,
        hasQualifiedEvidence: false,
        isTaxableBusinessAsset: false,
      },
      acqTaxRatePct: 5,
    });
    const approvedAcquisition = exitOptionsAt(acquisitionTaxLease, approvedOnly, 24)
      .options.find((option) => option.kind === 'buyoutSell')!;
    const repeatedAcquisition = exitOptionsAt(acquisitionTaxLease, repeated, 24)
      .options.find((option) => option.kind === 'buyoutSell')!;
    expect(approvedAcquisition.cost).toBeCloseTo(repeatedAcquisition.cost, 4);
  });

  it('경차 운용리스 인수가 감면 일몰 뒤면 75만원을 차감하지 않는다', () => {
    const item = baseItem('oplease', {
      vehicle: {
        ...baseItem('oplease').vehicle,
        price: 100_000_000,
        category: 'compact',
      },
      months: 48,
      acqTaxRatePct: 4,
      tax: {
        ...baseItem('oplease').tax,
        isTaxableBusinessAsset: false,
      },
    });
    const commonAfterExpiry = baseCommon({
      taxStartDate: '2026-01-01',
      taxRuleHorizon: 'approvedOnly',
    });
    const result = exitOptionsAt(item, commonAfterExpiry, 48);
    const debt = remainingDebtEach(item, 48);
    const fullAcquisitionTax = Math.round((debt / 1.1) * 0.04);
    const buyout = result.options.find((option) => option.kind === 'buyoutSell')!;
    expect(buyout.cost).toBeCloseTo(
      sunkAt(item, commonAfterExpiry, 48)
        + debt
        + fullAcquisitionTax
        - result.resaleEach,
      4,
    );
  });
});
