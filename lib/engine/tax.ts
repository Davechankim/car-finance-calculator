// lib/engine/tax.ts — 업무용승용차 비용 인정·세금절감 (스펙 §4.5)
import { financials } from './costAt';
import { remBal } from './pmt';
import {
  CAR_COST_LIMIT_YR, CAR_DEP_LIMIT_YR, DEP_EQUIV_RATE, DEP_YEARS,
  industryRate, isExempt, marginalRate,
} from './taxData';
import type { CommonProfile, FinanceItem } from './types';

export interface DeductibleBreakdown {
  annualCost: number;      // 1대당 연비용
  depEquiv: number;        // 1대당 감가상각비(상당액)
  ratio: number;           // 업무사용비율 (분수)
  usedAmount: number;      // 업무사용금액
  depExcess: number;       // 감가 한도 초과 불인정액
  recognizedEach: number;  // 1대당 연 인정액 (업종비율 적용 후)
}

/** 한도 5단계 — 순수 파츠 버전 (손계산 대조용) */
export function deductibleFromParts(p: {
  annualCost: number; depEquiv: number; exempt: boolean;
  useDrivingLog: boolean; bizUsePct: number; industryRate: number;
}): DeductibleBreakdown {
  let ratio: number;
  if (p.exempt) ratio = 1;
  else if (p.useDrivingLog) ratio = p.bizUsePct / 100;
  else ratio = p.annualCost > 0 ? Math.min(CAR_COST_LIMIT_YR / p.annualCost, 1) : 1;

  const usedAmount = p.annualCost * ratio;
  const depExcess = p.exempt ? 0 : Math.max(p.depEquiv * ratio - CAR_DEP_LIMIT_YR, 0);
  const recognizedEach = Math.max(usedAmount - depExcess, 0) * p.industryRate;
  return { annualCost: p.annualCost, depEquiv: p.depEquiv, ratio, usedAmount, depExcess, recognizedEach };
}

/** 연이자 추정 (fin/inst): (누적납입 − 원금상환분) / 연수 (스펙 §4.5) */
export function annualInterestAt(item: FinanceItem, m: number): number {
  if (m <= 0) return 0;
  const f = financials(item);
  const yrs = m / 12;
  const repaid = f.principal - remBal(f.principal, f.r, item.months, m);
  return Math.max((f.monthly * m - repaid) / yrs, 0);
}

/** 항목 → 파츠 조립 (1대당) */
export function deductibleAt(item: FinanceItem, common: CommonProfile, m: number): DeductibleBreakdown {
  const f = financials(item);
  const ancillary = item.insuranceYr + item.maintenanceYr;
  let annualCost: number;
  let depEquiv: number;
  if (item.method === 'rent' || item.method === 'oplease') {
    annualCost = f.monthly * 12 + ancillary;
    depEquiv = f.monthly * 12 * (DEP_EQUIV_RATE[item.method] ?? 1);
  } else {
    const dep = item.vehicle.price / DEP_YEARS;
    annualCost = dep + annualInterestAt(item, m) + ancillary;
    depEquiv = dep;
  }
  return deductibleFromParts({
    annualCost, depEquiv,
    exempt: isExempt(item.vehicle.category),
    useDrivingLog: item.tax.useDrivingLog,
    bizUsePct: item.tax.bizUsePct,
    industryRate: industryRate(common),
  });
}

/** 항목 전체 세금절감 (시점 m) */
export function taxSavingAt(item: FinanceItem, common: CommonProfile, m: number): number {
  const mr = marginalRate(common);
  if (mr === 0 || m <= 0) return 0;
  const b = deductibleAt(item, common, m);
  return b.recognizedEach * (m / 12) * mr * item.vehicle.count;
}
