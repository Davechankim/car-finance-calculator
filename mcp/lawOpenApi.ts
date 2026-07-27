import { z } from 'zod';

export const LAW_OPEN_API_ORIGIN = 'https://www.law.go.kr';
export const LAW_OPEN_API_TIMEOUT_MS = 8_000;
export const LAW_OPEN_API_MAX_RESPONSE_BYTES = 1_048_576;
export const LAW_OPEN_API_OC_ENV = 'LAW_OPEN_API_OC';

const LAW_SEARCH_PATH = '/DRF/lawSearch.do';
const LAW_SERVICE_PATH = '/DRF/lawService.do';
const ALLOWED_ENDPOINT_PATHS = new Set([LAW_SEARCH_PATH, LAW_SERVICE_PATH]);

export const LAW_NAME_ALLOWLIST = [
  '소득세법',
  '소득세법 시행령',
  '소득세법 시행규칙',
  '법인세법',
  '법인세법 시행령',
  '법인세법 시행규칙',
  '부가가치세법',
  '부가가치세법 시행령',
  '지방세법',
  '지방세법 시행령',
  '지방세특례제한법',
  '지방세특례제한법 시행령',
  '조세특례제한법',
  '조세특례제한법 시행령',
] as const;

export type AllowedLawName = (typeof LAW_NAME_ALLOWLIST)[number];

const allowedLawNameSchema = z.enum(LAW_NAME_ALLOWLIST);
const articleInputSchema = z.string().trim().min(1).max(32);

export type LawOpenApiErrorCode =
  | 'CONFIG_MISSING'
  | 'INVALID_INPUT'
  | 'LAW_NOT_FOUND'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_REDIRECT'
  | 'UPSTREAM_STATUS'
  | 'UPSTREAM_TOO_LARGE'
  | 'UPSTREAM_INVALID_RESPONSE'
  | 'UPSTREAM_UNAVAILABLE';

export class LawOpenApiError extends Error {
  readonly code: LawOpenApiErrorCode;

  constructor(code: LawOpenApiErrorCode, message: string) {
    super(message);
    this.name = 'LawOpenApiError';
    this.code = code;
  }
}

export interface LawOpenApiEnvironment {
  readonly LAW_OPEN_API_OC?: string;
}

export interface LawOpenApiClientOptions {
  readonly fetchImpl?: typeof fetch;
  /**
   * Dependency-injected environment for tests/CI. The credential is still read
   * only from LAW_OPEN_API_OC and is never accepted as a tool argument.
   */
  readonly env?: LawOpenApiEnvironment;
}

export interface LawArticleQuery {
  readonly lawName: AllowedLawName;
  readonly article: string;
}

export type LawArticleReviewQuery = LawArticleQuery;

interface LawApiSource {
  readonly authority: '대한민국 법제처 국가법령정보센터';
  readonly endpoint: string;
  readonly target: 'eflaw' | 'lsJoHstInf';
  readonly fetchedAt: string;
}

interface OfficialArticlePayload {
  readonly untrustedSourceData: true;
  readonly lawKey: string;
  readonly basicInfo: {
    readonly lawId: string;
    readonly lawName: string;
    readonly effectiveDate: string;
    readonly promulgationDate: string;
    readonly promulgationNumber: string;
    readonly revisionType: string;
  };
  readonly article: {
    readonly number: string;
    readonly title: string;
    readonly content: string;
    readonly effectiveDate: string;
    readonly revisionType: string;
  };
}

interface OfficialChangeHistoryPayload {
  readonly untrustedSourceData: true;
  readonly target: 'lsJoHstInf';
  readonly totalCount: number;
  readonly lawId: string;
  readonly lawName: string;
  readonly entries: readonly {
    readonly id: string;
    readonly article: string;
    readonly changeReason: string;
    readonly changeDate: string;
    readonly articleLink: string;
    readonly lawMasterSequence: string;
    readonly effectiveDate: string;
    readonly promulgationDate: string;
    readonly promulgationNumber: string;
    readonly revisionType: string;
    readonly lawType: string;
    readonly ministryName: string;
    readonly ministryCode: string;
  }[];
}

