import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import {
  getAdsenseConfig,
  readAdsenseEnvironment,
  type AdsenseEnvironment,
} from '../lib/adsense';
import {
  findBakedAdsenseClientBundle,
  type ClientBundleSource,
} from './adsense-client-build-config';

nextEnv.loadEnvConfig(process.cwd(), false);

const SYNTHETIC_CLIENT = 'ca-pub-1234567890123456';
const COMPLETE_FIXTURE = {
  NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
  NEXT_PUBLIC_ADSENSE_CONSENT_READY: 'true',
  NEXT_PUBLIC_ADSENSE_POLICY_READY: 'true',
  NEXT_PUBLIC_ADSENSE_AUTO_ADS: 'false',
  NEXT_PUBLIC_ADSENSE_CLIENT: SYNTHETIC_CLIENT,
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP: '1234567890',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM: '0987654321',
  NEXT_PUBLIC_SITE_URL: 'https://finance-calculator.example.kr',
  NEXT_PUBLIC_SITE_PUBLIC: 'true',
} satisfies AdsenseEnvironment;

assert.equal(getAdsenseConfig({}).active, false);
assert.equal(
  getAdsenseConfig({
    NEXT_PUBLIC_ADSENSE_ENABLED: 'true',
    NEXT_PUBLIC_ADSENSE_CLIENT: SYNTHETIC_CLIENT,
  }).active,
  false,
);
assert.equal(getAdsenseConfig(COMPLETE_FIXTURE).active, true);
assert.equal(getAdsenseConfig({
  ...COMPLETE_FIXTURE,
  NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-0000000000000000',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP: '0000000000',
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM: '1111111111',
}).active, false);
assert.equal(getAdsenseConfig({
  ...COMPLETE_FIXTURE,
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM:
    COMPLETE_FIXTURE.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP,
}).active, false);

for (const key of Object.keys(COMPLETE_FIXTURE) as (keyof AdsenseEnvironment)[]) {
  assert.equal(
    getAdsenseConfig({ ...COMPLETE_FIXTURE, [key]: '' }).active,
    false,
    `${key}가 빠진 설정이 광고를 활성화했습니다.`,
  );
}

const releaseEnvironment = readAdsenseEnvironment();
const releaseConfig = getAdsenseConfig(releaseEnvironment);
const isNonDefaultFlag = (value: string | undefined) => {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== 'false');
};
const activationWasAttempted = Boolean(
  isNonDefaultFlag(releaseEnvironment.NEXT_PUBLIC_ADSENSE_ENABLED)
  || isNonDefaultFlag(releaseEnvironment.NEXT_PUBLIC_ADSENSE_CONSENT_READY)
  || isNonDefaultFlag(releaseEnvironment.NEXT_PUBLIC_ADSENSE_POLICY_READY)
  || isNonDefaultFlag(releaseEnvironment.NEXT_PUBLIC_ADSENSE_AUTO_ADS)
  || isNonDefaultFlag(releaseEnvironment.NEXT_PUBLIC_SITE_PUBLIC)
  || releaseEnvironment.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()
  || releaseEnvironment.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP?.trim()
  || releaseEnvironment.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM?.trim(),
);

if (activationWasAttempted && !releaseConfig.active) {
  throw new Error(
    `AdSense 활성화 시도가 불완전합니다: ${releaseConfig.issues.join(', ')}`,
  );
}
if (
  releaseConfig.active
  && (
    releaseConfig.client === SYNTHETIC_CLIENT
    || releaseConfig.slots.calculatorTop === COMPLETE_FIXTURE.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP
    || releaseConfig.slots.calculatorBottom === COMPLETE_FIXTURE.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM
  )
) {
  throw new Error('릴리스 환경에 검증용 AdSense 식별자를 사용할 수 없습니다.');
}

const syntheticIdentifiers = [
  SYNTHETIC_CLIENT,
  `pub-${SYNTHETIC_CLIENT.slice('ca-pub-'.length)}`,
  COMPLETE_FIXTURE.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP,
  COMPLETE_FIXTURE.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM,
];
const distDirectory = path.resolve(process.cwd(), 'dist');

function assertNoSyntheticIdentifier(directory: string) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    if (statSync(filePath).isDirectory()) {
      assertNoSyntheticIdentifier(filePath);
      continue;
    }
    const contents = readFileSync(filePath);
    if (syntheticIdentifiers.some((identifier) => contents.includes(identifier))) {
      throw new Error(`빌드 산출물에 검증용 AdSense 식별자가 있습니다: ${filePath}`);
    }
  }
}

