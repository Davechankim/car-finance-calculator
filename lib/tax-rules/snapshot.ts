import { z } from 'zod';

import rawSnapshot from '../../tax-rules/approved/KR/2026.json';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}, '유효한 ISO 날짜여야 합니다.');

const categoryNumberSchema = z.object({
  passenger: z.number().nonnegative(),
  compact: z.number().nonnegative(),
  van9: z.number().nonnegative(),
  van11: z.number().nonnegative(),
  truck: z.number().nonnegative(),
  commercial: z.number().nonnegative(),
}).strict();

const categoryBooleanSchema = z.object({
  passenger: z.boolean(),
  compact: z.boolean(),
  van9: z.boolean(),
  van11: z.boolean(),
  truck: z.boolean(),
  commercial: z.boolean(),
}).strict();

export const PROVENANCE_SCOPE_VALUES = [
  'businessPassengerCar.annualCostLimitWon',
  'businessPassengerCar.annualDepreciationLimitWon',
  'businessPassengerCar.smallRealEstateCorpAnnualCostLimitWon',
  'businessPassengerCar.smallRealEstateCorpAnnualDepreciationLimitWon',
  'vat.includedTaxNumerator',
  'vat.includedPriceDenominator',
  'vat.inputCreditRequiresGeneralTaxpayer',
  'vat.inputCreditRequiresQualifiedEvidence',
  'vat.resaleOutputVatAppliesToGeneralTaxableBusinessAsset',
  'vat.resaleOutputVatUsesGeneralRateWhenMixedOrUncertain',
  'vat.simplifiedResaleOutputVatValueAddedRateByIndustry',
  'depreciation.years',
  'depreciation.equivalentRateByMethod.rent',
  'depreciation.operatingLeaseUnknownMaintenanceRate',
  'compactAcquisitionTaxRelief.amountWon',
  'compactAcquisitionTaxRelief.effectiveThrough',
  'acquisitionTaxDefaultPct',
  'businessPassengerCostLimitExemptByCategory',
  'vatInputCreditEligibleByCategory',
  'estimatedMarginalRateByRevenueBand.personal',
  'estimatedMarginalRateByRevenueBand.corp',
] as const;

const provenanceScopeSchema = z.enum(PROVENANCE_SCOPE_VALUES);

