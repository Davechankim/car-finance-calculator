import { describe, expect, it } from 'vitest';
import { convertModeValue } from '../Field';

describe('convertModeValue', () => {
  it('이미 선택된 입력 방식을 다시 눌러도 값을 변경하지 않는다', () => {
    const current = { mode: 'pct' as const, value: 30 };
    expect(convertModeValue(current, 'pct', 40_000_000)).toBe(current);
    expect(current.value).toBe(30);
  });

  it('비율과 금액을 차량가 기준으로 왕복 변환한다', () => {
    const amount = convertModeValue({ mode: 'pct', value: 30 }, 'amount', 40_000_000);
    expect(amount).toEqual({ mode: 'amount', value: 12_000_000 });
    expect(convertModeValue(amount, 'pct', 40_000_000)).toEqual({ mode: 'pct', value: 30 });

    const nonRound = { mode: 'amount' as const, value: 11_000_000 };
    const pct = convertModeValue(nonRound, 'pct', 40_000_000);
    expect(pct).toEqual({ mode: 'pct', value: 27.5 });
    expect(convertModeValue(pct, 'amount', 40_000_000)).toEqual(nonRound);
  });

  it('비율을 금액으로 바꿀 때 소수 원을 반올림해 숫자 입력 재해석을 막는다', () => {
    const amount = convertModeValue({ mode: 'pct', value: 33.3 }, 'amount', 40_000_001);
    expect(amount.mode).toBe('amount');
    expect(Number.isInteger(amount.value)).toBe(true);
    expect(amount.value).toBe(13_320_000);
  });

  it('금액→비율 변환은 0원 차량과 차량가 초과 금액에서도 0~100% 범위를 지킨다', () => {
    expect(convertModeValue({ mode: 'amount', value: 5_000_000 }, 'pct', 0))
      .toEqual({ mode: 'pct', value: 0 });
    expect(convertModeValue({ mode: 'amount', value: 50_000_000 }, 'pct', 40_000_000))
      .toEqual({ mode: 'pct', value: 100 });
  });
});
