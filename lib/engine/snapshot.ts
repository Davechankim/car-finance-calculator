// lib/engine/snapshot.ts — 시점 m의 종합 스냅샷 (스펙 §4.6, §5 방식별 만기 처리)
import {
  effectiveMonthAt, exitOptionsAt, financials, ownershipMaturityNetOutflowEach,
  sunkAt, vatRefundCumEach,
} from './costAt';
import { deductibleAt, taxSavingAt } from './tax';
import type { CommonProfile, CostSnapshot, FinanceItem } from './types';
import { isOwnershipMethod } from './types';

export function costAt(item: FinanceItem, common: CommonProfile, mRaw: number): CostSnapshot {
  const m = effectiveMonthAt(item, mRaw);
  const ended = !isOwnershipMethod(item.method) && mRaw > item.months;
  const f = financials(item, common);
  const count = item.vehicle.count;
  const yrs = m / 12;

  const sunk = sunkAt(item, common, m);
  const { options, best, resaleEach } = exitOptionsAt(item, common, m);
  const taxSaving = taxSavingAt(item, common, m);
  const breakdown = deductibleAt(item, common, m);

  const initRefundEach = vatRefundCumEach(item, common, 0); // fin/inst 초기 환급, rent는 0
  const initialCash =
    (
      f.downEach +
      f.depositEach +
      f.cashExtraEach +
      f.acqTaxEach +
      item.upfrontFee -
      initRefundEach
    ) * count - common.tradeIn;
  const returnRate = common.assetReturnPct / 100;
  const postFinanceYears =
    isOwnershipMethod(item.method)
      ? Math.max(m - item.months, 0) / 12
      : 0;
  const maturityCashOppCost =
    ownershipMaturityNetOutflowEach(item) * count * returnRate * postFinanceYears;
  const oppCost = initialCash * returnRate * yrs + maturityCashOppCost;

  return {
    m, ended,
    monthly: f.monthly,
    financeMonthly: f.financeMonthly,
    monthlyAncillary: f.monthlyAncillary,
    principal: f.principal,
    sunk, resaleEach, resaleTotal: resaleEach * count,
    exitOptions: options, bestExit: best,
    annualDeductible: breakdown.recognizedEach,
    taxSaving, initialCash, oppCost,
    netCost: best.cost - taxSaving + oppCost,
  };
}