export const TaxRuleSnapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  id: z.literal('KR-2026-car-finance'),
  jurisdiction: z.literal('KR'),
  year: z.literal(2026),
  status: z.literal('approved'),
  effectiveFrom: isoDateSchema,
  effectiveThrough: isoDateSchema,
  approvedAt: z.string().datetime({ offset: true }),
  approvedBy: z.string().min(1),
  sourceUrl: z.string().url().startsWith('https://'),
  rules: z.object({
    businessPassengerCar: z.object({
      annualCostLimitWon: z.number().int().nonnegative(),
      annualDepreciationLimitWon: z.number().int().nonnegative(),
      smallRealEstateCorpAnnualCostLimitWon: z.number().int().nonnegative(),
      smallRealEstateCorpAnnualDepreciationLimitWon: z.number().int().nonnegative(),
    }).strict(),
    vat: z.object({
      includedTaxNumerator: z.number().int().positive(),
      includedPriceDenominator: z.number().int().positive(),
      inputCreditRequiresGeneralTaxpayer: z.literal(true),
      inputCreditRequiresQualifiedEvidence: z.literal(true),
      resaleOutputVatAppliesToGeneralTaxableBusinessAsset: z.literal(true),
      resaleOutputVatUsesGeneralRateWhenMixedOrUncertain: z.literal(true),
      simplifiedResaleOutputVatValueAddedRateByIndustry: z.object({
        service: z.number().min(0).max(1),
        retail: z.number().min(0).max(1),
        manufacturing: z.number().min(0).max(1),
        foodOrLodging: z.number().min(0).max(1),
        transport: z.number().min(0).max(1),
        realEstateRental: z.number().min(0).max(1),
      }).strict(),
    }).strict(),
    depreciation: z.object({
      years: z.number().int().positive(),
      equivalentRateByMethod: z.object({
        rent: z.number().min(0).max(1),
      }).strict(),
      operatingLeaseUnknownMaintenanceRate: z.number().min(0).max(1),
    }).strict(),
    compactAcquisitionTaxRelief: z.object({
      amountWon: z.number().int().nonnegative(),
      effectiveThrough: isoDateSchema,
    }).strict(),
    acquisitionTaxDefaultPct: categoryNumberSchema,
    businessPassengerCostLimitExemptByCategory: categoryBooleanSchema,
    vatInputCreditEligibleByCategory: categoryBooleanSchema,
    estimatedMarginalRateByRevenueBand: z.object({
      personal: z.array(z.number().min(0).max(1)).length(7),
      corp: z.array(z.number().min(0).max(1)).length(7),
    }).strict(),
  }).strict(),
  provenance: z.array(z.object({
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    authority: z.string().min(1),
    sourceUrl: z.string().url().startsWith('https://'),
    retrievedAt: isoDateSchema,
    scope: z.array(provenanceScopeSchema).min(1),
    basis: z.enum(['direct', 'derived', 'heuristic']),
    verification: z.literal('source-citation-cross-check'),
  }).strict()).min(1),
  notes: z.array(z.string().min(1)).min(1),
}).strict().superRefine((snapshot, context) => {
  if (snapshot.effectiveFrom > snapshot.effectiveThrough) {
    context.addIssue({
      code: 'custom',
      path: ['effectiveThrough'],
      message: '적용 종료일은 시작일보다 빠를 수 없습니다.',
    });
  }
  const sourceIds = new Set<string>();
  const coveredScopes = new Set<string>();
  for (const [index, source] of snapshot.provenance.entries()) {
    if (sourceIds.has(source.sourceId)) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', index, 'sourceId'],
        message: 'provenance sourceId는 중복될 수 없습니다.',
      });
    }
    sourceIds.add(source.sourceId);
    source.scope.forEach((scope) => coveredScopes.add(scope));
  }
  for (const requiredScope of PROVENANCE_SCOPE_VALUES) {
    if (!coveredScopes.has(requiredScope)) {
      context.addIssue({
        code: 'custom',
        path: ['provenance'],
        message: `필수 계산 규칙의 출처 범위가 없습니다: ${requiredScope}`,
      });
    }
  }
});

export type TaxRuleSnapshot = z.infer<typeof TaxRuleSnapshotSchema>;

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

const parsedSnapshot = TaxRuleSnapshotSchema.parse(rawSnapshot);

export const APPROVED_TAX_RULE_SNAPSHOT = deepFreeze(parsedSnapshot);
export const APPROVED_TAX_RULE_ID = APPROVED_TAX_RULE_SNAPSHOT.id;

export class TaxRuleSnapshotLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxRuleSnapshotLookupError';
  }
}

export function getApprovedTaxRuleSnapshot(
  ruleSetId: unknown,
  asOfDate?: unknown,
): typeof APPROVED_TAX_RULE_SNAPSHOT {
  if (ruleSetId !== APPROVED_TAX_RULE_ID) {
    throw new TaxRuleSnapshotLookupError('승인된 세금 규칙 스냅샷을 찾지 못했습니다.');
  }

  if (asOfDate !== undefined) {
    const parsedDate = isoDateSchema.safeParse(asOfDate);
    if (!parsedDate.success) {
      throw new TaxRuleSnapshotLookupError('조회 기준일은 유효한 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (
      parsedDate.data < APPROVED_TAX_RULE_SNAPSHOT.effectiveFrom
      || parsedDate.data > APPROVED_TAX_RULE_SNAPSHOT.effectiveThrough
    ) {
      throw new TaxRuleSnapshotLookupError('조회 기준일에 적용되는 승인 스냅샷이 없습니다.');
    }
  }

  return APPROVED_TAX_RULE_SNAPSHOT;
}
