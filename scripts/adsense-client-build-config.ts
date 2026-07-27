import type { AdsenseEnvironment } from '../lib/adsense';

export const ADSENSE_CLIENT_BUILD_KEYS = [
  'NEXT_PUBLIC_ADSENSE_ENABLED',
  'NEXT_PUBLIC_ADSENSE_CONSENT_READY',
  'NEXT_PUBLIC_ADSENSE_POLICY_READY',
  'NEXT_PUBLIC_ADSENSE_AUTO_ADS',
  'NEXT_PUBLIC_ADSENSE_CLIENT',
  'NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP',
  'NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SITE_PUBLIC',
] as const satisfies readonly (keyof AdsenseEnvironment)[];

export interface ClientBundleSource {
  readonly filePath: string;
  readonly contents: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function javascriptStringLiterals(value: string): readonly string[] {
  return [
    JSON.stringify(value),
    `'${value
      .replaceAll('\\', '\\\\')
      .replaceAll("'", "\\'")
      .replaceAll('\r', '\\r')
      .replaceAll('\n', '\\n')}'`,
    `\`${value
      .replaceAll('\\', '\\\\')
      .replaceAll('`', '\\`')
      .replaceAll('${', '\\${')
      .replaceAll('\r', '\\r')
      .replaceAll('\n', '\\n')}\``,
  ];
}

function hasBakedAssignment(
  source: string,
  key: (typeof ADSENSE_CLIENT_BUILD_KEYS)[number],
  value: string,
): boolean {
  return javascriptStringLiterals(value).some((literal) => (
    new RegExp(`${escapeRegExp(key)}\\s*:\\s*${escapeRegExp(literal)}`)
      .test(source)
  ));
}

export function findBakedAdsenseClientBundle(
  sources: readonly ClientBundleSource[],
  environment: AdsenseEnvironment,
): string | null {
  const expected = ADSENSE_CLIENT_BUILD_KEYS.map((key) => {
    const value = environment[key];
    return typeof value === 'string' ? [key, value] as const : null;
  });
  if (expected.some((entry) => entry === null)) return null;

  return sources.find(({ contents }) => (
    expected.every((entry) => (
      entry !== null && hasBakedAssignment(contents, entry[0], entry[1])
    ))
  ))?.filePath ?? null;
}
