import { describe, expect, it } from 'vitest';
import {
  monthlyRate, pmt, pmtWithBalloon, remBal, remBalForPayment,
} from '../pmt';

describe('pmt (스펙 §4.1)', () => {
  it('케이스 A: 4,000만/연6%/48개월 → 월 939,401.5원 (v2 문서 939,929는 오기)', () => {
    const r = monthlyRate(6); // 0.005
    expect(Math.abs(pmt(40_000_000, r, 48) - 939_401.5)).toBeLessThan(1);
  });
  it('금리 0% → 단순 분할', () => {
    expect(pmt(48_000_000, 0, 48)).toBe(1_000_000);
  });
  it('0%에 매우 가까운 금리에서도 Infinity·NaN 없이 0% 결과에 수렴한다', () => {
    const r = monthlyRate(1e-12);
    const payment = pmt(48_000_000, r, 48);
    expect(Number.isFinite(payment)).toBe(true);
    expect(payment).toBeCloseTo(1_000_000, 4);
    expect(remBalForPayment(48_000_000, r, payment, 24)).toBeCloseTo(24_000_000, 2);
  });
  it('원금 0 → 월납 0', () => {
    expect(pmt(0, 0.005, 48)).toBe(0);
  });
  it('balloon PMT는 잔존가치의 현재가치를 제외해 계산하고 만기에 잔존액을 남긴다', () => {
    const r = monthlyRate(6);
    const payment = pmtWithBalloon(40_000_000, r, 48, 12_000_000);
    expect(payment).toBeGreaterThan(pmt(28_000_000, r, 48));
    expect(remBalForPayment(40_000_000, r, payment, 48)).toBeCloseTo(12_000_000, 4);
  });
});

describe('remBal (스펙 §4.1)', () => {
  it('케이스 C: 2,800만/연5.5%/48개월, 24개월 시점 잔액이 원금의 50~55%', () => {
    const r = monthlyRate(5.5);
    const bal = remBal(28_000_000, r, 48, 24);
    expect(bal / 28_000_000).toBeGreaterThan(0.50);
    expect(bal / 28_000_000).toBeLessThan(0.55);
  });
  it('m=0이면 원금 그대로, m=n이면 0', () => {
    const r = monthlyRate(5.5);
    expect(Math.abs(remBal(28_000_000, r, 48, 0) - 28_000_000)).toBeLessThan(1);
    expect(Math.abs(remBal(28_000_000, r, 48, 48))).toBeLessThan(1);
  });
  it('금리 0%: 선형 상환', () => {
    expect(remBal(48_000_000, 0, 48, 12)).toBe(36_000_000);
  });
  it('단조 감소', () => {
    const r = monthlyRate(6);
    let prev = Infinity;
    for (let m = 0; m <= 48; m += 6) {
      const b = remBal(40_000_000, r, 48, m);
      expect(b).toBeLessThanOrEqual(prev);
      prev = b;
    }
  });
  it('실제 납입액이 표준 PMT보다 작으면 만기에도 잔액이 남는다', () => {
    const r = monthlyRate(6);
    expect(remBalForPayment(40_000_000, r, 1, 48)).toBeGreaterThan(40_000_000);
  });
});
