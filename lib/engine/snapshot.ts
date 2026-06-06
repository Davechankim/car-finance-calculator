// lib/engine/snapshot.ts — 시점 m의 종합 스냅샷 (스펙 §4.6, §5 만기 고정)
import { exitOptionsAt, financials, sunkAt, vatRefundCumEach } from './costAt';
import { deductibleAt, taxSavingAt } from './tax';
import type { CommonProfile, CostSnapshot, FinanceItem } from './types';

export function costAt(item: FinanceItem, common: CommonProfile, mRaw: number): CostSnapshot {
  const m = Math.min(Math.max(mRaw, 0), item.months);
  const ended = mRaw > item.months;
  const f = financials(item);
  const count = item.vehicle.count;
  const yrs = m / 12;

  const sunk = sunkAt(item, common, m);
  const { options, best, resaleEach } = exitOptionsAt(item, common, m);
  const taxSaving = taxSavingAt(item, common, m);
  const breakdown = deductibleAt(item, common, m);

  const initRefundEach = vatRefundCumEach(item, common, 0); // fin/inst 초기 환급, rent는 0
  const initialCash =
    (f.downEach + f.cashExtraEach + f.acqTaxEach - initRefundEach) * count - common.tradeIn;
  const oppCost = initialCash * (common.assetReturnPct / 100) * yrs;

  return {
    m, ended,
    monthly: f.monthly, principal: f.principal,
    sunk, resaleEach, resaleTotal: resaleEach * count,
    exitOptions: options, bestExit: best,
    annualDeductible: breakdown.recognizedEach,
    taxSaving, initialCash, oppCost,
    netCost: best.cost - taxSaving + oppCost,
  };
}
