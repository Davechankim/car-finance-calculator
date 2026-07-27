import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getAdsTxt } from '../../app/ads.txt/route';
import {
  adsensePublisherId,
  getAdsenseConfig,
  normalizeAdsenseClient,
  normalizePublicSiteUrl,
  normalizeAdsenseSlot,
  type AdsenseEnvironment,
} from '../adsense';

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

const ENVIRONMENT_KEYS = Object.keys(
  ACTIVE_ENVIRONMENT,
) as (keyof AdsenseEnvironment)[];

function stubEnvironment(environment: AdsenseEnvironment) {
  for (const key of ENVIRONMENT_KEYS) {
    vi.stubEnv(key, environment[key] ?? '');
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AdSense 공개 식별자 검증', () => {
  it('정확한 게시자 client와 광고 슬롯만 허용한다', () => {
    const client = normalizeAdsenseClient(' ca-pub-1234567890123456 ');
    expect(client).toBe('ca-pub-1234567890123456');
    expect(adsensePublisherId(client)).toBe('pub-1234567890123456');
    expect(normalizeAdsenseSlot('1234567890')).toBe('1234567890');
  });

  it('placeholder·스크립트 조각·형식 오류는 비활성 처리한다', () => {
    expect(normalizeAdsenseClient(undefined)).toBeNull();
    expect(normalizeAdsenseClient('ca-pub-0000')).toBeNull();
    expect(normalizeAdsenseClient('"><script>alert(1)</script>')).toBeNull();
    expect(normalizeAdsenseSlot('slot-123')).toBeNull();
    expect(normalizeAdsenseClient('ca-pub-0000000000000000')).toBeNull();
    expect(normalizeAdsenseSlot('0000000000')).toBeNull();
    expect(normalizeAdsenseSlot('1111111111')).toBeNull();
    expect(adsensePublisherId(null)).toBeNull();
  });

  it('명시적인 공개 HTTPS 원본만 허용한다', () => {
    expect(normalizePublicSiteUrl(undefined)).toBeNull();
    expect(normalizePublicSiteUrl('http://finance.example.kr')).toBeNull();
    expect(normalizePublicSiteUrl('https://localhost')).toBeNull();
    expect(normalizePublicSiteUrl('https://192.168.0.1')).toBeNull();
    expect(normalizePublicSiteUrl('https://finance.example.kr/path')).toBeNull();
    expect(
      normalizePublicSiteUrl('https://finance.example.kr')?.toString(),
    ).toBe('https://finance.example.kr/');
  });
});

describe('AdSense 중앙 활성화 게이트', () => {
  it('환경변수가 없거나 일부만 있으면 모든 공개 값을 닫는다', () => {
    const empty = getAdsenseConfig({});
    const partial = getAdsenseConfig({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT: ACTIVE_ENVIRONMENT.NEXT_PUBLIC_ADSENSE_CLIENT,
    });

    expect(empty.active).toBe(false);
    expect(empty).toMatchObject({
      client: null,
      publisherId: null,
      siteUrl: null,
      slots: null,
    });
    expect(partial.active).toBe(false);
    expect(partial.client).toBeNull();
    expect(partial.issues).toContain('consent-not-ready');
    expect(partial.issues).toContain('invalid-public-site-url');
  });

  it.each(ENVIRONMENT_KEYS)(
    '%s 하나라도 빠지면 비활성 상태를 유지한다',
    (key) => {
      expect(
        getAdsenseConfig({ ...ACTIVE_ENVIRONMENT, [key]: '' }).active,
      ).toBe(false);
    },
  );

  it('모든 명시적 조건이 유효하고 Auto ads가 꺼진 경우에만 활성화한다', () => {
    const config = getAdsenseConfig(ACTIVE_ENVIRONMENT);
    expect(config.active).toBe(true);
    if (!config.active) throw new Error('expected active AdSense config');

    expect(config.client).toBe('ca-pub-1234567890123456');
    expect(config.publisherId).toBe('pub-1234567890123456');
    expect(config.siteUrl.toString()).toBe(
      'https://finance-calculator.example.kr/',
    );
    expect(config.slots).toEqual({
      calculatorTop: '1234567890',
      calculatorBottom: '0987654321',
    });
  });

  it('Auto ads 확인값은 명시적인 false만 허용한다', () => {
    expect(
      getAdsenseConfig({
        ...ACTIVE_ENVIRONMENT,
        NEXT_PUBLIC_ADSENSE_AUTO_ADS: 'true',
      }).active,
    ).toBe(false);
    expect(
      getAdsenseConfig({
        ...ACTIVE_ENVIRONMENT,
        NEXT_PUBLIC_ADSENSE_AUTO_ADS: undefined,
      }).active,
    ).toBe(false);
  });

  it('두 위치에 같은 광고 슬롯을 재사용하면 비활성 처리한다', () => {
    const config = getAdsenseConfig({
      ...ACTIVE_ENVIRONMENT,
      NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM:
        ACTIVE_ENVIRONMENT.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP,
    });
    expect(config.active).toBe(false);
    expect(config.issues).toContain('duplicate-slots');
  });
});

describe('ads.txt 라우트', () => {
  it('설정 없음·부분 설정에서는 404를 반환한다', async () => {
    stubEnvironment({
      NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
      NEXT_PUBLIC_ADSENSE_CLIENT: ACTIVE_ENVIRONMENT.NEXT_PUBLIC_ADSENSE_CLIENT,
    });
    const response = getAdsTxt();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('pub-1234567890123456');
  });

  it('중앙 게이트가 완전히 열린 경우에만 게시자 행을 반환한다', async () => {
    stubEnvironment(ACTIVE_ENVIRONMENT);
    const response = getAdsTxt();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n',
    );
  });
});