export interface OfficialLawArticleResult {
  readonly lawName: AllowedLawName;
  readonly lawId: string;
  readonly lawMasterSequence: string;
  readonly effectiveDate: string;
  readonly article: string;
  readonly source: LawApiSource;
  readonly officialResponse: OfficialArticlePayload;
}

export interface LawArticleChangeHistoryResult {
  readonly lawName: AllowedLawName;
  readonly lawId: string;
  readonly lawMasterSequence: string;
  readonly effectiveDate: string;
  readonly article: string;
  readonly source: LawApiSource;
  readonly officialResponse: OfficialChangeHistoryPayload;
}

export interface LawArticleChangeReviewResult {
  readonly lawName: AllowedLawName;
  readonly lawId: string;
  readonly lawMasterSequence: string;
  readonly effectiveDate: string;
  readonly article: string;
  readonly reviewRequired: true;
  readonly automaticLegalConclusion: false;
  readonly currentArticle: {
    readonly source: LawApiSource;
    readonly officialResponse: OfficialArticlePayload;
  };
  readonly changeHistory: {
    readonly source: LawApiSource;
    readonly officialResponse: OfficialChangeHistoryPayload;
  };
}

function safeInputError(message: string): LawOpenApiError {
  return new LawOpenApiError('INVALID_INPUT', message);
}

export function parseAllowedLawName(value: unknown): AllowedLawName {
  const parsed = allowedLawNameSchema.safeParse(value);
  if (!parsed.success) {
    throw safeInputError('조회할 수 없는 법령명입니다.');
  }
  return parsed.data;
}

/**
 * Converts 제127조 / 127 / 제127조의2 into the six-digit JO format required
 * by the official API (012700 / 012702).
 */
export function normalizeLawArticle(value: unknown): string {
  const parsed = articleInputSchema.safeParse(value);
  if (!parsed.success) {
    throw safeInputError('조문 번호 형식이 올바르지 않습니다.');
  }

  const compact = parsed.data.replace(/\s+/g, '');
  const match = /^(?:제)?([1-9]\d{0,3})(?:조)?(?:의([1-9]\d?))?$/.exec(compact);
  if (!match) {
    throw safeInputError('조문 번호는 예: 127, 제127조, 제127조의2 형식이어야 합니다.');
  }

  const main = Number(match[1]);
  const branch = match[2] ? Number(match[2]) : 0;
  if (!Number.isInteger(main) || main > 9_999 || branch > 99) {
    throw safeInputError('조문 번호 범위를 벗어났습니다.');
  }

  return `${String(main).padStart(4, '0')}${String(branch).padStart(2, '0')}`;
}

function readCredential(env: LawOpenApiEnvironment): string {
  const credential = env.LAW_OPEN_API_OC?.trim();
  if (!credential) {
    throw new LawOpenApiError(
      'CONFIG_MISSING',
      `${LAW_OPEN_API_OC_ENV} 환경변수가 설정되지 않았습니다.`,
    );
  }
  if (credential.length > 512 || /[\r\n\0]/.test(credential)) {
    throw new LawOpenApiError('CONFIG_MISSING', '국가법령정보 API 인증 설정이 올바르지 않습니다.');
  }
  return credential;
}

function buildOfficialUrl(
  path: typeof LAW_SEARCH_PATH | typeof LAW_SERVICE_PATH,
  params: Readonly<Record<string, string>>,
  credential: string,
): URL {
  const url = new URL(path, LAW_OPEN_API_ORIGIN);
  url.searchParams.set('OC', credential);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  if (
    url.protocol !== 'https:'
    || url.origin !== LAW_OPEN_API_ORIGIN
    || url.username !== ''
    || url.password !== ''
    || url.port !== ''
    || !ALLOWED_ENDPOINT_PATHS.has(url.pathname)
  ) {
    throw new LawOpenApiError('INVALID_INPUT', '허용되지 않은 국가법령정보 API 요청입니다.');
  }

  return url;
}

