import { describe, expect, it } from 'vitest';
import {
  exitOptionsAt, financials, remainingDebtEach, sunkAt,
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
    expect(r48.options.find((o) => o.kind === 'settleSell')!.cost)
      .toBeCloseTo(sunkAt(item, common, 48) + 12_000_000 - resale48, 0);
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

  it('VAT 공제 차량 매각은 매출 VAT를 제외한 시세를 회수하고 운용리스 인수 VAT도 공제', () => {
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
});
