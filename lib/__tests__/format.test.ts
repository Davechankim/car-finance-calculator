import { describe, expect, it } from 'vitest';
import { fmtMan, fmtPct, fmtWon, parseDigits } from '../format';

describe('format', () => {
  it('fmtWon: 콤마+원', () => {
    expect(fmtWon(939401.5)).toBe('939,402원');
    expect(fmtWon(-1100000)).toBe('-1,100,000원');
  });
  it('fmtMan: 만/억 축약', () => {
    expect(fmtMan(40_000_000)).toBe('4,000만');
    expect(fmtMan(125_450_000)).toBe('1억 2,545만');
    expect(fmtMan(200_000_000)).toBe('2억');
    expect(fmtMan(-11_000_000)).toBe('-1,100만');
    expect(fmtMan(0)).toBe('0만');
  });
  it('fmtPct', () => {
    expect(fmtPct(5.9)).toBe('5.9%');
  });
  it('parseDigits: 콤마 입력 → 숫자', () => {
    expect(parseDigits('12,000,000')).toBe(12_000_000);
    expect(parseDigits('')).toBe(0);
    expect(parseDigits('abc')).toBe(0);
  });
});