if (!existsSync(distDirectory)) {
  throw new Error('AdSense 릴리스 검증 전에 프로덕션 dist 빌드가 필요합니다.');
}
assertNoSyntheticIdentifier(distDirectory);

function readClientBundleSources(directory: string): ClientBundleSource[] {
  const sources: ClientBundleSource[] = [];
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    if (statSync(filePath).isDirectory()) {
      sources.push(...readClientBundleSources(filePath));
      continue;
    }
    if (/\.(?:c|m)?js$/i.test(entry)) {
      sources.push({ filePath, contents: readFileSync(filePath, 'utf8') });
    }
  }
  return sources;
}

const clientDirectory = path.join(distDirectory, 'client');
if (!existsSync(clientDirectory)) {
  throw new Error('빌드된 Sites 클라이언트 산출물을 찾을 수 없습니다.');
}
const clientBundleSources = readClientBundleSources(clientDirectory);
if (releaseConfig.active) {
  const bakedBundle = findBakedAdsenseClientBundle(
    clientBundleSources,
    releaseEnvironment,
  );
  if (!bakedBundle) {
    throw new Error(
      [
        'AdSense 활성 설정이 브라우저 번들에 동일하게 반영되지 않았습니다.',
        '모든 NEXT_PUBLIC AdSense 값을 npm run build 전에 설정하고 같은 환경에서 다시 검증하세요.',
      ].join(' '),
    );
  }
}

const workerEntry = path.join(distDirectory, 'server', 'index.js');
if (!existsSync(workerEntry)) {
  throw new Error('빌드된 Sites 서버 엔트리를 찾을 수 없습니다.');
}

const workerModule = await import(pathToFileURL(workerEntry).href) as {
  default?: {
    fetch?: (
      request: Request,
      env: Record<string, unknown>,
      context: {
        waitUntil(promise: Promise<unknown>): void;
        passThroughOnException(): void;
      },
    ) => Promise<Response>;
  };
};
assert.equal(typeof workerModule.default?.fetch, 'function');
const executionContext = {
  waitUntil(_promise: Promise<unknown>) {},
  passThroughOnException() {},
};
const requestOrigin = releaseConfig.active
  ? releaseConfig.siteUrl.origin
  : 'https://release-check.invalid';
const fetchBuilt = (pathname: string) => workerModule.default!.fetch!(
  new Request(new URL(pathname, requestOrigin)),
  {},
  executionContext,
);

const [rootResponse, privacyResponse, adsTxtResponse] = await Promise.all([
  fetchBuilt('/'),
  fetchBuilt('/privacy'),
  fetchBuilt('/ads.txt'),
]);
assert.equal(rootResponse.status, 200);
assert.equal(privacyResponse.status, 200);
const rootHtml = await rootResponse.text();
const privacyHtml = await privacyResponse.text();
const adsTxt = await adsTxtResponse.text();

if (releaseConfig.active) {
  assert.match(
    rootHtml,
    new RegExp(
      `pagead2\\.googlesyndication\\.com/pagead/js/adsbygoogle\\.js\\?client=${releaseConfig.client}`,
    ),
  );
  assert.ok(rootHtml.includes(`google-adsense-account`));
  assert.ok(rootHtml.includes(`data-ad-client="${releaseConfig.client}"`));
  assert.ok(rootHtml.includes(`data-ad-slot="${releaseConfig.slots.calculatorTop}"`));
  assert.ok(rootHtml.includes(`data-ad-slot="${releaseConfig.slots.calculatorBottom}"`));
  assert.ok(privacyHtml.includes('현재 운영 배포에는 Google AdSense 광고'));
  assert.equal(adsTxtResponse.status, 200);
  assert.equal(
    adsTxt,
    `google.com, ${releaseConfig.publisherId}, DIRECT, f08c47fec0942fa0\n`,
  );
} else {
  assert.ok(!rootHtml.includes('pagead2.googlesyndication.com'));
  assert.ok(!rootHtml.includes('google-adsense-account'));
  assert.ok(!rootHtml.includes('data-ad-client='));
  assert.ok(privacyHtml.includes('아직 운영 환경에 구성하지 않았습니다'));
  assert.equal(adsTxtResponse.status, 404);
  assert.equal(adsTxtResponse.headers.get('cache-control'), 'no-store');
  assert.ok(!adsTxt.includes('pub-'));
}

process.stdout.write(
  `AdSense release gate: ${releaseConfig.active ? 'active' : 'fail-closed'}\n`,
);