function replaceAll(text: string, search: string, replacement: string): string {
  return search ? text.split(search).join(replacement) : text;
}

const SAFE_RESPONSE_HOSTS = new Set(['law.go.kr', 'www.law.go.kr']);

function sanitizeUpstreamText(
  text: string,
  credential: string,
  urlExpected = false,
): string {
  const absolute = /^https?:\/\//i.test(text);
  const relative = text.startsWith('/') && !text.startsWith('//');
  const networkPath = text.startsWith('//');
  if (urlExpected || absolute || relative || networkPath) {
    if (!absolute && !relative) return '[UNSAFE_URL_REMOVED]';
    const rawAuthority = absolute ? /^https?:\/\/([^/]+)/i.exec(text)?.[1] : undefined;
    if (rawAuthority && (rawAuthority.includes('@') || rawAuthority.includes(':'))) {
      return '[UNSAFE_URL_REMOVED]';
    }

    try {
      const parsed = new URL(text, LAW_OPEN_API_ORIGIN);
      if (
        !['http:', 'https:'].includes(parsed.protocol)
        || !SAFE_RESPONSE_HOSTS.has(parsed.hostname.toLowerCase())
        || parsed.username !== ''
        || parsed.password !== ''
        || parsed.port !== ''
      ) {
        return '[UNSAFE_URL_REMOVED]';
      }
      for (const key of [...parsed.searchParams.keys()]) {
        if (key.toLowerCase() === 'oc') parsed.searchParams.delete(key);
      }
      parsed.protocol = 'https:';
      const sanitizedUrl = absolute
        ? parsed.toString()
        : `${parsed.pathname}${parsed.search}${parsed.hash}`;
      let redactedUrl = replaceAll(sanitizedUrl, credential, '[REDACTED]');
      redactedUrl = replaceAll(redactedUrl, encodeURIComponent(credential), '[REDACTED]');
      return redactedUrl;
    } catch {
      return '[UNSAFE_URL_REMOVED]';
    }
  }

  let redacted = replaceAll(text, credential, '[REDACTED]');
  redacted = replaceAll(redacted, encodeURIComponent(credential), '[REDACTED]');
  return redacted.replace(/([?&]OC=)[^&#\s"']+/gi, '$1[REDACTED]');
}

function redactCredentialValue(
  value: unknown,
  credential: string,
  depth = 0,
  urlExpected = false,
): unknown {
  if (depth > 64) {
    return '[TRUNCATED]';
  }
  if (typeof value === 'string') {
    return sanitizeUpstreamText(value, credential, urlExpected);
  }
  if (typeof value === 'number' && String(value) === credential) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactCredentialValue(item, credential, depth + 1));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const safeKey = sanitizeUpstreamText(key, credential);
      const nextValue = key.toLowerCase() === 'oc'
        ? '[REDACTED]'
        : redactCredentialValue(
          child,
          credential,
          depth + 1,
          /(?:링크|url)$/i.test(key),
        );
      Object.defineProperty(output, safeKey, {
        value: nextValue,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return output;
  }
  return value;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new LawOpenApiError(
      'UPSTREAM_INVALID_RESPONSE',
      '국가법령정보 API가 JSON이 아닌 응답을 반환했습니다.',
    );
  }

  const declaredLength = response.headers.get('content-length');
  if (declaredLength) {
    const size = Number(declaredLength);
    if (Number.isFinite(size) && size > LAW_OPEN_API_MAX_RESPONSE_BYTES) {
      throw new LawOpenApiError(
        'UPSTREAM_TOO_LARGE',
        '국가법령정보 API 응답이 허용 크기를 초과했습니다.',
      );
    }
  }

  if (!response.body) {
    throw new LawOpenApiError(
      'UPSTREAM_INVALID_RESPONSE',
      '국가법령정보 API가 빈 응답을 반환했습니다.',
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > LAW_OPEN_API_MAX_RESPONSE_BYTES) {
      void reader.cancel().catch(() => undefined);
      throw new LawOpenApiError(
        'UPSTREAM_TOO_LARGE',
        '국가법령정보 API 응답이 허용 크기를 초과했습니다.',
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new LawOpenApiError(
      'UPSTREAM_INVALID_RESPONSE',
      '국가법령정보 API가 올바른 JSON을 반환하지 않았습니다.',
    );
  }
}

function normalizeOfficialLawName(value: unknown): string | null {
  const extractText = (candidate: unknown, depth: number): string | null => {
    if (depth > 8) return null;
    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate)) {
      const parts = candidate.map((item) => extractText(item, depth + 1));
      return parts.every((part) => part !== null) ? parts.join('') : null;
    }
    if (!candidate || typeof candidate !== 'object') return null;
    const record = candidate as Record<string, unknown>;
    if ('content' in record) return extractText(record.content, depth + 1);
    if ('strong' in record) return extractText(record.strong, depth + 1);
    return null;
  };

  const text = extractText(value, 0);
  return text?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || null;
}

function normalizePositiveDigits(
  value: unknown,
  maxLength: number,
  padLength = 0,
): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : '';
  if (!new RegExp(`^\\d{1,${maxLength}}$`).test(text) || /^0+$/.test(text)) return null;
  return padLength > 0 && text.length <= padLength ? text.padStart(padLength, '0') : text;
}

