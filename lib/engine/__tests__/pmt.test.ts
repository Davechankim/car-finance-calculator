import { describe, expect, it } from 'vitest';
import { monthlyRate, pmt, remBal } from '../pmt';

describe('pmt (스펙 §4.1)', () => {
  it('케이스 A: 4,000만/연6%/48개월 → 월 939,401.5원 (v2 문서 939,929는 오기)', () => {
    const r = monthlyRate(6); // 0.005
    expect(Math.abs(pmt(40_000_000, r, 48) - 939_401.5)).toBeLessThan(1);
  });
  it('금리 0% → 단순 분할', () => {
    expect(pmt(48_000_000, 0, 48)).toBe(1_000_000);
  });
  it('원금 0 → 월납 0', () => {
    expect(pmt(0, 0.005, 48)).toBe(0);
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
    expect(remBal(28_000_000, r, 48, 0)).toBeCloseTo(28_000_000, 4);
    expect(remBal(28_000_000, r, 48, 48)).toBeCloseTo(0, 4);
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
});
