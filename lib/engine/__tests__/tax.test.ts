import { describe, expect, it } from 'vitest';
import { annualInterestAt, deductibleAt, deductibleFromParts, taxSavingAt } from '../tax';
import { financials } from '../costAt';
import { baseCommon, baseItem } from './fixtures';

const parts = (over: Partial<Parameters<typeof deductibleFromParts>[0]> = {}) =>
  deductibleFromParts({
    annualCost: 18_000_000, depEquiv: 12_600_000, exempt: false,
    useDrivingLog: false, bizUsePct: 100, industryRate: 1, ...over,
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

  it('한도제외 차량: 전액 인정 (비율 1, 감가초과 0)', () => {
    const b = parts({ exempt: true, annualCost: 30_000_000, depEquiv: 21_000_000 });
    expect(b.recognizedEach).toBe(30_000_000);
  });

  it('부동산임대업 50%: 인정액 절반', () => {
    expect(parts({ industryRate: 0.5 }).recognizedEach).toBeCloseTo(6_250_000, 0);
  });
});

describe('annualInterestAt / deductibleAt — 항목 조립', () => {
  it('m=0이면 연이자 0', () => {
    expect(annualInterestAt(baseItem('installment'), 0)).toBe(0);
  });
  it('할부 연이자 > 0이고, 연비용 = 정액감가 + 연이자 (보험·정비 0)', () => {
    const item = baseItem('installment');
    const i = annualInterestAt(item, 24);
    expect(i).toBeGreaterThan(0);
    const b = deductibleAt(item, baseCommon({ biz: 'personal' }), 24);
    expect(b.annualCost).toBeCloseTo(40_000_000 / 5 + i, 4);
    expect(b.depEquiv).toBeCloseTo(8_000_000, 4); // 4,000만/5 = 정확히 한도
  });
  it('렌트 감가상당액 = 연렌트료×70%, 운용리스 = ×93%', () => {
    const rent = baseItem('rent');
    const op = baseItem('oplease');
    const c = baseCommon({ biz: 'personal' });
    expect(deductibleAt(rent, c, 24).depEquiv)
      .toBeCloseTo(financials(rent).monthly * 12 * 0.7, 4);
    expect(deductibleAt(op, c, 24).depEquiv)
      .toBeCloseTo(financials(op).monthly * 12 * 0.93, 4);
  });
});

describe('taxSavingAt (스펙 §4.5 단계5)', () => {
  it('비사업자 → 0', () => {
    expect(taxSavingAt(baseItem('rent'), baseCommon(), 24)).toBe(0);
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
});
