// lib/format.ts — 표시용 포맷터 (엔진은 원 단위 number만 다룬다)
export const fmtWon = (n: number): string => `${(Math.round(n) || 0).toLocaleString('ko-KR')}원`; // || 0: -0 정규화

export const fmtPct = (n: number): string => `${n}%`;

/** 만원/억 축약 — 결과 표시용 */
export function fmtMan(n: number): string {
  const sign = n < 0 ? '-' : '';
  const man = Math.round(Math.abs(n) / 10_000);
  if (man === 0) return '0만'; // 만원 미만(±)은 부호 없이 0만
  if (man >= 10_000) {
    const eok = Math.floor(man / 10_000);
    const rest = man % 10_000;
    return rest === 0 ? `${sign}${eok}억` : `${sign}${eok}억 ${rest.toLocaleString('ko-KR')}만`;
  }
  return `${sign}${man.toLocaleString('ko-KR')}만`;
}

/** "12,000,000" 같은 입력 문자열 → 숫자. 정수 원 단위 전용 — 소수점도 제거되므로("1.5"→15) 소수 입력 필드에 쓰지 말 것. */
export function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d === '' ? 0 : Number(d);
}