function normalizeCompactDate(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : '';
  if (!/^\d{8}$/.test(text)) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? text
    : null;
}

function normalizeCount(value: unknown): number | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : '';
  if (!/^\d{1,10}$/.test(text)) return null;
  const count = Number(text);
  return Number.isSafeInteger(count) ? count : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function invalidResponse(message: string): LawOpenApiError {
  return new LawOpenApiError('UPSTREAM_INVALID_RESPONSE', message);
}

interface ResolvedLawVersion {
  readonly lawId: string;
  readonly lawMasterSequence: string;
  readonly effectiveDate: string;
}

function resolveExactCurrentLaw(
  payload: unknown,
  lawName: AllowedLawName,
): ResolvedLawVersion | null {
  const outer = asRecord(payload);
  const envelope = asRecord(outer?.LawSearch);
  if (
    !envelope
    || envelope.target !== 'eflaw'
    || envelope.resultCode !== '00'
    || envelope.resultMsg !== 'success'
  ) {
    throw invalidResponse('국가법령정보 API 검색 응답의 성공 envelope가 올바르지 않습니다.');
  }

  const totalCount = normalizeCount(envelope.totalCnt);
  if (totalCount === null) {
    throw invalidResponse('국가법령정보 API 검색 건수 형식이 올바르지 않습니다.');
  }

  const rawLaws = envelope.law;
  if (totalCount === 0) {
    if (
      rawLaws !== undefined
      && rawLaws !== null
      && !(Array.isArray(rawLaws) && rawLaws.length === 0)
    ) {
      throw invalidResponse('국가법령정보 API 빈 검색 결과 구조가 올바르지 않습니다.');
    }
    return null;
  }

  const laws = Array.isArray(rawLaws) ? rawLaws : [rawLaws];
  if (
    totalCount > 100
    || laws.length !== totalCount
    || laws.some((law) => !asRecord(law))
  ) {
    throw invalidResponse('국가법령정보 API 검색 결과 목록 구조가 올바르지 않습니다.');
  }

  const exactMatches = laws
    .map((law) => asRecord(law)!)
    .filter((law) => normalizeOfficialLawName(law['법령명한글']) === lawName);

  if (exactMatches.length === 0) return null;
  if (exactMatches.length !== 1) {
    throw invalidResponse('동일한 법령명의 현행 시행본이 하나로 확정되지 않았습니다.');
  }

  const exact = exactMatches[0];
  const lawId = normalizePositiveDigits(exact['법령ID'], 10, 6);
  const lawMasterSequence = normalizePositiveDigits(exact['법령일련번호'], 12);
  const effectiveDate = normalizeCompactDate(exact['시행일자']);
  if (!lawId || !lawMasterSequence || !effectiveDate) {
    throw invalidResponse('현행 시행본의 ID, MST 또는 시행일자가 올바르지 않습니다.');
  }

  return { lawId, lawMasterSequence, effectiveDate };
}

