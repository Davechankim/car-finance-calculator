import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdSlot } from './AdSlot';
import type { AdsenseEnvironment } from '../lib/adsense';

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
});

describe('AdSlot 렌더링 게이트', () => {
  it('설정이 없거나 일부뿐이면 광고 DOM을 만들지 않는다', () => {
    stubEnvironment({});
    expect(
      renderToStaticMarkup(
        createElement(AdSlot, {
          placement: 'calculatorTop',
          label: '상단 광고',
        }),
      ),
    ).toBe('');

    stubEnvironment({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT: ACTIVE_ENVIRONMENT.NEXT_PUBLIC_ADSENSE_CLIENT,
    });
    expect(
      renderToStaticMarkup(
        createElement(AdSlot, {
          placement: 'calculatorBottom',
          label: '하단 광고',
        }),
      ),
    ).toBe('');
  });

  it('완전한 활성 설정에서는 지정된 고정 슬롯만 렌더링한다', () => {
    stubEnvironment(ACTIVE_ENVIRONMENT);
    const markup = renderToStaticMarkup(
      createElement(AdSlot, {
        placement: 'calculatorTop',
        label: '상단 광고',
      }),
    );

    expect(markup).toContain('class="adsbygoogle"');
    expect(markup).toContain('data-ad-client="ca-pub-1234567890123456"');
    expect(markup).toContain('data-ad-slot="1234567890"');
    expect(markup).not.toContain('0987654321');
  });
});
