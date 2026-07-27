import { describe, expect, it } from 'vitest';

import type { AdsenseEnvironment } from '../adsense';
import {
  ADSENSE_CLIENT_BUILD_KEYS,
  findBakedAdsenseClientBundle,
} from '../../scripts/adsense-client-build-config';

const ACTIVE_ENVIRONMENT = {
  NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
  NEXT_PUBLIC_ADSENSE_CONSENT_READY: 'true',
  NEXT_PUBLIC_ADSENSE_POLICY_READY: 'true',
  NEXT_PUBLIC_ADSENSE_AUTO_ADS: 'false',
  NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-2345678901234567',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP: '2345678901',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM: '7654321098',
  NEXT_PUBLIC_SITE_URL: 'https://finance-calculator.example.kr',
  NEXT_PUBLIC_SITE_PUBLIC: 'true',
} satisfies AdsenseEnvironment;

function bakedSource(
  environment: AdsenseEnvironment = ACTIVE_ENVIRONMENT,
): string {
  return ADSENSE_CLIENT_BUILD_KEYS.map((key) => (
    `${key}:${JSON.stringify(environment[key])}`
  )).join(',');
}

describe('AdSense client build configuration check', () => {
  it('한 클라이언트 번들에 모든 공개 설정이 실제 값으로 bake된 경우만 찾는다', () => {
    expect(findBakedAdsenseClientBundle([
      { filePath: 'dist/client/page.js', contents: bakedSource() },
    ], ACTIVE_ENVIRONMENT)).toBe('dist/client/page.js');
  });

  it('광고 OFF 빌드의 unresolved 공개 환경변수는 active 런타임 설정과 일치하지 않는다', () => {
    const unresolved = ADSENSE_CLIENT_BUILD_KEYS.map((key) => (
      `${key}:{}.${key}`
    )).join(',');

    expect(findBakedAdsenseClientBundle([
      { filePath: 'dist/client/page.js', contents: unresolved },
    ], ACTIVE_ENVIRONMENT)).toBeNull();
  });

  it('한 플래그가 다르거나 설정이 여러 파일에 흩어져도 일치로 보지 않는다', () => {
    expect(findBakedAdsenseClientBundle([
      {
        filePath: 'dist/client/stale.js',
        contents: bakedSource({
          ...ACTIVE_ENVIRONMENT,
          NEXT_PUBLIC_ADSENSE_POLICY_READY: 'false',
        }),
      },
      {
        filePath: 'dist/client/part-a.js',
        contents: bakedSource().slice(0, Math.floor(bakedSource().length / 2)),
      },
      {
        filePath: 'dist/client/part-b.js',
        contents: bakedSource().slice(Math.floor(bakedSource().length / 2)),
      },
    ], ACTIVE_ENVIRONMENT)).toBeNull();
  });
});