function normalizedArticleFromOfficialValue(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : '';
  if (/^\d{6}$/.test(text)) return text;
  if (/^\d{1,4}$/.test(text) && Number(text) > 0) {
    return normalizeLawArticle(String(Number(text)));
  }
  try {
    return normalizeLawArticle(text);
  } catch {
    return null;
  }
}

function validateEffectiveLawArticle(
  payload: unknown,
  lawName: AllowedLawName,
  resolved: ResolvedLawVersion,
  article: string,
): OfficialArticlePayload {
  const outer = asRecord(payload);
  const law = asRecord(outer?.['법령']);
  const basic = asRecord(law?.['기본정보']);
  const articles = asRecord(law?.['조문']);
  const lawKey = law?.['법령키'];
  if (
    !law
    || !basic
    || !articles
    || (typeof lawKey !== 'string' && typeof lawKey !== 'number')
    || String(lawKey).trim() === ''
  ) {
    throw invalidResponse('국가법령정보 API 본문 root 또는 필수 영역이 올바르지 않습니다.');
  }

  const lawId = normalizePositiveDigits(basic['법령ID'], 10, 6);
  const effectiveDate = normalizeCompactDate(basic['시행일자']);
  const promulgationDate = normalizeCompactDate(basic['공포일자']);
  const promulgationNumber = normalizePositiveDigits(basic['공포번호'], 12);
  const revisionType = typeof basic['제개정구분'] === 'string'
    ? basic['제개정구분'].trim()
    : '';
  if (
    normalizeOfficialLawName(basic['법령명_한글']) !== lawName
    || lawId !== resolved.lawId
    || effectiveDate !== resolved.effectiveDate
    || !promulgationDate
    || !promulgationNumber
    || !revisionType
  ) {
    throw invalidResponse('국가법령정보 API 본문 기본정보가 요청한 시행본과 일치하지 않습니다.');
  }

  const rawUnits = articles['조문단위'];
  const units = Array.isArray(rawUnits) ? rawUnits : [rawUnits];
  if (units.length === 0 || units.some((unit) => !asRecord(unit))) {
    throw invalidResponse('국가법령정보 API 조문 목록 구조가 올바르지 않습니다.');
  }

  const mainArticle = String(Number(article.slice(0, 4)));
  const branchArticle = String(Number(article.slice(4, 6)));
  const matchingUnits = units.map((unit) => asRecord(unit)!).filter((unit) => {
    const unitMain = normalizeCount(unit['조문번호'])?.toString() ?? null;
    const rawBranch = unit['조문가지번호'];
    const unitBranch = rawBranch === undefined || rawBranch === null || rawBranch === ''
      ? '0'
      : normalizeCount(rawBranch)?.toString() ?? null;
    return unitMain === mainArticle && unitBranch === branchArticle;
  });
  if (matchingUnits.length !== 1) {
    throw invalidResponse('요청한 조문을 공식 본문 응답에서 하나로 확인하지 못했습니다.');
  }
  const matchingUnit = matchingUnits[0];
  const articleContent = matchingUnit['조문내용'];
  const articleTitle = matchingUnit['조문제목'];
  const articleEffectiveDate = normalizeCompactDate(matchingUnit['조문시행일자']);
  const articleRevisionType = matchingUnit['조문제개정유형'];
  if (
    typeof articleContent !== 'string'
    || articleContent.trim() === ''
    || typeof articleTitle !== 'string'
    || !articleEffectiveDate
    || typeof articleRevisionType !== 'string'
    || articleRevisionType.trim() === ''
  ) {
    throw invalidResponse('공식 조문 응답의 필수 필드가 누락되었습니다.');
  }

  return {
    untrustedSourceData: true,
    lawKey: String(lawKey).trim(),
    basicInfo: {
      lawId,
      lawName,
      effectiveDate,
      promulgationDate,
      promulgationNumber,
      revisionType,
    },
    article: {
      number: article,
      title: articleTitle.trim(),
      content: articleContent.trim(),
      effectiveDate: articleEffectiveDate,
      revisionType: articleRevisionType.trim(),
    },
  };
}

