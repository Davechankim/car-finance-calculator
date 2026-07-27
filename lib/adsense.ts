const ADSENSE_CLIENT_PATTERN = /^ca-pub-(\d{16})$/;
const ADSENSE_SLOT_PATTERN = /^\d{10}$/;

export type AdsensePlacement = 'calculatorTop' | 'calculatorBottom';

export interface AdsenseEnvironment {
  NEXT_PUBLIC_ADSENSE_ENABLED?: string;
  NEXT_PUBLIC_ADSENSE_CONSENT_READY?: string;
  NEXT_PUBLIC_ADSENSE_POLICY_READY?: string;
  NEXT_PUBLIC_ADSENSE_AUTO_ADS?: string;
  NEXT_PUBLIC_ADSENSE_CLIENT?: string;
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP?: string;
  NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SITE_PUBLIC?: string;
}

export type AdsenseConfigurationIssue =
  | 'adsense-disabled'
  | 'consent-not-ready'
  | 'policy-not-ready'
  | 'auto-ads-not-disabled'
  | 'invalid-client'
  | 'invalid-top-slot'
  | 'invalid-bottom-slot'
  | 'duplicate-slots'
  | 'invalid-public-site-url'
  | 'site-not-public';

export type AdsenseConfig =
  | {
      active: false;
      client: null;
      publisherId: null;
      siteUrl: null;
      slots: null;
      issues: readonly AdsenseConfigurationIssue[];
    }
  | {
      active: true;
      client: string;
      publisherId: string;
      siteUrl: URL;
      slots: Readonly<Record<AdsensePlacement, string>>;
      issues: readonly [];
    };

function isExplicit(value: string | undefined, expected: 'true' | 'false') {
  return value?.trim() === expected;
}

function isPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.test')
    || normalized.endsWith('.invalid')
    || normalized.endsWith('.example')
    || !normalized.includes('.')
  ) {
    return false;
  }

  const octets = normalized.split('.').map(Number);
  if (octets.length === 4 && octets.every((octet) => Number.isInteger(octet))) {
    if (octets.some((octet) => octet < 0 || octet > 255)) return false;
    const [first, second] = octets;
    return !(
      first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || first >= 224
    );
  }

  return !normalized.includes(':');
}

export function normalizePublicSiteUrl(value: string | undefined): URL | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.port
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
      || !isPublicHostname(parsed.hostname)
    ) {
      return null;
    }
    return new URL(parsed.origin);
  } catch {
    return null;
  }
}

export function normalizeAdsenseClient(value: string | undefined): string | null {
  const candidate = value?.trim() ?? '';
  const match = ADSENSE_CLIENT_PATTERN.exec(candidate);
  if (!match || /^0+$/.test(match[1]) || new Set(match[1]).size === 1) return null;
  return candidate;
}

export function adsensePublisherId(client: string | null): string | null {
  if (!client) return null;
  const match = ADSENSE_CLIENT_PATTERN.exec(client);
  return match ? `pub-${match[1]}` : null;
}

export function normalizeAdsenseSlot(value: string | undefined): string | null {
  const candidate = value?.trim() ?? '';
  if (
    !ADSENSE_SLOT_PATTERN.test(candidate)
    || /^0+$/.test(candidate)
    || new Set(candidate).size === 1
  ) {
    return null;
  }
  return candidate;
}

export function readAdsenseEnvironment(): AdsenseEnvironment {
  return {
    NEXT_PUBLIC_ADSENSE_ENABLED: process.env.NEXT_PUBLIC_ADSENSE_ENABLED,
    NEXT_PUBLIC_ADSENSE_CONSENT_READY:
      process.env.NEXT_PUBLIC_ADSENSE_CONSENT_READY,
    NEXT_PUBLIC_ADSENSE_POLICY_READY:
      process.env.NEXT_PUBLIC_ADSENSE_POLICY_READY,
    NEXT_PUBLIC_ADSENSE_AUTO_ADS: process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS,
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP,
    NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_PUBLIC: process.env.NEXT_PUBLIC_SITE_PUBLIC,
  };
}

export function getAdsenseConfig(
  environment: AdsenseEnvironment = readAdsenseEnvironment(),
): AdsenseConfig {
  const client = normalizeAdsenseClient(environment.NEXT_PUBLIC_ADSENSE_CLIENT);
  const publisherId = adsensePublisherId(client);
  const topSlot = normalizeAdsenseSlot(
    environment.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_TOP,
  );
  const bottomSlot = normalizeAdsenseSlot(
    environment.NEXT_PUBLIC_ADSENSE_SLOT_CALCULATOR_BOTTOM,
  );
  const publicSiteUrl = normalizePublicSiteUrl(environment.NEXT_PUBLIC_SITE_URL);
  const issues: AdsenseConfigurationIssue[] = [];

  if (!isExplicit(environment.NEXT_PUBLIC_ADSENSE_ENABLED, 'true')) {
    issues.push('adsense-disabled');
  }
  if (!isExplicit(environment.NEXT_PUBLIC_ADSENSE_CONSENT_READY, 'true')) {
    issues.push('consent-not-ready');
  }
  if (!isExplicit(environment.NEXT_PUBLIC_ADSENSE_POLICY_READY, 'true')) {
    issues.push('policy-not-ready');
  }
  if (!isExplicit(environment.NEXT_PUBLIC_ADSENSE_AUTO_ADS, 'false')) {
    issues.push('auto-ads-not-disabled');
  }
  if (!client || !publisherId) issues.push('invalid-client');
  if (!topSlot) issues.push('invalid-top-slot');
  if (!bottomSlot) issues.push('invalid-bottom-slot');
  if (topSlot && bottomSlot && topSlot === bottomSlot) {
    issues.push('duplicate-slots');
  }
  if (!publicSiteUrl) issues.push('invalid-public-site-url');
  if (!isExplicit(environment.NEXT_PUBLIC_SITE_PUBLIC, 'true')) {
    issues.push('site-not-public');
  }

  if (
    issues.length > 0
    || !client
    || !publisherId
    || !topSlot
    || !bottomSlot
    || !publicSiteUrl
  ) {
    return {
      active: false,
      client: null,
      publisherId: null,
      siteUrl: null,
      slots: null,
      issues,
    };
  }

  return {
    active: true,
    client,
    publisherId,
    siteUrl: publicSiteUrl,
    slots: {
      calculatorTop: topSlot,
      calculatorBottom: bottomSlot,
    },
    issues: [],
  };
}
