import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdsenseEnvironment } from '../adsense';

const ACTIVE_ENVIRONMENT = {
  NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
  NEXT_PUBLIC_ADSENSE_CONSENT_READY: 'true',
  NEXT_PUBLIC_ADSENSE_POLICY_READY: 'true',
  NEXT_PUBLIC_ADSENSE_AUTO_ADS: 'false',
  NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP: '1234567890',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM: '0987654321',
  NEXT_PUBLIC_SITE_URL: 'https://finance-calculator.example.kr',
  NEXT_PUBLIC_SITE_PUBLIC: 'true',
} satisfies AdsenseEnvironment;

function stubEnvironment(environment: AdsenseEnvironment) {
  for (const key of Object.keys(ACTIVE_ENVIRONMENT) as (keyof AdsenseEnvironment)[]) {
    vi.stubEnv(key, environment[key] ?? '');
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('루트 광고 script와 account meta 게이트', () => {
  it('부분 설정에서는 script와 account meta를 만들지 않는다', async () => {
    stubEnvironment({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT: ACTIVE_ENVIRONMENT.NEXT_PUBLIC_ADSENSE_CLIENT,
    });
    const { default: RootLayout, metadata } = await import('../../app/layout');
    const markup = renderToStaticMarkup(
      createElement(RootLayout, { children: createElement('main') }),
    );

    expect(markup).not.toContain('pagead2.googlesyndication.com');
    expect(metadata.other).toBeUndefined();
  });

  it('완전한 활성 설정에서만 script와 account meta를 만든다', async () => {
    stubEnvironment(ACTIVE_ENVIRONMENT);
    const { default: RootLayout, metadata } = await import('../../app/layout');
    const markup = renderToStaticMarkup(
      createElement(RootLayout, { children: createElement('main') }),
    );

    expect(markup).toContain(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456',
    );
    expect(metadata.other).toEqual({
      'google-adsense-account': 'ca-pub-1234567890123456',
    });
  });

  it('개인정보처리방침은 실제 중앙 게이트 상태와 같은 문구를 표시한다', async () => {
    stubEnvironment({});
    const { default: InactivePrivacyPage } = await import('../../app/privacy/page');
    const inactiveMarkup = renderToStaticMarkup(createElement(InactivePrivacyPage));
    expect(inactiveMarkup).toContain('아직 운영 환경에 구성하지 않았습니다');
    expect(inactiveMarkup).not.toContain('현재 운영 배포에는 Google AdSense 광고');

    vi.resetModules();
    stubEnvironment(ACTIVE_ENVIRONMENT);
    const { default: ActivePrivacyPage } = await import('../../app/privacy/page');
    const activeMarkup = renderToStaticMarkup(createElement(ActivePrivacyPage));
    expect(activeMarkup).toContain('현재 운영 배포에는 Google AdSense 광고');
    expect(activeMarkup).not.toContain('아직 운영 환경에 구성하지 않았습니다');
  });
});