function validateChangeHistory(
  payload: unknown,
  lawName: AllowedLawName,
  resolved: ResolvedLawVersion,
  article: string,
): OfficialChangeHistoryPayload {
  const outer = asRecord(payload);
  const service = asRecord(outer?.LawService);
  if (
    !service
    || service.target !== 'lsJoHstInf'
    || normalizePositiveDigits(service['법령ID'], 10, 6) !== resolved.lawId
    || normalizeOfficialLawName(service['법령명한글']) !== lawName
  ) {
    throw invalidResponse('국가법령정보 API 변경 이력 root가 요청과 일치하지 않습니다.');
  }

  const totalCount = normalizeCount(service.totalCnt);
  if (totalCount === null) {
    throw invalidResponse('국가법령정보 API 변경 이력 건수 형식이 올바르지 않습니다.');
  }
  const rawHistory = service.law;
  if (totalCount === 0) {
    if (
      rawHistory !== undefined
      && rawHistory !== null
      && !(Array.isArray(rawHistory) && rawHistory.length === 0)
    ) {
      throw invalidResponse('국가법령정보 API 빈 변경 이력 구조가 올바르지 않습니다.');
    }
    return {
      untrustedSourceData: true,
      target: 'lsJoHstInf',
      totalCount: 0,
      lawId: resolved.lawId,
      lawName,
      entries: [],
    };
  }
  const history = Array.isArray(rawHistory) ? rawHistory : [rawHistory];
  if (
    totalCount > 100
    || history.length !== totalCount
    || history.some((entry) => !asRecord(entry))
  ) {
    throw invalidResponse('국가법령정보 API 변경 이력 목록 구조가 올바르지 않습니다.');
  }

  const entries: OfficialChangeHistoryPayload['entries'][number][] = [];
  for (const entryValue of history) {
    const entry = asRecord(entryValue);
    const articleInfo = asRecord(entry?.['조문정보']);
    const lawInfo = asRecord(entry?.['법령정보']);
    if (!entry || !articleInfo || !lawInfo) {
      throw invalidResponse('국가법령정보 API 변경 이력 항목 구조가 올바르지 않습니다.');
    }
    const id = normalizePositiveDigits(entry.id, 10);
    const officialArticle = normalizedArticleFromOfficialValue(articleInfo['조문번호']);
    const changeReason = typeof articleInfo['변경사유'] === 'string'
      ? articleInfo['변경사유'].trim()
      : '';
    const changeDate = normalizeCompactDate(articleInfo['조문변경일']);
    const articleLink = typeof articleInfo['조문링크'] === 'string'
      ? articleInfo['조문링크'].trim()
      : '';
    const lawMasterSequence = normalizePositiveDigits(lawInfo['법령일련번호'], 12);
    const effectiveDate = normalizeCompactDate(lawInfo['시행일자']);
    const promulgationDate = normalizeCompactDate(lawInfo['공포일자']);
    const promulgationNumber = normalizePositiveDigits(lawInfo['공포번호'], 12);
    const revisionType = typeof lawInfo['제개정구분명'] === 'string'
      ? lawInfo['제개정구분명'].trim()
      : '';
    const lawType = typeof lawInfo['법령구분명'] === 'string'
      ? lawInfo['법령구분명'].trim()
      : '';
    const ministryName = typeof lawInfo['소관부처명'] === 'string'
      ? lawInfo['소관부처명'].trim()
      : '';
    const ministryCode = normalizePositiveDigits(lawInfo['소관부처코드'], 12);
    if (
      !id
      || officialArticle !== article
      || !changeReason
      || !changeDate
      || !articleLink
      || !lawMasterSequence
      || !effectiveDate
      || !promulgationDate
      || !promulgationNumber
      || !revisionType
      || !lawType
      || !ministryName
      || !ministryCode
    ) {
      throw invalidResponse('국가법령정보 API 변경 이력 필드가 올바르지 않습니다.');
    }
    entries.push({
      id,
      article: officialArticle,
      changeReason,
      changeDate,
      articleLink,
      lawMasterSequence,
      effectiveDate,
      promulgationDate,
      promulgationNumber,
      revisionType,
      lawType,
      ministryName,
      ministryCode,
    });
  }

  return {
    untrustedSourceData: true,
    target: 'lsJoHstInf',
    totalCount,
    lawId: resolved.lawId,
    lawName,
    entries,
  };
}

function sourceFor(target: LawApiSource['target']): LawApiSource {
  return {
    authority: '대한민국 법제처 국가법령정보센터',
    endpoint: `${LAW_OPEN_API_ORIGIN}${LAW_SERVICE_PATH}`,
    target,
    fetchedAt: new Date().toISOString(),
  };
}

export class LawOpenApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly env: LawOpenApiEnvironment;

  constructor(options: LawOpenApiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.env = options.env ?? {
      LAW_OPEN_API_OC: process.env[LAW_OPEN_API_OC_ENV],
    };
  }

  private async requestJson(
    path: typeof LAW_SEARCH_PATH | typeof LAW_SERVICE_PATH,
    params: Readonly<Record<string, string>>,
    credential: string,
  ): Promise<unknown> {
    const url = buildOfficialUrl(path, params, credential);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LAW_OPEN_API_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });

      if (response.redirected || (response.status >= 300 && response.status < 400)) {
        throw new LawOpenApiError(
          'UPSTREAM_REDIRECT',
          '국가법령정보 API 리디렉션을 차단했습니다.',
        );
      }
      if (!response.ok) {
        throw new LawOpenApiError(
          'UPSTREAM_STATUS',
          `국가법령정보 API가 오류 상태(${response.status})를 반환했습니다.`,
        );
      }

      return await readBoundedJson(response);
    } catch (error) {
      if (error instanceof LawOpenApiError) throw error;
      if (controller.signal.aborted) {
        throw new LawOpenApiError(
          'UPSTREAM_TIMEOUT',
          `국가법령정보 API 요청이 ${LAW_OPEN_API_TIMEOUT_MS}ms 제한을 초과했습니다.`,
        );
      }
      throw new LawOpenApiError(
        'UPSTREAM_UNAVAILABLE',
        '국가법령정보 API 요청에 실패했습니다.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveCurrentLaw(
    lawName: AllowedLawName,
    credential: string,
  ): Promise<ResolvedLawVersion> {
    const searchResponse = await this.requestJson(
      LAW_SEARCH_PATH,
      {
        target: 'eflaw',
        type: 'JSON',
        search: '1',
        query: lawName,
        nw: '3',
        display: '100',
        page: '1',
      },
      credential,
    );
    const resolved = resolveExactCurrentLaw(searchResponse, lawName);
    if (!resolved) {
      throw new LawOpenApiError(
        'LAW_NOT_FOUND',
        '국가법령정보 API에서 정확히 일치하는 현행 시행본을 찾지 못했습니다.',
      );
    }
    return resolved;
  }

  async getLawArticle(query: LawArticleQuery): Promise<OfficialLawArticleResult> {
    const lawName = parseAllowedLawName(query.lawName);
    const article = normalizeLawArticle(query.article);
    const credential = readCredential(this.env);
    const resolved = await this.resolveCurrentLaw(lawName, credential);
    const rawOfficialResponse = await this.requestJson(
      LAW_SERVICE_PATH,
      {
        target: 'eflaw',
        type: 'JSON',
        MST: resolved.lawMasterSequence,
        efYd: resolved.effectiveDate,
        JO: article,
      },
      credential,
    );
    const officialResponse = validateEffectiveLawArticle(
      rawOfficialResponse,
      lawName,
      resolved,
      article,
    );

    return {
      lawName,
      ...resolved,
      article,
      source: sourceFor('eflaw'),
      officialResponse: redactCredentialValue(
        officialResponse,
        credential,
      ) as OfficialArticlePayload,
    };
  }

  async getLawArticleChangeHistory(
    query: LawArticleQuery,
  ): Promise<LawArticleChangeHistoryResult> {
    const lawName = parseAllowedLawName(query.lawName);
    const article = normalizeLawArticle(query.article);
    const credential = readCredential(this.env);
    const resolved = await this.resolveCurrentLaw(lawName, credential);
    const rawOfficialResponse = await this.requestJson(
      LAW_SERVICE_PATH,
      {
        target: 'lsJoHstInf',
        type: 'JSON',
        ID: resolved.lawId,
        JO: article,
        display: '100',
        page: '1',
      },
      credential,
    );
    const officialResponse = validateChangeHistory(
      rawOfficialResponse,
      lawName,
      resolved,
      article,
    );

    return {
      lawName,
      ...resolved,
      article,
      source: sourceFor('lsJoHstInf'),
      officialResponse: redactCredentialValue(
        officialResponse,
        credential,
      ) as OfficialChangeHistoryPayload,
    };
  }

  async reviewLawArticleChanges(
    query: LawArticleReviewQuery,
  ): Promise<LawArticleChangeReviewResult> {
    const lawName = parseAllowedLawName(query.lawName);
    const article = normalizeLawArticle(query.article);
    const credential = readCredential(this.env);
    const resolved = await this.resolveCurrentLaw(lawName, credential);

    const [rawCurrentArticle, rawChangeHistory] = await Promise.all([
      this.requestJson(
        LAW_SERVICE_PATH,
        {
          target: 'eflaw',
          type: 'JSON',
          MST: resolved.lawMasterSequence,
          efYd: resolved.effectiveDate,
          JO: article,
        },
        credential,
      ),
      this.requestJson(
        LAW_SERVICE_PATH,
        {
          target: 'lsJoHstInf',
          type: 'JSON',
          ID: resolved.lawId,
          JO: article,
          display: '100',
          page: '1',
        },
        credential,
      ),
    ]);
    const currentArticle = validateEffectiveLawArticle(
      rawCurrentArticle,
      lawName,
      resolved,
      article,
    );
    const changeHistory = validateChangeHistory(
      rawChangeHistory,
      lawName,
      resolved,
      article,
    );

    return {
      lawName,
      ...resolved,
      article,
      reviewRequired: true,
      automaticLegalConclusion: false,
      currentArticle: {
        source: sourceFor('eflaw'),
        officialResponse: redactCredentialValue(
          currentArticle,
          credential,
        ) as OfficialArticlePayload,
      },
      changeHistory: {
        source: sourceFor('lsJoHstInf'),
        officialResponse: redactCredentialValue(
          changeHistory,
          credential,
        ) as OfficialChangeHistoryPayload,
      },
    };
  }
}

export function publicLawOpenApiErrorMessage(error: unknown): string {
  if (error instanceof LawOpenApiError) return error.message;
  return '국가법령정보 조회 중 안전하게 처리할 수 없는 오류가 발생했습니다.';
}
