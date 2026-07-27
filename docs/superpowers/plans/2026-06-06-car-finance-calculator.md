# 자동차 금융 비교 계산기 v3 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장기렌트·운용리스·금융리스·할부를 자유 조합(N항목×다대수)으로 비교하는 Next.js 웹 계산기 + 검증된 순수 계산 엔진.

**Architecture:** 순수 TypeScript 계산 엔진(`lib/engine/`)을 Vitest TDD로 먼저 구축하고, React UI(`app/`, `components/`)는 엔진 완성 후 조립한다. 상태는 `useReducer` 단일 스토어, 결과는 `useMemo(compareAll(state))`로 파생. 서버 통신 없음.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Vitest · recharts · Pretendard(CDN) · Vercel

**스펙:** `docs/superpowers/specs/2026-06-06-car-finance-calculator-design.md` (이하 "스펙 §N"으로 인용)

**프로젝트 루트:** 저장소 최상위 디렉터리 — 모든 경로는 루트 기준, 모든 명령은 루트에서 실행.

**금액 단위 규약:** 엔진 내부는 전부 **원(won) 단위 number**. 퍼센트는 `5.9` 같은 % 숫자(분수 아님). 세율만 예외적으로 분수(`0.15`)를 쓰며 변수명에 `Rate`를 붙인다.

---

## 파일 구조 (전체 지도)

```
package.json / tsconfig.json / next.config.mjs / vitest.config.ts
app/
  layout.tsx              한국어 메타·Pretendard CDN
  globals.css             전체 스타일 (CSS 클래스, 반응형)
  page.tsx                대시보드 조립 (Task 15)
lib/
  engine/                 ★ 순수 함수만 — React import 금지
    types.ts              도메인 타입 (스펙 §3)
    taxData.ts            세율·한도·분류·업종 상수 (스펙 §4.7)
    pmt.ts                PMT·remBal (스펙 §4.1)
    resale.ts             감가 시세 (스펙 §4.4)
    costAt.ts             항목 1개의 시점 m 스냅샷 (스펙 §4.2~4.6)
    tax.ts                비용 인정액·세금절감 (스펙 §4.5)
    compare.ts            그리드·최적 탐색·시나리오 (스펙 §5)
    __tests__/
      fixtures.ts         손계산용 기준 입력
      pmt.test.ts / resale.test.ts / costAt.test.ts
      exit.test.ts / tax.test.ts / compare.test.ts
  state/
    defaults.ts           방식별 신규 항목 기본값 (스펙 §6.3)
    reducer.ts            상태 액션 (스펙 §6.2)
    __tests__/reducer.test.ts
  format.ts               원/만원/% 포맷터 + __tests__/format.test.ts
components/
  ui/Field.tsx            MoneyInput·PctOrAmountInput·Chip·Slider·WarnBadge
  builder/CommonSettingsCard.tsx
  builder/ItemCard.tsx / builder/ItemList.tsx
  results/ResultTabs.tsx / SummaryTab.tsx / TimelineTab.tsx
  results/ScenarioTab.tsx / TaxTab.tsx / DetailTab.tsx
docs/
  verification-report.md  검증 보고서 (Task 17)
README.md                 사용·배포 가이드 (Task 16)
```

UI 컴포넌트는 빌드 성공 + 수동 스모크 체크리스트(Task 16)로 검증한다. 단위 테스트는 순수 로직(엔진·리듀서·포맷터)에 집중 — 정확성이 사는 곳이 엔진이기 때문 (스펙 §7).

---

### Task 1: 프로젝트 스캐폴드

비어 있지 않은 디렉터리(docs/, .git 존재)라 `create-next-app`이 거부하므로 **수동 스캐폴드**한다.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (placeholder)

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "car-finance-calculator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.mjs / vitest.config.ts 작성**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
});
```

- [ ] **Step 4: app 셸 작성**

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '자동차 금융 비교 계산기',
  description: '장기렌트·운용리스·금융리스·할부를 자유 조합으로 비교',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

`app/globals.css` (베이스만 — 컴포넌트 클래스는 Task 12~15에서 추가):
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f4f6f9; --card: #ffffff; --line: #e3e8ef;
  --text: #1a202c; --sub: #64748b; --accent: #2563eb;
  --good: #059669; --warn: #d97706; --bad: #dc2626;
}
body {
  font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
  background: var(--bg); color: var(--text); font-size: 14px;
}
```

`app/page.tsx` (Task 15에서 교체):
```tsx
export default function Page() {
  return <main style={{ padding: 24 }}>자동차 금융 비교 계산기 — 준비 중</main>;
}
```

- [ ] **Step 5: 설치 및 빌드·테스트 러너 확인**

Run: `npm install`
Expected: 에러 없이 완료 (peer-dep 경고는 무시 가능)

Run: `npm run build`
Expected: `✓ Compiled successfully`, `next-env.d.ts` 자동 생성됨

Run: `npx vitest run`
Expected: `No test files found` — 정상 (아직 테스트 없음). exit code가 1이면 이 단계에서는 무시.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Next.js 15 + Vitest 수동 스캐폴드"
```

---

### Task 2: 도메인 타입 + 세율 데이터

**Files:**
- Create: `lib/engine/types.ts`, `lib/engine/taxData.ts`
- Test: `lib/engine/__tests__/taxData.test.ts`

스펙 §3·§4.7 구현. **스펙 정밀화 1건**: `category`를 이진(passenger/exempt)이 아닌 5종으로 — 취득세 기본값(승용·승합 7 / 화물 5 / 경차·영업용 4)이 분류별로 달라서다. 한도·부가세 로직은 `exempt` boolean으로 동작 (스펙 §4.7과 일관).

- [ ] **Step 1: types.ts 작성**

```ts
// lib/engine/types.ts — 도메인 타입 (스펙 §3). 엔진 전역에서 금액=원, 퍼센트=% 숫자.
export type Method = 'rent' | 'oplease' | 'finlease' | 'installment';
export type BizType = 'none' | 'personal' | 'corp';
export type VehicleCategory = 'passenger' | 'compact' | 'van9' | 'truck' | 'commercial';

export interface ModeValue { mode: 'pct' | 'amount'; value: number }
export interface Scenario { atMonths: number; label: string }

export interface CommonProfile {
  biz: BizType;
  industryIndex: number;
  revenueIndex: number;
  marginalRateOverride: number | null; // % 숫자. null이면 매핑 사용
  assetReturnPct: number;
  tradeIn: number;                     // 보상판매 — 항목당 1회 현금 차감
  scenarios: Scenario[];
}

export interface Vehicle {
  name: string;
  price: number;        // 1대 가격, 부가세 포함 소비자가
  isUsed: boolean;      // 메타데이터 — 계산 영향 없음 (스펙 §6.5)
  count: number;        // 대수 ≥ 1
  category: VehicleCategory;
}

export interface TaxOptions { useDrivingLog: boolean; bizUsePct: number }

export interface Depreciation {
  depRatePct: number;   // 연 감가율
  floorPct: number;     // 최저 잔존비율
  resaleOverrides: { atMonths: number; price: number }[]; // 1대당 시세 직접입력
}

export interface ExitTerms {
  canTransfer: boolean;
  transferFee: number;
  penaltyPct: number;     // 잔여 납입금 대비 위약금 %
  returnInspFee: number;
  mileagePenalty: number;
  earlyDiscount: number;  // 조기인수할인(oplease) / 조기정산·중도상환 감면(finlease/installment)
}

export interface FinanceItem {
  id: string;
  label?: string;
  method: Method;
  vehicle: Vehicle;
  months: number;
  ratePct: number;
  down: ModeValue;                // 1대당 선납금
  residual: ModeValue | null;     // oplease/finlease만
  loanAmount: number | null;      // installment만
  insuranceYr: number;            // 1대당 연 보험료
  maintenanceYr: number;          // 1대당 연 정비비
  subsidy: number;                // 1대당 지원금
  acqTaxRatePct: number;
  tax: TaxOptions;
  depreciation: Depreciation;
  exit: ExitTerms;
}

export interface ComparisonState { common: CommonProfile; items: FinanceItem[] }

export type ExitKind = 'terminate' | 'transfer' | 'buyoutSell' | 'settleSell' | 'return';
export interface ExitOption { kind: ExitKind; label: string; cost: number }

export interface CostSnapshot {
  m: number;
  ended: boolean;          // m이 계약기간을 넘어 만기 값으로 고정됨
  monthly: number;         // 1대당 월납입금
  principal: number;       // 1대당 금융 원금
  sunk: number;            // 항목 전체 누적지출 (×count, tradeIn·부가세환급 반영)
  resaleEach: number;
  resaleTotal: number;
  exitOptions: ExitOption[];
  bestExit: ExitOption;
  annualDeductible: number; // 1대당 연 인정액 (업종비율 적용 후)
  taxSaving: number;        // 항목 전체
  initialCash: number;      // 항목 전체 초기 현금 지출
  oppCost: number;
  netCost: number;          // 실질순비용 = bestExit.cost − taxSaving + oppCost
}

export function resolveAmount(mv: ModeValue | null, base: number): number {
  if (!mv) return 0;
  return mv.mode === 'pct' ? Math.round(base * (mv.value / 100)) : mv.value;
}
```

- [ ] **Step 2: taxData.ts 작성**

```ts
// lib/engine/taxData.ts — 세율·한도 상수 (스펙 §4.7, 2024~2025 세법 기준)
import type { BizType, CommonProfile, Method, VehicleCategory } from './types';

export const CAR_COST_LIMIT_YR = 15_000_000; // 업무용승용차 연 비용 한도 (대당)
export const CAR_DEP_LIMIT_YR = 8_000_000;   // 감가상각비(상당액) 연 한도 (대당)
export const VAT_FRACTION = 10 / 110;        // 부가세 포함가 → 부가세액
export const DEP_YEARS = 5;                  // 감가상각 내용연수 (정액)
export const DEP_EQUIV_RATE: Partial<Record<Method, number>> = {
  rent: 0.7,    // 렌트료 중 감가상각비 상당액 비율 (시행규칙)
  oplease: 0.93, // 리스료 중 (보험·세금·정비 차감 근사)
};

export interface CategoryMeta {
  key: VehicleCategory; label: string; acqTaxDefaultPct: number; exempt: boolean;
}
export const CATEGORIES: CategoryMeta[] = [
  { key: 'passenger',  label: '승용차 (한도 적용)',   acqTaxDefaultPct: 7, exempt: false },
  { key: 'compact',    label: '경차',                acqTaxDefaultPct: 4, exempt: true },
  { key: 'van9',       label: '9인승 이상 승합',      acqTaxDefaultPct: 7, exempt: true },
  { key: 'truck',      label: '화물·밴',             acqTaxDefaultPct: 5, exempt: true },
  { key: 'commercial', label: '영업용',              acqTaxDefaultPct: 4, exempt: true },
];
export const categoryMeta = (c: VehicleCategory): CategoryMeta =>
  CATEGORIES.find((x) => x.key === c)!;
export const isExempt = (c: VehicleCategory): boolean => categoryMeta(c).exempt;

export const INDUSTRIES = [
  { label: '서비스업', deductRate: 1 },
  { label: '도소매업', deductRate: 1 },
  { label: '제조업', deductRate: 1 },
  { label: '음식·숙박업', deductRate: 1 },
  { label: '운수업', deductRate: 1 },
  { label: '부동산임대업', deductRate: 0.5 },
];

export const REVENUE_LABELS = ['~3천만', '3~5천만', '5~8천만', '8천만~1.5억', '1.5~3억', '3~5억', '5억~'];
// 매출 → 추정 한계세율 (분수). 매출≠과세표준이므로 보수적 휴리스틱 (스펙 §4.7)
const MARGINAL_MAP: Record<Exclude<BizType, 'none'>, number[]> = {
  personal: [0.06, 0.15, 0.15, 0.24, 0.35, 0.38, 0.40],
  corp:     [0.09, 0.09, 0.09, 0.09, 0.09, 0.19, 0.19],
};

/** 한계세율 (분수). 비사업자 0, 직접입력 우선. */
export function marginalRate(common: CommonProfile): number {
  if (common.biz === 'none') return 0;
  if (common.marginalRateOverride != null) return common.marginalRateOverride / 100;
  return MARGINAL_MAP[common.biz][common.revenueIndex] ?? 0;
}

/** 업종 비용인정비율 (분수) */
export function industryRate(common: CommonProfile): number {
  return INDUSTRIES[common.industryIndex]?.deductRate ?? 1;
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`lib/engine/__tests__/taxData.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, industryRate, isExempt, marginalRate } from '../taxData';
import type { CommonProfile } from '../types';

const common = (over: Partial<CommonProfile>): CommonProfile => ({
  biz: 'personal', industryIndex: 0, revenueIndex: 2,
  marginalRateOverride: null, assetReturnPct: 5, tradeIn: 0, scenarios: [],
  ...over,
});

describe('taxData', () => {
  it('비사업자는 한계세율 0', () => {
    expect(marginalRate(common({ biz: 'none' }))).toBe(0);
  });
  it('개인 5~8천만 구간 → 15%', () => {
    expect(marginalRate(common({ biz: 'personal', revenueIndex: 2 }))).toBe(0.15);
  });
  it('법인 5억~ 구간 → 19%', () => {
    expect(marginalRate(common({ biz: 'corp', revenueIndex: 6 }))).toBe(0.19);
  });
  it('직접입력이 매핑보다 우선', () => {
    expect(marginalRate(common({ marginalRateOverride: 38 }))).toBe(0.38);
  });
  it('부동산임대업 비용인정 50%', () => {
    expect(industryRate(common({ industryIndex: 5 }))).toBe(0.5);
  });
  it('분류: 승용차만 한도 적용, 취득세 기본값 7/4/7/5/4', () => {
    expect(isExempt('passenger')).toBe(false);
    expect(isExempt('truck')).toBe(true);
    expect(CATEGORIES.map((c) => c.acqTaxDefaultPct)).toEqual([7, 4, 7, 5, 4]);
  });
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run lib/engine/__tests__/taxData.test.ts`
Expected: 6 passed (타입+데이터를 같이 작성했으므로 이 Task는 RED 단계 없음 — 상수 정의라 TDD 예외)

- [ ] **Step 5: Commit**

```bash
git add lib/engine
git commit -m "feat(engine): 도메인 타입 + 세율 데이터 (스펙 §3, §4.7)"
```

---

### Task 3: 금융 수학 — PMT·remBal

**Files:**
- Create: `lib/engine/pmt.ts`
- Test: `lib/engine/__tests__/pmt.test.ts`

> ⚠️ **v2 문서 오류 발견 예정**: v2 정리 문서 테스트 케이스 A는 "≈ 939,929원"이라 했으나 정확한 손계산 값은 **939,401.5원**이다.
> 검산: (1.005)^48 = 1.2704896, 연금현가계수 a = (1−1/1.2704896)/0.005 = 42.580316, PMT = 40,000,000/42.580316 = 939,401.5.
> 테스트는 정확값으로 작성하고, Task 17 검증 보고서에 v2 오류로 기록한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/engine/__tests__/pmt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { monthlyRate, pmt, remBal } from '../pmt';

describe('pmt (스펙 §4.1)', () => {
  it('케이스 A: 4,000만/연6%/48개월 → 월 939,401.5원 (v2 문서 939,929는 오기)', () => {
    const r = monthlyRate(6); // 0.005
    expect(Math.abs(pmt(40_000_000, r, 48) - 939_401.5)).toBeLessThan(1);
  });
  it('금리 0% → 단순 분할', () => {
    expect(pmt(48_000_000, 0, 48)).toBe(1_000_000);
  });
  it('원금 0 → 월납 0', () => {
    expect(pmt(0, 0.005, 48)).toBe(0);
  });
});

describe('remBal (스펙 §4.1)', () => {
  it('케이스 C: 2,800만/연5.5%/48개월, 24개월 시점 잔액이 원금의 50~55%', () => {
    const r = monthlyRate(5.5);
    const bal = remBal(28_000_000, r, 48, 24);
    expect(bal / 28_000_000).toBeGreaterThan(0.50);
    expect(bal / 28_000_000).toBeLessThan(0.55);
  });
  it('m=0이면 원금 그대로, m=n이면 0', () => {
    const r = monthlyRate(5.5);
    expect(remBal(28_000_000, r, 48, 0)).toBeCloseTo(28_000_000, 4);
    expect(remBal(28_000_000, r, 48, 48)).toBeCloseTo(0, 4);
  });
  it('금리 0%: 선형 상환', () => {
    expect(remBal(48_000_000, 0, 48, 12)).toBe(36_000_000);
  });
  it('단조 감소', () => {
    const r = monthlyRate(6);
    let prev = Infinity;
    for (let m = 0; m <= 48; m += 6) {
      const b = remBal(40_000_000, r, 48, m);
      expect(b).toBeLessThanOrEqual(prev);
      prev = b;
    }
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/pmt.test.ts`
Expected: FAIL — `Cannot find module '../pmt'`

- [ ] **Step 3: 구현**

`lib/engine/pmt.ts`:
```ts
// lib/engine/pmt.ts — 원리금균등상환 수학 (스펙 §4.1)

/** 연금리(%) → 월이율(분수) */
export const monthlyRate = (annualPct: number): number => annualPct / 100 / 12;

/** 월 납입금. p=원금(원), r=월이율(분수), n=개월 */
export function pmt(p: number, r: number, n: number): number {
  if (p <= 0 || n <= 0) return 0;
  if (r === 0) return p / n;
  const f = Math.pow(1 + r, n);
  return (p * r * f) / (f - 1);
}

/** m회 납입 후 잔여 원금 */
export function remBal(p: number, r: number, n: number, m: number): number {
  if (p <= 0 || n <= 0) return 0;
  const paid = Math.min(Math.max(m, 0), n);
  if (r === 0) return Math.max(p - (p / n) * paid, 0);
  const f = Math.pow(1 + r, paid);
  return Math.max(p * f - (pmt(p, r, n) * (f - 1)) / r, 0);
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run lib/engine/__tests__/pmt.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add lib/engine/pmt.ts lib/engine/__tests__/pmt.test.ts
git commit -m "feat(engine): PMT·잔여원금 공식 + v2 문서 케이스A 기대값 정정(939,402원)"
```

---

### Task 4: 감가 시세 + 테스트 픽스처

**Files:**
- Create: `lib/engine/resale.ts`, `lib/engine/__tests__/fixtures.ts`
- Test: `lib/engine/__tests__/resale.test.ts`

- [ ] **Step 1: 공용 픽스처 작성** (이후 모든 엔진 테스트가 사용 — 손계산을 쉽게 하려고 부대비용·수수료는 전부 0)

`lib/engine/__tests__/fixtures.ts`:
```ts
import type { CommonProfile, FinanceItem, Method } from '../types';

/** 손계산 기준 항목: 4,000만 승용차 1대·48개월·선납0·부대비용0 */
export function baseItem(method: Method, over: Partial<FinanceItem> = {}): FinanceItem {
  return {
    id: 't1',
    method,
    vehicle: { name: '테스트카', price: 40_000_000, isUsed: false, count: 1, category: 'passenger' },
    months: 48,
    ratePct: 6,
    down: { mode: 'amount', value: 0 },
    residual: method === 'oplease' || method === 'finlease' ? { mode: 'pct', value: 30 } : null,
    loanAmount: null,
    insuranceYr: 0,
    maintenanceYr: 0,
    subsidy: 0,
    acqTaxRatePct: 7,
    tax: { useDrivingLog: false, bizUsePct: 100 },
    depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [] },
    exit: {
      canTransfer: false, transferFee: 0, penaltyPct: 0,
      returnInspFee: 0, mileagePenalty: 0, earlyDiscount: 0,
    },
    ...over,
  };
}

export function baseCommon(over: Partial<CommonProfile> = {}): CommonProfile {
  return {
    biz: 'none', industryIndex: 0, revenueIndex: 2,
    marginalRateOverride: null, assetReturnPct: 0, tradeIn: 0, scenarios: [],
    ...over,
  };
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/engine/__tests__/resale.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resaleAt } from '../resale';
import { baseItem } from './fixtures';

describe('resaleAt (스펙 §4.4)', () => {
  const item = baseItem('installment'); // 4,000만, 감가 15%, floor 25%

  it('m=0이면 차량가 그대로', () => {
    expect(resaleAt(item, 0)).toBe(40_000_000);
  });
  it('24개월(2년): 4,000만 × 0.85² = 28,900,000', () => {
    expect(resaleAt(item, 24)).toBeCloseTo(28_900_000, 0);
  });
  it('최저 잔존비율(25%)에서 멈춤: 120개월에도 1,000만', () => {
    expect(resaleAt(item, 120)).toBe(10_000_000);
  });
  it('직접입력이 감가커브보다 우선', () => {
    const o = baseItem('installment', {
      depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [{ atMonths: 24, price: 25_000_000 }] },
    });
    expect(resaleAt(o, 24)).toBe(25_000_000);
    expect(resaleAt(o, 12)).toBeCloseTo(34_000_000, 0); // 다른 시점은 커브 사용
  });
});
```

- [ ] **Step 3: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/resale.test.ts`
Expected: FAIL — `Cannot find module '../resale'`

- [ ] **Step 4: 구현**

`lib/engine/resale.ts`:
```ts
// lib/engine/resale.ts — 차량 감가 시세 (스펙 §4.4), 1대당
import type { FinanceItem } from './types';

export function resaleAt(item: FinanceItem, m: number): number {
  const ov = item.depreciation.resaleOverrides.find((o) => o.atMonths === m);
  if (ov) return ov.price;
  const P = item.vehicle.price;
  const yrs = m / 12;
  const curve = P * Math.pow(1 - item.depreciation.depRatePct / 100, yrs);
  return Math.max(curve, P * (item.depreciation.floorPct / 100));
}
```

- [ ] **Step 5: 실행 — 통과 확인**

Run: `npx vitest run lib/engine/__tests__/resale.test.ts`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add lib/engine/resale.ts lib/engine/__tests__/resale.test.ts lib/engine/__tests__/fixtures.ts
git commit -m "feat(engine): 감가 시세 곡선 + 시점별 직접입력 우선"
```

### Task 5: costAt 1부 — 금융 구조·누적지출·부가세·취득세

**Files:**
- Create: `lib/engine/costAt.ts`
- Test: `lib/engine/__tests__/costAt.test.ts`

스펙 §4.2(매트릭스)·§4.3(누적지출) 구현. 이 Task에서는 중간 함수(`financials`, `vatRefundCumEach`, `sunkAt`)까지 — 출구비용은 Task 6, 최종 스냅샷 조립은 Task 8.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/engine/__tests__/costAt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { financials, sunkAt, vatRefundCumEach } from '../costAt';
import { baseCommon, baseItem } from './fixtures';

describe('financials — 방식별 금융 구조 (스펙 §4.2)', () => {
  it('케이스 B: 운용리스 원금 = 4,000만−1,200만−1,200만 = 1,600만, 월납은 렌트·할부보다 낮다', () => {
    const op = financials(baseItem('oplease', { ratePct: 4.5, down: { mode: 'pct', value: 30 } }));
    const rent = financials(baseItem('rent', { ratePct: 5.9, down: { mode: 'pct', value: 30 } }));
    const inst = financials(baseItem('installment', { ratePct: 5.5, down: { mode: 'pct', value: 30 } }));
    expect(op.principal).toBe(16_000_000);
    expect(rent.principal).toBe(28_000_000);
    expect(inst.principal).toBe(28_000_000); // loanAmount null → 상한 = 차량가−선납
    expect(op.monthly).toBeLessThan(rent.monthly);
    expect(op.monthly).toBeLessThan(inst.monthly);
  });

  it('할부 대출 상한: 대출금이 차량가−선납−지원을 넘으면 잘리고, 모자라면 현금추가 발생', () => {
    const over = financials(baseItem('installment', { down: { mode: 'amount', value: 12_000_000 }, loanAmount: 99_000_000 }));
    expect(over.principal).toBe(28_000_000);
    expect(over.cashExtraEach).toBe(0);
    const under = financials(baseItem('installment', { down: { mode: 'amount', value: 12_000_000 }, loanAmount: 20_000_000 }));
    expect(under.principal).toBe(20_000_000);
    expect(under.cashExtraEach).toBe(8_000_000);
  });

  it('케이스 K: 취득세는 금융리스·할부만 (4,000만×7% = 280만)', () => {
    expect(financials(baseItem('finlease')).acqTaxEach).toBe(2_800_000);
    expect(financials(baseItem('installment')).acqTaxEach).toBe(2_800_000);
    expect(financials(baseItem('rent')).acqTaxEach).toBe(0);
    expect(financials(baseItem('oplease')).acqTaxEach).toBe(0);
  });

  it('엣지: 선납+잔존 > 차량가 → 원금 0, 월납 0', () => {
    const f = financials(baseItem('finlease', { down: { mode: 'pct', value: 80 }, residual: { mode: 'pct', value: 30 } }));
    expect(f.principal).toBe(0);
    expect(f.monthly).toBe(0);
  });
});

describe('vatRefundCumEach — 부가세 환급 (스펙 §4.2 각주2, 케이스 I)', () => {
  const biz = baseCommon({ biz: 'personal' });
  it('화물(exempt)+사업자: 렌트는 매월 렌트료×10/110 누적', () => {
    const item = baseItem('rent', { vehicle: { ...baseItem('rent').vehicle, category: 'truck' } });
    const { monthly } = financials(item);
    expect(vatRefundCumEach(item, biz, 12)).toBeCloseTo(monthly * 12 * (10 / 110), 4);
  });
  it('화물+사업자: 할부·금융리스는 초기 1회 차량가×10/110, 운용리스는 0', () => {
    const truck = (m: 'installment' | 'finlease' | 'oplease') =>
      baseItem(m, { vehicle: { ...baseItem(m).vehicle, category: 'truck' } });
    expect(vatRefundCumEach(truck('installment'), biz, 0)).toBeCloseTo(40_000_000 * (10 / 110), 4);
    expect(vatRefundCumEach(truck('finlease'), biz, 0)).toBeCloseTo(40_000_000 * (10 / 110), 4);
    expect(vatRefundCumEach(truck('oplease'), biz, 24)).toBe(0);
  });
  it('일반 승용차이거나 비사업자면 환급 0', () => {
    expect(vatRefundCumEach(baseItem('rent'), biz, 12)).toBe(0); // passenger
    const truck = baseItem('installment', { vehicle: { ...baseItem('installment').vehicle, category: 'truck' } });
    expect(vatRefundCumEach(truck, baseCommon(), 12)).toBe(0); // biz none
  });
});

describe('sunkAt — 누적지출 (스펙 §4.3)', () => {
  it('m=0: 선납+현금추가+취득세만 (할부), 렌트는 선납만', () => {
    const inst = baseItem('installment', { down: { mode: 'amount', value: 12_000_000 } });
    expect(sunkAt(inst, baseCommon(), 0)).toBe(12_000_000 + 2_800_000);
    expect(sunkAt(baseItem('rent', { down: { mode: 'amount', value: 12_000_000 } }), baseCommon(), 0)).toBe(12_000_000);
  });
  it('월납·연간비용·대수 반영: 2대면 정확히 2배 (tradeIn=0)', () => {
    const one = baseItem('rent', { insuranceYr: 800_000, maintenanceYr: 300_000 });
    const two = baseItem('rent', {
      insuranceYr: 800_000, maintenanceYr: 300_000,
      vehicle: { ...one.vehicle, count: 2 },
    });
    expect(sunkAt(two, baseCommon(), 24)).toBeCloseTo(sunkAt(one, baseCommon(), 24) * 2, 4);
  });
  it('보상판매는 항목당 1회 차감 (대수와 무관)', () => {
    const c = baseCommon({ tradeIn: 5_000_000 });
    const one = baseItem('rent');
    const two = baseItem('rent', { vehicle: { ...one.vehicle, count: 2 } });
    expect(sunkAt(one, c, 0)).toBe(-5_000_000);
    expect(sunkAt(two, c, 0)).toBe(-5_000_000); // 선납 0이므로 −tradeIn만
  });
  it('손계산 대조: 렌트 1,200만 선납·연보험 80만·24개월', () => {
    const item = baseItem('rent', {
      ratePct: 5.9, down: { mode: 'amount', value: 12_000_000 }, insuranceYr: 800_000,
    });
    const { monthly } = financials(item);
    // 선납 1,200만 + 월납×24 + 보험 80만×2년
    expect(sunkAt(item, baseCommon(), 24)).toBeCloseTo(12_000_000 + monthly * 24 + 1_600_000, 4);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/costAt.test.ts`
Expected: FAIL — `Cannot find module '../costAt'`

- [ ] **Step 3: 구현**

`lib/engine/costAt.ts`:
```ts
// lib/engine/costAt.ts — 항목 1개의 시점별 비용 계산 (스펙 §4.2~4.3)
import { monthlyRate, pmt } from './pmt';
import { isExempt, VAT_FRACTION } from './taxData';
import type { CommonProfile, FinanceItem } from './types';
import { resolveAmount } from './types';

export interface Financials {
  P: number;            // 1대 차량가
  downEach: number;     // 1대당 선납
  resEach: number;      // 1대당 잔존가치 (리스 계열 외 0)
  principal: number;    // 1대당 금융 원금
  cashExtraEach: number;// 1대당 현금추가 (할부)
  acqTaxEach: number;   // 1대당 취득세 (finlease/installment)
  monthly: number;      // 1대당 월납
  r: number;            // 월이율
}

export function financials(item: FinanceItem): Financials {
  const P = item.vehicle.price;
  const downEach = resolveAmount(item.down, P);
  const resEach =
    item.method === 'oplease' || item.method === 'finlease' ? resolveAmount(item.residual, P) : 0;
  const sub = item.subsidy;
  const r = monthlyRate(item.ratePct);

  let principal: number;
  let cashExtraEach = 0;
  if (item.method === 'installment') {
    const cap = Math.max(P - downEach - sub, 0);
    principal = Math.min(item.loanAmount ?? cap, cap);
    cashExtraEach = Math.max(P - downEach - sub - principal, 0);
  } else {
    principal = Math.max(P - downEach - resEach - sub, 0);
  }

  const acqTaxEach =
    item.method === 'finlease' || item.method === 'installment'
      ? P * (item.acqTaxRatePct / 100)
      : 0;

  return { P, downEach, resEach, principal, cashExtraEach, acqTaxEach, monthly: pmt(principal, r, item.months), r };
}

/** 1대당 누적 부가세 환급 (스펙 §4.2 각주2). 사업자(일반과세)+한도제외 차량만. */
export function vatRefundCumEach(item: FinanceItem, common: CommonProfile, m: number): number {
  if (common.biz === 'none' || !isExempt(item.vehicle.category)) return 0;
  if (item.method === 'rent') {
    const { monthly } = financials(item);
    return monthly * Math.min(m, item.months) * VAT_FRACTION;
  }
  if (item.method === 'finlease' || item.method === 'installment') {
    return item.vehicle.price * VAT_FRACTION; // 초기 1회 (m=0부터 반영)
  }
  return 0; // oplease: 리스료 면세
}

/** 항목 전체 누적지출 (스펙 §4.3). m은 호출자가 계약기간 내로 클램프. */
export function sunkAt(item: FinanceItem, common: CommonProfile, m: number): number {
  const f = financials(item);
  const count = item.vehicle.count;
  const yrs = m / 12;
  return (
    (f.downEach + f.cashExtraEach + f.acqTaxEach) * count +
    f.monthly * m * count +
    (item.insuranceYr + item.maintenanceYr) * yrs * count -
    common.tradeIn -
    vatRefundCumEach(item, common, m) * count
  );
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run lib/engine/__tests__/costAt.test.ts`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add lib/engine/costAt.ts lib/engine/__tests__/costAt.test.ts
git commit -m "feat(engine): 방식별 금융구조·누적지출·부가세환급·취득세 (스펙 §4.2~4.3)"
```

---

### Task 6: costAt 2부 — 4방식 출구비용

**Files:**
- Modify: `lib/engine/costAt.ts` (함수 추가)
- Test: `lib/engine/__tests__/exit.test.ts`

스펙 §4.4 구현. 시세>잔여채무 → 출구비용 음수 허용(케이스 E·v2 검증 포인트 6).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/engine/__tests__/exit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { exitOptionsAt, financials, sunkAt } from '../costAt';
import { monthlyRate, remBal } from '../pmt';
import { baseCommon, baseItem } from './fixtures';

const common = baseCommon();

describe('exitOptionsAt (스펙 §4.4)', () => {
  it('렌트: 승계가 해지보다 싸면 bestExit는 transfer', () => {
    const item = baseItem('rent', {
      exit: { canTransfer: true, transferFee: 500_000, penaltyPct: 30, returnInspFee: 200_000, mileagePenalty: 0, earlyDiscount: 0 },
    });
    const { monthly } = financials(item);
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    const terminate = sunk + 24 * monthly * 0.3 + 200_000; // 잔여 24개월
    expect(r.options.find((o) => o.kind === 'terminate')!.cost).toBeCloseTo(terminate, 4);
    expect(r.options.find((o) => o.kind === 'transfer')!.cost).toBeCloseTo(sunk + 500_000, 4);
    expect(r.best.kind).toBe('transfer');
  });

  it('렌트 만기(m=n): 위약금 0, 점검비만 — 승계 옵션 없음', () => {
    const item = baseItem('rent', {
      exit: { canTransfer: true, transferFee: 500_000, penaltyPct: 30, returnInspFee: 200_000, mileagePenalty: 0, earlyDiscount: 0 },
    });
    const r = exitOptionsAt(item, common, 48);
    expect(r.options).toHaveLength(1);
    expect(r.options[0].kind).toBe('return');
    expect(r.options[0].cost).toBeCloseTo(sunkAt(item, common, 48) + 200_000, 4);
  });

  it('운용리스: 시세가 잔존보다 높으면 인수후매각이 최저', () => {
    const item = baseItem('oplease'); // 잔존 30% = 1,200만, 24개월 시세 2,890만
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    const buyout = r.options.find((o) => o.kind === 'buyoutSell')!;
    expect(buyout.cost).toBeCloseTo(sunk + 12_000_000 - 28_900_000, 0);
    expect(r.best.kind).toBe('buyoutSell');
  });

  it('금융리스: 잔여채무 = remBal + 잔존. 만기에는 remBal=0 → 잔존−시세만 (일치성)', () => {
    const item = baseItem('finlease'); // 원금 2,800만−1,200만? → 4,000만−0(선납)−1,200만 = 2,800만
    const f = financials(item);
    expect(f.principal).toBe(28_000_000);
    const r24 = exitOptionsAt(item, common, 24);
    const debt24 = remBal(f.principal, monthlyRate(6), 48, 24) + 12_000_000;
    expect(r24.options.find((o) => o.kind === 'settleSell')!.cost)
      .toBeCloseTo(sunkAt(item, common, 24) + debt24 - 28_900_000, 0);
    const r48 = exitOptionsAt(item, common, 48);
    const resale48 = 40_000_000 * 0.85 ** 4; // 20,880,250
    expect(r48.options.find((o) => o.kind === 'settleSell')!.cost)
      .toBeCloseTo(sunkAt(item, common, 48) + 12_000_000 - resale48, 0);
  });

  it('케이스 E: 할부 24개월, 시세 2,500만 > 잔여대출 → 매각차익이 누적지출 상쇄(음수 가능)', () => {
    const item = baseItem('installment', {
      ratePct: 5.5,
      down: { mode: 'amount', value: 12_000_000 },
      loanAmount: 28_000_000,
      depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [{ atMonths: 24, price: 25_000_000 }] },
    });
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    const bal = remBal(28_000_000, monthlyRate(5.5), 48, 24); // ≈ 원금의 52.7% ≈ 1,477만
    expect(r.best.cost).toBeCloseTo(sunk + bal - 25_000_000, 4);
    expect(r.best.cost - sunk).toBeGreaterThan(-10_500_000);
    expect(r.best.cost - sunk).toBeLessThan(-10_000_000);
  });

  it('중도상환 감면(earlyDiscount)은 잔여채무에서 차감, 바닥은 0', () => {
    const item = baseItem('installment', {
      loanAmount: 28_000_000,
      exit: { ...baseItem('installment').exit, earlyDiscount: 99_000_000 },
    });
    const r = exitOptionsAt(item, common, 24);
    const sunk = sunkAt(item, common, 24);
    expect(r.best.cost).toBeCloseTo(sunk + 0 - 28_900_000, 0); // max(잔여−감면,0)=0
  });

  it('대수 반영: 2대면 (출구비용−sunk) 차액도 2배 (tradeIn=0)', () => {
    const one = baseItem('oplease');
    const two = baseItem('oplease', { vehicle: { ...one.vehicle, count: 2 } });
    const d1 = exitOptionsAt(one, common, 24).best.cost - sunkAt(one, common, 24);
    const d2 = exitOptionsAt(two, common, 24).best.cost - sunkAt(two, common, 24);
    expect(d2).toBeCloseTo(d1 * 2, 4);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/exit.test.ts`
Expected: FAIL — `exitOptionsAt is not exported`

- [ ] **Step 3: 구현 — costAt.ts에 추가**

`lib/engine/costAt.ts` 하단에 추가:
```ts
import { remBal } from './pmt';            // ← 파일 상단 import에 병합
import { resaleAt } from './resale';       // ← 파일 상단 import에 병합
import type { ExitOption } from './types'; // ← 파일 상단 import에 병합

export interface ExitResult { options: ExitOption[]; best: ExitOption; resaleEach: number }

/** 시점 m(≤months)의 출구 옵션들 (스펙 §4.4) */
export function exitOptionsAt(item: FinanceItem, common: CommonProfile, m: number): ExitResult {
  const f = financials(item);
  const count = item.vehicle.count;
  const sunk = sunkAt(item, common, m);
  const remM = Math.max(item.months - m, 0);
  const atEnd = remM === 0;
  const resaleEach = resaleAt(item, m);
  const resaleTotal = resaleEach * count;
  const ex = item.exit;
  const options: ExitOption[] = [];

  const penalty = remM * f.monthly * (ex.penaltyPct / 100) * count;
  const returnCost = sunk + penalty + (ex.returnInspFee + ex.mileagePenalty) * count;

  if (item.method === 'rent') {
    options.push(
      atEnd
        ? { kind: 'return', label: '만기 반납', cost: returnCost }
        : { kind: 'terminate', label: '중도해지 반납', cost: returnCost },
    );
    if (ex.canTransfer && !atEnd)
      options.push({ kind: 'transfer', label: '계약 승계', cost: sunk + ex.transferFee * count });
  }

  if (item.method === 'oplease') {
    options.push(
      atEnd
        ? { kind: 'return', label: '만기 반납', cost: returnCost }
        : { kind: 'terminate', label: '중도해지 반납', cost: returnCost },
    );
    if (ex.canTransfer && !atEnd)
      options.push({ kind: 'transfer', label: '계약 승계', cost: sunk + ex.transferFee * count });
    options.push({
      kind: 'buyoutSell',
      label: atEnd ? '잔존가 인수 후 매각' : '조기 인수 후 매각',
      cost: sunk + Math.max(f.resEach - ex.earlyDiscount, 0) * count - resaleTotal,
    });
  }

  if (item.method === 'finlease') {
    const debtEach = remBal(f.principal, f.r, item.months, m) + f.resEach;
    options.push({
      kind: 'settleSell',
      label: atEnd ? '잔존가 지급·소유 (시세 반영)' : '조기정산 후 매각',
      cost: sunk + Math.max(debtEach - ex.earlyDiscount, 0) * count - resaleTotal,
    });
    if (ex.canTransfer && !atEnd)
      options.push({ kind: 'transfer', label: '리스 승계', cost: sunk + ex.transferFee * count });
  }

  if (item.method === 'installment') {
    const balEach = remBal(f.principal, f.r, item.months, m);
    options.push({
      kind: 'settleSell',
      label: atEnd ? '보유 (시세 반영)' : '중도상환 후 매각',
      cost: sunk + Math.max(balEach - ex.earlyDiscount, 0) * count - resaleTotal,
    });
  }

  const best = options.reduce((a, b) => (b.cost < a.cost ? b : a));
  return { options, best, resaleEach };
}
```

(상단 import 정리: `import { monthlyRate, pmt, remBal } from './pmt';`, `import { resaleAt } from './resale';`, `import type { CommonProfile, ExitOption, FinanceItem } from './types';`)

- [ ] **Step 4: 실행 — 전체 통과 확인**

Run: `npx vitest run`
Expected: pmt/resale/costAt/exit/taxData 전부 PASS (총 ~30개)

- [ ] **Step 5: Commit**

```bash
git add lib/engine/costAt.ts lib/engine/__tests__/exit.test.ts
git commit -m "feat(engine): 4방식 출구비용 — 해지·승계·인수·정산 최적 선택 (스펙 §4.4)"
```

### Task 7: 세금 — 비용 인정액·세금절감

**Files:**
- Create: `lib/engine/tax.ts`
- Test: `lib/engine/__tests__/tax.test.ts`

스펙 §4.5의 5단계. 핵심 설계: 한도 로직을 **순수 파츠 함수** `deductibleFromParts()`로 분리해 손계산 대조를 쉽게 하고, `deductibleAt()`이 항목에서 파츠를 조립한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/engine/__tests__/tax.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { annualInterestAt, deductibleAt, deductibleFromParts, taxSavingAt } from '../tax';
import { financials } from '../costAt';
import { baseCommon, baseItem } from './fixtures';

const parts = (over: Partial<Parameters<typeof deductibleFromParts>[0]> = {}) =>
  deductibleFromParts({
    annualCost: 18_000_000, depEquiv: 12_600_000, exempt: false,
    useDrivingLog: false, bizUsePct: 100, industryRate: 1, ...over,
  });

describe('deductibleFromParts — 한도 5단계 (스펙 §4.5)', () => {
  it('케이스 D(실무형 갱신): 연비용 1,800만·기록부X → 비율 15/18, 업무사용금액 1,500만, 감가초과 250만 → 인정 1,250만', () => {
    // 렌트 월 150만: 연비용 1,800만, 감가상당 = 1,800만×70% = 1,260만
    // 비율 = min(1,500만/1,800만, 1) = 0.8333…, 업무사용금액 = 1,500만
    // 감가초과 = max(1,260만×0.8333 − 800만, 0) = 1,050만 − 800만 = 250만
    // 인정 = 1,500만 − 250만 = 1,250만
    const b = parts();
    expect(b.ratio).toBeCloseTo(15 / 18, 6);
    expect(b.usedAmount).toBeCloseTo(15_000_000, 0);
    expect(b.depExcess).toBeCloseTo(2_500_000, 0);
    expect(b.recognizedEach).toBeCloseTo(12_500_000, 0);
  });

  it('케이스 G: 정액 감가 1,200만(6,000만 차) → 800만 한도, 초과 400만 불인정', () => {
    const b = parts({ annualCost: 12_000_000, depEquiv: 12_000_000 });
    expect(b.ratio).toBe(1); // 1,500만 한도 내
    expect(b.depExcess).toBeCloseTo(4_000_000, 0);
    expect(b.recognizedEach).toBeCloseTo(8_000_000, 0);
  });

  it('케이스 J: 기록부 작성 + 업무사용 80% → 1,500만 초과 인정 가능', () => {
    const b = parts({ annualCost: 20_000_000, depEquiv: 14_000_000, useDrivingLog: true, bizUsePct: 80 });
    expect(b.usedAmount).toBeCloseTo(16_000_000, 0);       // 1,500만 초과 OK
    expect(b.depExcess).toBeCloseTo(14_000_000 * 0.8 - 8_000_000, 0); // 320만
    expect(b.recognizedEach).toBeCloseTo(12_800_000, 0);
  });

  it('한도제외 차량: 전액 인정 (비율 1, 감가초과 0)', () => {
    const b = parts({ exempt: true, annualCost: 30_000_000, depEquiv: 21_000_000 });
    expect(b.recognizedEach).toBe(30_000_000);
  });

  it('부동산임대업 50%: 인정액 절반', () => {
    expect(parts({ industryRate: 0.5 }).recognizedEach).toBeCloseTo(6_250_000, 0);
  });
});

describe('annualInterestAt / deductibleAt — 항목 조립', () => {
  it('m=0이면 연이자 0', () => {
    expect(annualInterestAt(baseItem('installment'), 0)).toBe(0);
  });
  it('할부 연이자 > 0이고, 연비용 = 정액감가 + 연이자 (보험·정비 0)', () => {
    const item = baseItem('installment');
    const i = annualInterestAt(item, 24);
    expect(i).toBeGreaterThan(0);
    const b = deductibleAt(item, baseCommon({ biz: 'personal' }), 24);
    expect(b.annualCost).toBeCloseTo(40_000_000 / 5 + i, 4);
    expect(b.depEquiv).toBeCloseTo(8_000_000, 4); // 4,000만/5 = 정확히 한도
  });
  it('렌트 감가상당액 = 연렌트료×70%, 운용리스 = ×93%', () => {
    const rent = baseItem('rent');
    const op = baseItem('oplease');
    const c = baseCommon({ biz: 'personal' });
    expect(deductibleAt(rent, c, 24).depEquiv)
      .toBeCloseTo(financials(rent).monthly * 12 * 0.7, 4);
    expect(deductibleAt(op, c, 24).depEquiv)
      .toBeCloseTo(financials(op).monthly * 12 * 0.93, 4);
  });
});

describe('taxSavingAt (스펙 §4.5 단계5)', () => {
  it('비사업자 → 0', () => {
    expect(taxSavingAt(baseItem('rent'), baseCommon(), 24)).toBe(0);
  });
  it('절감 = 인정액 × 연수 × 한계세율 × 대수', () => {
    const c = baseCommon({ biz: 'personal', revenueIndex: 2 }); // 15%
    const item = baseItem('rent');
    const b = deductibleAt(item, c, 24);
    expect(taxSavingAt(item, c, 24)).toBeCloseTo(b.recognizedEach * 2 * 0.15, 4);
  });
  it('케이스 H: 3대면 절감도 3배 — 한도가 대당 적용된다는 의미', () => {
    const c = baseCommon({ biz: 'personal' });
    const one = baseItem('oplease', { insuranceYr: 800_000, maintenanceYr: 300_000 });
    const three = baseItem('oplease', {
      insuranceYr: 800_000, maintenanceYr: 300_000,
      vehicle: { ...one.vehicle, count: 3 },
    });
    expect(taxSavingAt(three, c, 24)).toBeCloseTo(taxSavingAt(one, c, 24) * 3, 4);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/tax.test.ts`
Expected: FAIL — `Cannot find module '../tax'`

- [ ] **Step 3: 구현**

`lib/engine/tax.ts`:
```ts
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
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run lib/engine/__tests__/tax.test.ts`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add lib/engine/tax.ts lib/engine/__tests__/tax.test.ts
git commit -m "feat(engine): 실무형 비용인정 5단계 + 세금절감 (스펙 §4.5)"
```

---

### Task 8: costAt 3부 — 스냅샷 통합 (기회비용·실질순비용·만기 고정)

**Files:**
- Create: `lib/engine/snapshot.ts`
- Test: `lib/engine/__tests__/snapshot.test.ts`

스펙 §4.6 + §5의 "만기 이후 고정" 규칙. `costAt(item, common, m)`이 `CostSnapshot` 전체를 반환한다.
별도 파일인 이유: `tax.ts`가 `costAt.ts`(financials)를 import하므로, 통합 함수를 `costAt.ts`에 두면 순환 의존이 생긴다. 의존 방향: `snapshot → tax → costAt → pmt/resale` (단방향).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/engine/__tests__/snapshot.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { costAt } from '../snapshot';
import { baseCommon, baseItem } from './fixtures';

describe('costAt 스냅샷 (스펙 §4.6)', () => {
  it('전 과정 손계산: 할부 금리0%·4,000만·취득세 7%·시세 2,500만 — net = 1,808만', () => {
    // monthly = 4,000만/48 = 833,333.33…, m=24
    // sunk = 280만(취득세) + 833,333.33×24(=2,000만) = 2,280만
    // settle = 2,280만 + 잔여대출 2,000만 − 시세 2,500만 = 1,780만
    // 기회비용 = 초기현금 280만 × 5% × 2년 = 28만 → net = 1,780만 + 28만 = 1,808만
    const item = baseItem('installment', {
      ratePct: 0,
      depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [{ atMonths: 24, price: 25_000_000 }] },
    });
    const s = costAt(item, baseCommon({ assetReturnPct: 5 }), 24);
    expect(s.sunk).toBeCloseTo(22_800_000, 0);
    expect(s.bestExit.cost).toBeCloseTo(17_800_000, 0);
    expect(s.initialCash).toBeCloseTo(2_800_000, 0);
    expect(s.oppCost).toBeCloseTo(280_000, 0);
    expect(s.taxSaving).toBe(0); // 비사업자
    expect(s.netCost).toBeCloseTo(18_080_000, 0);
  });

  it('배선 검증: netCost = bestExit.cost − taxSaving + oppCost', () => {
    const item = baseItem('rent', { insuranceYr: 800_000 });
    const s = costAt(item, baseCommon({ biz: 'personal', assetReturnPct: 5, tradeIn: 3_000_000 }), 30);
    expect(s.netCost).toBeCloseTo(s.bestExit.cost - s.taxSaving + s.oppCost, 6);
  });

  it('초기 부가세 환급은 기회비용의 초기현금에서도 차감 (화물+사업자 할부)', () => {
    const item = baseItem('installment', {
      down: { mode: 'amount', value: 12_000_000 },
      vehicle: { ...baseItem('installment').vehicle, category: 'truck', count: 1 },
      acqTaxRatePct: 5,
    });
    const s = costAt(item, baseCommon({ biz: 'personal', assetReturnPct: 5 }), 12);
    // 초기현금 = 선납 1,200만 + 취득세 200만 − 환급 363.6만
    expect(s.initialCash).toBeCloseTo(12_000_000 + 2_000_000 - 40_000_000 * (10 / 110), 0);
  });

  it('m=0: 기회비용 0, 절감 0', () => {
    const s = costAt(baseItem('rent'), baseCommon({ biz: 'personal', assetReturnPct: 5 }), 0);
    expect(s.oppCost).toBe(0);
    expect(s.taxSaving).toBe(0);
  });

  it('만기 이후 고정: m=60 요청 시 m=48 값 + ended=true (스펙 §5)', () => {
    const item = baseItem('oplease');
    const at48 = costAt(item, baseCommon(), 48);
    const at60 = costAt(item, baseCommon(), 60);
    expect(at60.ended).toBe(true);
    expect(at48.ended).toBe(false);
    expect(at60.netCost).toBe(at48.netCost);
    expect(at60.m).toBe(48);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/snapshot.test.ts`
Expected: FAIL — `Cannot find module '../snapshot'`

- [ ] **Step 3: 구현 — snapshot.ts 신규 작성**

`lib/engine/snapshot.ts`:
```ts
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
```

- [ ] **Step 4: 실행 — 전체 통과 확인**

Run: `npx vitest run`
Expected: 전체 PASS (~45개)

- [ ] **Step 5: Commit**

```bash
git add lib/engine/snapshot.ts lib/engine/__tests__/snapshot.test.ts
git commit -m "feat(engine): 종합 스냅샷 — 기회비용·실질순비용·만기 고정 (스펙 §4.6)"
```

---

### Task 9: 비교 엔진 — 그리드·최적 탐색·시나리오

**Files:**
- Create: `lib/engine/compare.ts`
- Test: `lib/engine/__tests__/compare.test.ts`

스펙 §5. 불변식(P)과 성능 벤치마크 포함.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/engine/__tests__/compare.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compareAll } from '../compare';
import { costAt } from '../snapshot';
import { financials } from '../costAt';
import { baseCommon, baseItem } from './fixtures';
import type { ComparisonState } from '../types';

const state = (over: Partial<ComparisonState> = {}): ComparisonState => ({
  common: baseCommon(),
  items: [
    baseItem('oplease', { id: 'a' }),
    baseItem('installment', { id: 'b', months: 72 }),
  ],
  ...over,
});

describe('compareAll (스펙 §5)', () => {
  it('그리드: 0~최장기간(72), 3개월 단위, 끝점 포함', () => {
    const r = compareAll(state());
    expect(r.horizon).toBe(72);
    expect(r.gridMonths[0]).toBe(0);
    expect(r.gridMonths[r.gridMonths.length - 1]).toBe(72);
    expect(r.gridMonths).toContain(48);
  });

  it('기간 불일치: 48개월 항목은 48 이후 ended·값 고정 (점선 표시용)', () => {
    const r = compareAll(state());
    const a = r.series.find((s) => s.itemId === 'a')!;
    const at48 = a.points.find((p) => p.m === 48)!;
    const at60 = a.points.find((p) => p.m === 60)!;
    expect(at60.ended).toBe(true);
    expect(at60.netCost).toBe(at48.netCost);
  });

  it('bestPoint: 자기 계약기간 내 후보들의 최소와 일치', () => {
    const r = compareAll(state());
    const a = r.series.find((s) => s.itemId === 'a')!;
    const item = state().items[0];
    const candidates = r.gridMonths.filter((m) => m <= 48);
    const manualMin = Math.min(...candidates.map((m) => costAt(item, baseCommon(), m).netCost));
    expect(a.bestPoint.netCost).toBeCloseTo(manualMin, 4);
  });

  it('globalBest = 모든 (항목, 시점) 중 최소', () => {
    const r = compareAll(state());
    const allBest = Math.min(...r.series.map((s) => s.bestPoint.netCost));
    expect(r.globalBest!.netCost).toBeCloseTo(allBest, 4);
  });

  it('시나리오 행: 시점마다 전 항목 스냅샷 + 최저 항목 표시', () => {
    const st = state({ common: baseCommon({ scenarios: [{ atMonths: 24, label: '2년 후' }] }) });
    const r = compareAll(st);
    expect(r.scenarioRows).toHaveLength(1);
    const row = r.scenarioRows[0];
    expect(row.cells).toHaveLength(2);
    const min = row.cells.reduce((x, y) => (y.snapshot.netCost < x.snapshot.netCost ? y : x));
    expect(row.bestItemId).toBe(min.itemId);
  });

  it('항목 0개 → 빈 결과, 1개 → 단독 분석 (globalBest는 그 항목)', () => {
    expect(compareAll({ common: baseCommon(), items: [] }).globalBest).toBeNull();
    const r = compareAll({ common: baseCommon(), items: [baseItem('rent', { id: 'x' })] });
    expect(r.globalBest!.itemId).toBe('x');
  });
});

describe('불변식 (스펙 §7 P)', () => {
  it('잔존가치↑ → 운용리스 월납↓', () => {
    const m30 = financials(baseItem('oplease', { residual: { mode: 'pct', value: 30 } })).monthly;
    const m40 = financials(baseItem('oplease', { residual: { mode: 'pct', value: 40 } })).monthly;
    expect(m40).toBeLessThan(m30);
  });

  it('누적지출은 시점에 대해 단조 증가 (환급 없는 기본 케이스)', () => {
    const r = compareAll({ common: baseCommon(), items: [baseItem('rent', { id: 'r', insuranceYr: 800_000 })] });
    const pts = r.series[0].points.filter((p) => !p.ended);
    // netCost가 아니라 sunk의 단조성: costAt으로 직접 확인
    let prev = -Infinity;
    for (const p of pts) {
      const s = costAt(baseItem('rent', { id: 'r', insuranceYr: 800_000 }), baseCommon(), p.m);
      expect(s.sunk).toBeGreaterThanOrEqual(prev);
      prev = s.sunk;
    }
  });

  it('대수 선형성: tradeIn=0이면 2대 netCost = 1대×2, tradeIn>0이면 깨진다', () => {
    const c0 = baseCommon({ biz: 'personal', assetReturnPct: 5 });
    const one = costAt(baseItem('oplease'), c0, 24).netCost;
    const two = costAt(
      baseItem('oplease', { vehicle: { ...baseItem('oplease').vehicle, count: 2 } }), c0, 24,
    ).netCost;
    expect(two).toBeCloseTo(one * 2, 2);

    const cT = baseCommon({ biz: 'personal', assetReturnPct: 5, tradeIn: 5_000_000 });
    const oneT = costAt(baseItem('oplease'), cT, 24).netCost;
    const twoT = costAt(
      baseItem('oplease', { vehicle: { ...baseItem('oplease').vehicle, count: 2 } }), cT, 24,
    ).netCost;
    expect(Math.abs(twoT - oneT * 2)).toBeGreaterThan(1); // 1회 차감이라 비선형
  });

  it('벤치마크: 50항목 × 25시점 < 200ms', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      baseItem((['rent', 'oplease', 'finlease', 'installment'] as const)[i % 4], { id: `i${i}` }),
    );
    const t0 = performance.now();
    compareAll({ common: baseCommon({ biz: 'personal' }), items });
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/engine/__tests__/compare.test.ts`
Expected: FAIL — `Cannot find module '../compare'`

- [ ] **Step 3: 구현**

`lib/engine/compare.ts`:
```ts
// lib/engine/compare.ts — N항목 비교·최적 탐색·시나리오 (스펙 §5)
import { costAt } from './snapshot';
import type { ComparisonState, CostSnapshot, Scenario } from './types';

export const GRID_STEP = 3;

export interface SeriesPoint { m: number; netCost: number; ended: boolean }
export interface ItemSeries {
  itemId: string;
  points: SeriesPoint[];
  bestPoint: { m: number; netCost: number; exitLabel: string };
}
export interface ScenarioCell { itemId: string; snapshot: CostSnapshot }
export interface ScenarioRow { scenario: Scenario; cells: ScenarioCell[]; bestItemId: string }
export interface CompareResult {
  horizon: number;
  gridMonths: number[];
  series: ItemSeries[];
  globalBest: { itemId: string; m: number; netCost: number; exitLabel: string } | null;
  scenarioRows: ScenarioRow[];
}

export function compareAll(state: ComparisonState): CompareResult {
  const { common, items } = state;
  if (items.length === 0)
    return { horizon: 0, gridMonths: [], series: [], globalBest: null, scenarioRows: [] };

  const horizon = Math.max(...items.map((i) => i.months));
  const gridMonths: number[] = [];
  for (let m = 0; m <= horizon; m += GRID_STEP) gridMonths.push(m);
  if (gridMonths[gridMonths.length - 1] !== horizon) gridMonths.push(horizon);

  const series: ItemSeries[] = items.map((item) => {
    const points: SeriesPoint[] = gridMonths.map((m) => {
      const s = costAt(item, common, m);
      return { m, netCost: s.netCost, ended: s.ended };
    });
    // 자기 계약기간 내 후보 (+ 정확한 만기점)
    const candidates = gridMonths.filter((m) => m <= item.months);
    if (!candidates.includes(item.months)) candidates.push(item.months);
    let best = { m: 0, netCost: Infinity, exitLabel: '' };
    for (const m of candidates) {
      const s = costAt(item, common, m);
      if (s.netCost < best.netCost) best = { m, netCost: s.netCost, exitLabel: s.bestExit.label };
    }
    return { itemId: item.id, points, bestPoint: best };
  });

  const globalBest = series.reduce<CompareResult['globalBest']>((acc, s) => {
    if (!acc || s.bestPoint.netCost < acc.netCost)
      return { itemId: s.itemId, ...s.bestPoint };
    return acc;
  }, null);

  const scenarioRows: ScenarioRow[] = common.scenarios.map((scenario) => {
    const cells: ScenarioCell[] = items.map((item) => ({
      itemId: item.id,
      snapshot: costAt(item, common, scenario.atMonths),
    }));
    const bestItemId = cells.reduce((a, b) =>
      b.snapshot.netCost < a.snapshot.netCost ? b : a,
    ).itemId;
    return { scenario, cells, bestItemId };
  });

  return { horizon, gridMonths, series, globalBest, scenarioRows };
}
```

- [ ] **Step 4: 실행 — 전체 통과 확인**

Run: `npx vitest run`
Expected: 전체 PASS (~55개). 벤치마크 포함.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/compare.ts lib/engine/__tests__/compare.test.ts
git commit -m "feat(engine): 비교 그리드·최적 시점 탐색·시나리오 + 불변식 테스트 (스펙 §5)"
```

### Task 10: 포맷터

**Files:**
- Create: `lib/format.ts`
- Test: `lib/__tests__/format.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/__tests__/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fmtMan, fmtPct, fmtWon, parseDigits } from '../format';

describe('format', () => {
  it('fmtWon: 콤마+원', () => {
    expect(fmtWon(939401.5)).toBe('939,402원');
    expect(fmtWon(-1100000)).toBe('-1,100,000원');
  });
  it('fmtMan: 만/억 축약', () => {
    expect(fmtMan(40_000_000)).toBe('4,000만');
    expect(fmtMan(125_450_000)).toBe('1억 2,545만');
    expect(fmtMan(200_000_000)).toBe('2억');
    expect(fmtMan(-11_000_000)).toBe('-1,100만');
    expect(fmtMan(0)).toBe('0만');
  });
  it('fmtPct', () => {
    expect(fmtPct(5.9)).toBe('5.9%');
  });
  it('parseDigits: 콤마 입력 → 숫자', () => {
    expect(parseDigits('12,000,000')).toBe(12_000_000);
    expect(parseDigits('')).toBe(0);
    expect(parseDigits('abc')).toBe(0);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/__tests__/format.test.ts`
Expected: FAIL — `Cannot find module '../format'`

- [ ] **Step 3: 구현**

`lib/format.ts`:
```ts
// lib/format.ts — 표시용 포맷터 (엔진은 원 단위 number만 다룬다)
export const fmtWon = (n: number): string => `${Math.round(n).toLocaleString('ko-KR')}원`;

export const fmtPct = (n: number): string => `${n}%`;

/** 만원/억 축약 — 결과 표시용 */
export function fmtMan(n: number): string {
  const sign = n < 0 ? '-' : '';
  const man = Math.round(Math.abs(n) / 10_000);
  if (man >= 10_000) {
    const eok = Math.floor(man / 10_000);
    const rest = man % 10_000;
    return rest === 0 ? `${sign}${eok}억` : `${sign}${eok}억 ${rest.toLocaleString('ko-KR')}만`;
  }
  return `${sign}${man.toLocaleString('ko-KR')}만`;
}

/** "12,000,000" 같은 입력 문자열 → 숫자 (숫자 외 문자 제거) */
export function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d === '' ? 0 : Number(d);
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run lib/__tests__/format.test.ts`
Expected: 4 passed

- [ ] **Step 5: vitest include 확인**

`vitest.config.ts`의 include가 `lib/**/*.test.ts`이므로 `lib/__tests__/`도 잡힌다. `npx vitest run` 전체 실행으로 확인.

- [ ] **Step 6: Commit**

```bash
git add lib/format.ts lib/__tests__/format.test.ts
git commit -m "feat: 원/만원/% 포맷터"
```

---

### Task 11: 상태 — 기본값 팩토리 + 리듀서

**Files:**
- Create: `lib/state/defaults.ts`, `lib/state/reducer.ts`
- Test: `lib/state/__tests__/reducer.test.ts`

스펙 §6.3 기본값 + §6.2 데이터 흐름. **설계 결정**: 초기 상태는 v2와의 연속성을 위해 렌트·운용리스·할부 3항목으로 시작 (금융리스는 사용자가 추가).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/state/__tests__/reducer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defaultState, newItem } from '../defaults';
import { reducer } from '../reducer';

describe('defaults (스펙 §6.3)', () => {
  it('방식별 기본값: 금리·선납·잔존', () => {
    expect(newItem('rent').ratePct).toBe(5.9);
    expect(newItem('oplease').ratePct).toBe(4.5);
    expect(newItem('finlease').ratePct).toBe(5.0);
    expect(newItem('installment').ratePct).toBe(5.5);
    expect(newItem('rent').residual).toBeNull();
    expect(newItem('oplease').residual).toEqual({ mode: 'pct', value: 30 });
    expect(newItem('finlease').residual).toEqual({ mode: 'pct', value: 30 });
    expect(newItem('rent').insuranceYr).toBe(0); // 렌트는 보험 포함
    expect(newItem('oplease').insuranceYr).toBe(800_000);
  });
  it('id는 호출마다 고유', () => {
    expect(newItem('rent').id).not.toBe(newItem('rent').id);
  });
  it('초기 상태: 3항목(rent/oplease/installment), 시나리오 12/24/36', () => {
    const s = defaultState();
    expect(s.items.map((i) => i.method)).toEqual(['rent', 'oplease', 'installment']);
    expect(s.common.scenarios.map((x) => x.atMonths)).toEqual([12, 24, 36]);
  });
});

describe('reducer (스펙 §6.2)', () => {
  it('setCommon: 부분 패치', () => {
    const s = reducer(defaultState(), { type: 'setCommon', patch: { biz: 'corp' } });
    expect(s.common.biz).toBe('corp');
  });
  it('addItem / removeItem / duplicateItem / replaceItem', () => {
    let s = defaultState();
    s = reducer(s, { type: 'addItem', method: 'finlease' });
    expect(s.items).toHaveLength(4);
    expect(s.items[3].method).toBe('finlease');

    const target = s.items[0];
    s = reducer(s, { type: 'duplicateItem', id: target.id });
    expect(s.items).toHaveLength(5);
    expect(s.items[1].method).toBe(target.method); // 복제는 원본 바로 뒤
    expect(s.items[1].id).not.toBe(target.id);

    const edited = { ...s.items[0], months: 60 };
    s = reducer(s, { type: 'replaceItem', item: edited });
    expect(s.items[0].months).toBe(60);

    const n = s.items.length;
    s = reducer(s, { type: 'removeItem', id: s.items[0].id });
    expect(s.items).toHaveLength(n - 1);
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run lib/state/__tests__/reducer.test.ts`
Expected: FAIL — `Cannot find module '../defaults'`

- [ ] **Step 3: 구현**

`lib/state/defaults.ts`:
```ts
// lib/state/defaults.ts — 신규 항목 기본값 (스펙 §6.3)
import { categoryMeta } from '@/lib/engine/taxData';
import type { ComparisonState, FinanceItem, Method } from '@/lib/engine/types';

export const METHOD_LABELS: Record<Method, string> = {
  rent: '장기렌트', oplease: '운용리스', finlease: '금융리스', installment: '할부',
};

let seq = 0;
const nextId = () => `item-${++seq}-${Date.now().toString(36)}`;

interface MethodDefault {
  ratePct: number; residualPct: number | null;
  insuranceYr: number; maintenanceYr: number;
  penaltyPct: number; transferFee: number; returnInspFee: number; canTransfer: boolean;
}
const METHOD_DEFAULTS: Record<Method, MethodDefault> = {
  rent:        { ratePct: 5.9, residualPct: null, insuranceYr: 0,       maintenanceYr: 0,       penaltyPct: 30, transferFee: 500_000, returnInspFee: 200_000, canTransfer: true },
  oplease:     { ratePct: 4.5, residualPct: 30,   insuranceYr: 800_000, maintenanceYr: 300_000, penaltyPct: 20, transferFee: 300_000, returnInspFee: 150_000, canTransfer: true },
  finlease:    { ratePct: 5.0, residualPct: 30,   insuranceYr: 800_000, maintenanceYr: 300_000, penaltyPct: 20, transferFee: 300_000, returnInspFee: 0,       canTransfer: true },
  installment: { ratePct: 5.5, residualPct: null, insuranceYr: 800_000, maintenanceYr: 300_000, penaltyPct: 0,  transferFee: 0,       returnInspFee: 0,       canTransfer: false },
};

export function newItem(method: Method): FinanceItem {
  const d = METHOD_DEFAULTS[method];
  return {
    id: nextId(),
    method,
    vehicle: { name: '', price: 40_000_000, isUsed: false, count: 1, category: 'passenger' },
    months: 48,
    ratePct: d.ratePct,
    down: { mode: 'pct', value: 30 },
    residual: d.residualPct != null ? { mode: 'pct', value: d.residualPct } : null,
    loanAmount: method === 'installment' ? 28_000_000 : null,
    insuranceYr: d.insuranceYr,
    maintenanceYr: d.maintenanceYr,
    subsidy: 0,
    acqTaxRatePct: categoryMeta('passenger').acqTaxDefaultPct,
    tax: { useDrivingLog: false, bizUsePct: 100 },
    depreciation: { depRatePct: 15, floorPct: 25, resaleOverrides: [] },
    exit: {
      canTransfer: d.canTransfer, transferFee: d.transferFee, penaltyPct: d.penaltyPct,
      returnInspFee: d.returnInspFee, mileagePenalty: 0, earlyDiscount: 0,
    },
  };
}

export function defaultState(): ComparisonState {
  return {
    common: {
      biz: 'personal', industryIndex: 0, revenueIndex: 2,
      marginalRateOverride: null, assetReturnPct: 5, tradeIn: 0,
      scenarios: [
        { atMonths: 12, label: '1년 후' },
        { atMonths: 24, label: '2년 후' },
        { atMonths: 36, label: '3년 후' },
      ],
    },
    items: [newItem('rent'), newItem('oplease'), newItem('installment')],
  };
}
```

`lib/state/reducer.ts`:
```ts
// lib/state/reducer.ts — 단일 스토어 액션 (스펙 §6.2)
import type { CommonProfile, ComparisonState, FinanceItem, Method } from '@/lib/engine/types';
import { newItem } from './defaults';

export type Action =
  | { type: 'setCommon'; patch: Partial<CommonProfile> }
  | { type: 'addItem'; method: Method }
  | { type: 'replaceItem'; item: FinanceItem }
  | { type: 'duplicateItem'; id: string }
  | { type: 'removeItem'; id: string };

export function reducer(state: ComparisonState, action: Action): ComparisonState {
  switch (action.type) {
    case 'setCommon':
      return { ...state, common: { ...state.common, ...action.patch } };
    case 'addItem':
      return { ...state, items: [...state.items, newItem(action.method)] };
    case 'replaceItem':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.item.id ? action.item : i)),
      };
    case 'duplicateItem': {
      const idx = state.items.findIndex((i) => i.id === action.id);
      if (idx < 0) return state;
      const src = state.items[idx];
      const copy: FinanceItem = {
        ...structuredClone(src),
        id: newItem(src.method).id,
        label: src.label ? `${src.label} (복제)` : undefined,
      };
      const items = [...state.items];
      items.splice(idx + 1, 0, copy);
      return { ...state, items };
    }
    case 'removeItem':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
  }
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run lib/state/__tests__/reducer.test.ts`
Expected: 5 passed
(주의: `@/` 경로 alias가 vitest에서 풀리지 않으면 `vitest.config.ts`에 추가:)

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
});
```

- [ ] **Step 5: Commit**

```bash
git add lib/state vitest.config.ts
git commit -m "feat(state): 방식별 기본값 팩토리 + 리듀서 (스펙 §6.2~6.3)"
```

---

### Task 12: UI 기본 요소 + 빌더 패널

**Files:**
- Create: `components/ui/Field.tsx`
- Create: `components/builder/CommonSettingsCard.tsx`, `components/builder/ItemCard.tsx`, `components/builder/ItemList.tsx`
- Modify: `app/globals.css` (클래스 추가)

UI는 단위 테스트 없이 빌드+스모크로 검증 (계획 서두 참고). 각 Step 후 `npm run build`로 타입 체크.

- [ ] **Step 1: globals.css에 공용 클래스 추가** (기존 내용 아래에 append)

```css
/* ---------- 공용 레이아웃 ---------- */
.shell { display: flex; gap: 16px; padding: 16px; max-width: 1480px; margin: 0 auto; }
.builder-col { width: 420px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.results-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
@media (max-width: 960px) { .shell { flex-direction: column; } .builder-col { width: 100%; } }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
.card h3 { font-size: 14px; margin-bottom: 10px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 120px; }
.field > label { font-size: 11px; color: var(--sub); }
.field input, .field select {
  border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font-size: 13px;
  font-family: inherit; width: 100%; background: #fff;
}
.hint { font-size: 11px; color: var(--sub); }
.chips { display: inline-flex; gap: 4px; }
.chip {
  border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 12px;
  background: #fff; cursor: pointer; color: var(--sub);
}
.chip.on { border-color: var(--accent); color: var(--accent); background: #eff6ff; }
.badge-warn {
  display: inline-block; font-size: 11px; color: var(--warn);
  background: #fef3c7; border-radius: 6px; padding: 2px 8px;
}
.btn { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 7px 12px; font-size: 13px; cursor: pointer; font-family: inherit; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.ghost { border-style: dashed; color: var(--sub); width: 100%; }
.item-head { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.item-head .title { font-weight: 600; font-size: 13px; flex: 1; }
.item-head .sub { font-size: 11px; color: var(--sub); }
.method-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.section-label { font-size: 11px; color: var(--sub); text-transform: none; margin: 10px 0 6px; font-weight: 600; }
```

- [ ] **Step 2: Field.tsx 작성**

`components/ui/Field.tsx`:
```tsx
'use client';
import { fmtMan, parseDigits } from '@/lib/format';
import type { ModeValue } from '@/lib/engine/types';

export function MoneyInput(props: {
  label: string; value: number; onChange: (v: number) => void; placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <input
        inputMode="numeric"
        value={props.value === 0 ? '' : props.value.toLocaleString('ko-KR')}
        placeholder={props.placeholder ?? '0'}
        onChange={(e) => props.onChange(parseDigits(e.target.value))}
      />
      <span className="hint">{fmtMan(props.value)}원</span>
    </div>
  );
}

export function NumInput(props: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; step?: number; min?: number; max?: number;
}) {
  return (
    <div className="field">
      <label>{props.label}{props.suffix ? ` (${props.suffix})` : ''}</label>
      <input
        type="number" value={props.value} step={props.step ?? 0.1}
        min={props.min} max={props.max}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function SelectInput(props: {
  label: string; value: number; options: string[]; onChange: (idx: number) => void;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <select value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
      </select>
    </div>
  );
}

export function Chips<T extends string>(props: {
  value: T; options: { key: T; label: string }[]; onChange: (k: T) => void;
}) {
  return (
    <span className="chips">
      {props.options.map((o) => (
        <button
          key={o.key} type="button"
          className={`chip ${props.value === o.key ? 'on' : ''}`}
          onClick={() => props.onChange(o.key)}
        >{o.label}</button>
      ))}
    </span>
  );
}

/** 비율/금액 토글 입력 (스펙 §3 ModeValue) */
export function PctOrAmountInput(props: {
  label: string; mv: ModeValue; base: number; onChange: (mv: ModeValue) => void;
}) {
  const resolved = props.mv.mode === 'pct' ? props.base * (props.mv.value / 100) : props.mv.value;
  return (
    <div className="field">
      <label>{props.label}</label>
      <div className="row" style={{ marginBottom: 0 }}>
        <Chips
          value={props.mv.mode}
          options={[{ key: 'pct', label: '비율' }, { key: 'amount', label: '금액' }]}
          onChange={(mode) =>
            props.onChange(mode === 'pct'
              ? { mode, value: props.base > 0 ? Math.round((props.mv.value / props.base) * 100) : 30 }
              : { mode, value: resolved })}
        />
        {props.mv.mode === 'pct' ? (
          <input
            style={{ width: 70 }} type="number" value={props.mv.value} min={0} max={100}
            onChange={(e) => props.onChange({ mode: 'pct', value: Number(e.target.value) })}
          />
        ) : (
          <input
            style={{ flex: 1 }} inputMode="numeric"
            value={props.mv.value === 0 ? '' : props.mv.value.toLocaleString('ko-KR')}
            onChange={(e) => props.onChange({ mode: 'amount', value: parseDigits(e.target.value) })}
          />
        )}
      </div>
      <span className="hint">= {fmtMan(resolved)}원</span>
    </div>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="row" style={{ fontSize: 12, cursor: 'pointer', marginBottom: 0 }}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {props.label}
    </label>
  );
}

export function WarnBadge({ children }: { children: React.ReactNode }) {
  return <span className="badge-warn">⚠ {children}</span>;
}
```

- [ ] **Step 3: CommonSettingsCard.tsx 작성**

`components/builder/CommonSettingsCard.tsx`:
```tsx
'use client';
import { MoneyInput, NumInput, SelectInput, Chips } from '@/components/ui/Field';
import { INDUSTRIES, REVENUE_LABELS } from '@/lib/engine/taxData';
import type { BizType, CommonProfile } from '@/lib/engine/types';
import type { Action } from '@/lib/state/reducer';

export function CommonSettingsCard(props: {
  common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { common, dispatch } = props;
  const set = (patch: Partial<CommonProfile>) => dispatch({ type: 'setCommon', patch });
  return (
    <div className="card">
      <h3>공통 설정</h3>
      <div className="row">
        <Chips<BizType>
          value={common.biz}
          options={[
            { key: 'none', label: '비사업자' },
            { key: 'personal', label: '개인사업자' },
            { key: 'corp', label: '법인' },
          ]}
          onChange={(biz) => set({ biz })}
        />
      </div>
      {common.biz !== 'none' && (
        <>
          <div className="row">
            <SelectInput
              label="업종" value={common.industryIndex}
              options={INDUSTRIES.map((i) => `${i.label}${i.deductRate < 1 ? ` (인정 ${i.deductRate * 100}%)` : ''}`)}
              onChange={(industryIndex) => set({ industryIndex })}
            />
            <SelectInput
              label="연매출 구간" value={common.revenueIndex}
              options={REVENUE_LABELS} onChange={(revenueIndex) => set({ revenueIndex })}
            />
          </div>
          <div className="row">
            <NumInput
              label="한계세율 직접 입력 (비우면 자동)" suffix="%"
              value={common.marginalRateOverride ?? 0}
              onChange={(v) => set({ marginalRateOverride: v > 0 ? v : null })}
            />
          </div>
        </>
      )}
      <div className="row">
        <NumInput label="자산 기대수익률" suffix="%" value={common.assetReturnPct}
          onChange={(assetReturnPct) => set({ assetReturnPct })} />
        <MoneyInput label="보상판매 (내 차)" value={common.tradeIn}
          onChange={(tradeIn) => set({ tradeIn })} />
      </div>
      <div className="section-label">비교 시점 시나리오</div>
      {common.scenarios.map((s, i) => (
        <div className="row" key={i}>
          <NumInput
            label={`시점 ${i + 1}`} suffix="개월 후" step={3} min={3} max={120} value={s.atMonths}
            onChange={(atMonths) => {
              const scenarios = common.scenarios.map((x, j) =>
                j === i ? { atMonths, label: `${Math.round(atMonths / 12 * 10) / 10}년 후` } : x);
              set({ scenarios });
            }}
          />
          <button className="btn" onClick={() => set({ scenarios: common.scenarios.filter((_, j) => j !== i) })}>삭제</button>
        </div>
      ))}
      <button
        className="btn ghost"
        onClick={() => set({
          scenarios: [...common.scenarios, { atMonths: 12, label: '1년 후' }],
        })}
      >＋ 시나리오 추가</button>
    </div>
  );
}
```

- [ ] **Step 4: ItemCard.tsx 작성** (가장 큰 컴포넌트 — 방식별 조건부 필드)

`components/builder/ItemCard.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Chips, MoneyInput, NumInput, PctOrAmountInput, SelectInput, Toggle, WarnBadge } from '@/components/ui/Field';
import { fmtMan } from '@/lib/format';
import { CATEGORIES, categoryMeta, isExempt } from '@/lib/engine/taxData';
import { resolveAmount } from '@/lib/engine/types';
import type { CommonProfile, FinanceItem, VehicleCategory } from '@/lib/engine/types';
import { METHOD_LABELS } from '@/lib/state/defaults';

export const METHOD_COLORS: Record<FinanceItem['method'], string> = {
  rent: '#2563eb', oplease: '#059669', finlease: '#9333ea', installment: '#d97706',
};

export function ItemCard(props: {
  item: FinanceItem; common: CommonProfile; index: number;
  onChange: (item: FinanceItem) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const { item, common } = props;
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<FinanceItem>) => props.onChange({ ...item, ...patch });
  const P = item.vehicle.price;
  const downA = resolveAmount(item.down, P);
  const resA = resolveAmount(item.residual, P);
  const overCommit = downA + resA + item.subsidy > P;
  const isLease = item.method === 'oplease' || item.method === 'finlease';
  const owns = item.method === 'finlease' || item.method === 'installment';
  const needsInsuranceWarn =
    common.biz !== 'none' && !isExempt(item.vehicle.category);

  const title = item.label?.trim()
    || `${METHOD_LABELS[item.method]}${item.vehicle.name ? ` · ${item.vehicle.name}` : ''}`;

  return (
    <div className="card">
      <div className="item-head" onClick={() => setOpen(!open)}>
        <span className="method-dot" style={{ background: METHOD_COLORS[item.method] }} />
        <span className="title">{props.index + 1}. {title}</span>
        <span className="sub">
          {fmtMan(P)} · {item.months}개월 · {item.vehicle.count}대 {open ? '▲' : '▼'}
        </span>
      </div>
      {overCommit && <div style={{ marginTop: 6 }}><WarnBadge>선납+잔존+지원이 차량가를 초과 — 원금 0으로 계산</WarnBadge></div>}
      {!open ? null : (
        <div style={{ marginTop: 10 }}>
          <div className="section-label">차량</div>
          <div className="row">
            <div className="field">
              <label>차량명 (선택)</label>
              <input value={item.vehicle.name}
                onChange={(e) => set({ vehicle: { ...item.vehicle, name: e.target.value } })} />
            </div>
            <NumInput label="대수" suffix="대" step={1} min={1} value={item.vehicle.count}
              onChange={(count) => set({ vehicle: { ...item.vehicle, count: Math.max(1, Math.round(count)) } })} />
          </div>
          <div className="row">
            <MoneyInput label="차량 가격 (1대, 부가세 포함)" value={P}
              onChange={(price) => set({ vehicle: { ...item.vehicle, price } })} />
            <SelectInput
              label="차량 분류"
              value={CATEGORIES.findIndex((c) => c.key === item.vehicle.category)}
              options={CATEGORIES.map((c) => c.label)}
              onChange={(i) => {
                const category = CATEGORIES[i].key as VehicleCategory;
                set({
                  vehicle: { ...item.vehicle, category },
                  acqTaxRatePct: categoryMeta(category).acqTaxDefaultPct,
                });
              }}
            />
          </div>
          <div className="row">
            <Chips
              value={item.vehicle.isUsed ? 'used' : 'new'}
              options={[{ key: 'new', label: '신차' }, { key: 'used', label: '중고차' }]}
              onChange={(k) => set({ vehicle: { ...item.vehicle, isUsed: k === 'used' } })}
            />
          </div>

          <div className="section-label">계약</div>
          <div className="row">
            <NumInput label="기간" suffix="개월" step={6} min={12} max={72} value={item.months}
              onChange={(months) => set({ months })} />
            <NumInput label="금리" suffix="%" step={0.1} min={0} max={15} value={item.ratePct}
              onChange={(ratePct) => set({ ratePct })} />
          </div>
          <div className="row">
            <PctOrAmountInput label="선납금 (1대당)" mv={item.down} base={P}
              onChange={(down) => set({ down })} />
            {isLease && item.residual && (
              <PctOrAmountInput label="잔존가치 (1대당)" mv={item.residual} base={P}
                onChange={(residual) => set({ residual })} />
            )}
          </div>
          {item.method === 'installment' && (
            <div className="row">
              <MoneyInput label="대출 금액 (1대당)" value={item.loanAmount ?? 0}
                onChange={(loanAmount) => set({ loanAmount })} />
            </div>
          )}
          <div className="row">
            <MoneyInput label="지원금 (1대당)" value={item.subsidy}
              onChange={(subsidy) => set({ subsidy })} />
            {owns && (
              <NumInput label="취득세율" suffix="%" step={0.5} min={0} max={10} value={item.acqTaxRatePct}
                onChange={(acqTaxRatePct) => set({ acqTaxRatePct })} />
            )}
          </div>

          <div className="section-label">연간 비용 (1대당)</div>
          <div className="row">
            <MoneyInput label="보험료 (연)" value={item.insuranceYr}
              onChange={(insuranceYr) => set({ insuranceYr })} />
            <MoneyInput label="정비비 (연)" value={item.maintenanceYr}
              onChange={(maintenanceYr) => set({ maintenanceYr })} />
          </div>

          {common.biz !== 'none' && (
            <>
              <div className="section-label">세무</div>
              <div className="row">
                <Toggle label="운행기록부 작성" checked={item.tax.useDrivingLog}
                  onChange={(useDrivingLog) => set({ tax: { ...item.tax, useDrivingLog } })} />
                {item.tax.useDrivingLog && (
                  <NumInput label="업무사용비율" suffix="%" step={5} min={0} max={100} value={item.tax.bizUsePct}
                    onChange={(bizUsePct) => set({ tax: { ...item.tax, bizUsePct } })} />
                )}
              </div>
              {needsInsuranceWarn && (
                <div className="row"><WarnBadge>법인·성실신고자는 업무전용자동차보험 필수 (미가입 시 불인정 — 계산 미반영)</WarnBadge></div>
              )}
            </>
          )}

          <div className="section-label">감가·시세</div>
          <div className="row">
            <NumInput label="연 감가율" suffix="%" step={1} min={5} max={30} value={item.depreciation.depRatePct}
              onChange={(depRatePct) => set({ depreciation: { ...item.depreciation, depRatePct } })} />
            <NumInput label="최저 잔존비율" suffix="%" step={5} min={10} max={50} value={item.depreciation.floorPct}
              onChange={(floorPct) => set({ depreciation: { ...item.depreciation, floorPct } })} />
          </div>
          {common.scenarios.map((s) => {
            const ov = item.depreciation.resaleOverrides.find((o) => o.atMonths === s.atMonths);
            return (
              <div className="row" key={s.atMonths}>
                <MoneyInput
                  label={`${s.atMonths}개월 시점 예상시세 (비우면 자동 감가)`}
                  value={ov?.price ?? 0}
                  onChange={(price) => {
                    const rest = item.depreciation.resaleOverrides.filter((o) => o.atMonths !== s.atMonths);
                    set({
                      depreciation: {
                        ...item.depreciation,
                        resaleOverrides: price > 0 ? [...rest, { atMonths: s.atMonths, price }] : rest,
                      },
                    });
                  }}
                />
              </div>
            );
          })}

          <div className="section-label">해지·승계 조건</div>
          {item.method !== 'installment' && (
            <div className="row">
              <Toggle label="승계 가능" checked={item.exit.canTransfer}
                onChange={(canTransfer) => set({ exit: { ...item.exit, canTransfer } })} />
              {item.exit.canTransfer && (
                <MoneyInput label="승계 수수료 (1대당)" value={item.exit.transferFee}
                  onChange={(transferFee) => set({ exit: { ...item.exit, transferFee } })} />
              )}
            </div>
          )}
          {(item.method === 'rent' || item.method === 'oplease') && (
            <>
              <div className="row">
                <NumInput label="위약금 비율 (잔여납입 대비)" suffix="%" step={5} min={0} max={50}
                  value={item.exit.penaltyPct}
                  onChange={(penaltyPct) => set({ exit: { ...item.exit, penaltyPct } })} />
                <MoneyInput label="반납 점검비" value={item.exit.returnInspFee}
                  onChange={(returnInspFee) => set({ exit: { ...item.exit, returnInspFee } })} />
              </div>
              <div className="row">
                <MoneyInput label="초과주행 위약금 (예상)" value={item.exit.mileagePenalty}
                  onChange={(mileagePenalty) => set({ exit: { ...item.exit, mileagePenalty } })} />
              </div>
            </>
          )}
          <div className="row">
            <MoneyInput
              label={item.method === 'oplease' ? '조기인수 할인' : item.method === 'rent' ? '— (해당 없음)' : '조기정산·중도상환 감면'}
              value={item.exit.earlyDiscount}
              onChange={(earlyDiscount) => set({ exit: { ...item.exit, earlyDiscount } })}
            />
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div className="field">
              <label>항목 이름 (선택)</label>
              <input value={item.label ?? ''} placeholder={title}
                onChange={(e) => set({ label: e.target.value || undefined })} />
            </div>
            <button className="btn" onClick={props.onDuplicate}>복제</button>
            <button className="btn" onClick={props.onRemove}>삭제</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: ItemList.tsx 작성**

`components/builder/ItemList.tsx`:
```tsx
'use client';
import { ItemCard } from './ItemCard';
import { METHOD_LABELS } from '@/lib/state/defaults';
import type { CommonProfile, FinanceItem, Method } from '@/lib/engine/types';
import type { Action } from '@/lib/state/reducer';

const METHODS: Method[] = ['rent', 'oplease', 'finlease', 'installment'];

export function ItemList(props: {
  items: FinanceItem[]; common: CommonProfile; dispatch: (a: Action) => void;
}) {
  const { items, common, dispatch } = props;
  return (
    <>
      {items.map((item, i) => (
        <ItemCard
          key={item.id} item={item} common={common} index={i}
          onChange={(it) => dispatch({ type: 'replaceItem', item: it })}
          onDuplicate={() => dispatch({ type: 'duplicateItem', id: item.id })}
          onRemove={() => dispatch({ type: 'removeItem', id: item.id })}
        />
      ))}
      <div className="card">
        <h3>＋ 비교 항목 추가</h3>
        <div className="row" style={{ marginBottom: 0 }}>
          {METHODS.map((m) => (
            <button key={m} className="btn" onClick={() => dispatch({ type: 'addItem', method: m })}>
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: 타입 체크**

Run: `npm run build`
Expected: `✓ Compiled successfully` (컴포넌트는 아직 page에서 미사용 — unused 경고 없음 확인)

- [ ] **Step 7: Commit**

```bash
git add components app/globals.css
git commit -m "feat(ui): 입력 프리미티브 + 빌더 패널 (공통설정·항목카드·항목목록)"
```

### Task 13: 결과 탭 1부 — 탭 셸·종합·시나리오·세금

**Files:**
- Modify: `lib/state/defaults.ts` (`itemTitle` 헬퍼 추가)
- Create: `components/results/ResultTabs.tsx`, `SummaryTab.tsx`, `ScenarioTab.tsx`, `TaxTab.tsx`
- Modify: `app/globals.css` (결과용 클래스 추가)

- [ ] **Step 1: itemTitle 헬퍼 추가** — `lib/state/defaults.ts` 하단에:

```ts
import type { FinanceItem } from '@/lib/engine/types'; // 이미 import에 있음

export function itemTitle(item: FinanceItem, index: number): string {
  const auto = `${METHOD_LABELS[item.method]}${item.vehicle.name ? ` · ${item.vehicle.name}` : ''}`;
  const base = item.label?.trim() || auto;
  return `${index + 1}. ${base}${item.vehicle.count > 1 ? ` ×${item.vehicle.count}` : ''}`;
}
```

- [ ] **Step 2: globals.css에 결과용 클래스 추가** (append)

```css
/* ---------- 결과 ---------- */
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tab { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
.tab.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.verdict { border: 2px solid var(--good); background: #ecfdf5; border-radius: 12px; padding: 14px; }
.verdict .big { font-size: 17px; font-weight: 700; color: var(--good); }
.bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; }
.bar-label { width: 170px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-track { flex: 1; background: #f1f5f9; border-radius: 6px; height: 22px; position: relative; }
.bar-fill { height: 100%; border-radius: 6px; min-width: 2px; }
.bar-val { width: 110px; text-align: right; font-variant-numeric: tabular-nums; }
table.cmp { width: 100%; border-collapse: collapse; font-size: 12px; }
table.cmp th, table.cmp td { border: 1px solid var(--line); padding: 6px 8px; text-align: right; font-variant-numeric: tabular-nums; }
table.cmp th { background: #f8fafc; text-align: center; }
table.cmp td.best { background: #ecfdf5; font-weight: 700; color: var(--good); }
table.cmp td:first-child, table.cmp th:first-child { text-align: left; }
.muted { color: var(--sub); font-size: 11px; }
.disclaimer { font-size: 11px; color: var(--sub); line-height: 1.7; border-top: 1px solid var(--line); padding-top: 10px; margin-top: 8px; }
```

- [ ] **Step 3: ResultTabs.tsx 작성** (탭 셸 + 정규화 토글, 스펙 §5·§6.1)

`components/results/ResultTabs.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Chips } from '@/components/ui/Field';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { SummaryTab } from './SummaryTab';
import { TimelineTab } from './TimelineTab';
import { ScenarioTab } from './ScenarioTab';
import { TaxTab } from './TaxTab';
import { DetailTab } from './DetailTab';

export type Norm = 'total' | 'perVehicle' | 'perMonth';
export const normalize = (v: number, count: number, m: number, norm: Norm): number =>
  norm === 'perVehicle' ? v / count : norm === 'perMonth' ? v / Math.max(m, 1) : v;

const TABS = [
  { key: 'summary', label: '🏆 종합' },
  { key: 'timeline', label: '📈 시점별' },
  { key: 'scenario', label: '🔄 시나리오' },
  { key: 'tax', label: '🧾 세금' },
  { key: 'detail', label: '📋 상세' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function ResultTabs(props: { state: ComparisonState; result: CompareResult }) {
  const [tab, setTab] = useState<TabKey>('summary');
  const [norm, setNorm] = useState<Norm>('total');
  const single = props.state.items.length === 1;
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}>
          <div className="tabs">
            {TABS.filter((t) => !(single && t.key === 'scenario')).map((t) => (
              <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <Chips<Norm>
            value={norm}
            options={[
              { key: 'total', label: '총액' },
              { key: 'perVehicle', label: '대당' },
              { key: 'perMonth', label: '월평균' },
            ]}
            onChange={setNorm}
          />
        </div>
      </div>
      {tab === 'summary' && <SummaryTab {...props} norm={norm} />}
      {tab === 'timeline' && <TimelineTab {...props} />}
      {tab === 'scenario' && <ScenarioTab {...props} norm={norm} />}
      {tab === 'tax' && <TaxTab {...props} />}
      {tab === 'detail' && <DetailTab {...props} />}
    </>
  );
}
```

- [ ] **Step 4: SummaryTab.tsx 작성** (판정 카드 + 만기 기준 막대 + 특징표)

`components/results/SummaryTab.tsx`:
```tsx
'use client';
import { costAt } from '@/lib/engine/snapshot';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle, METHOD_LABELS } from '@/lib/state/defaults';
import { METHOD_COLORS } from '@/components/builder/ItemCard';
import { normalize, type Norm } from './ResultTabs';

const TRAITS: Record<string, [string, string, string, string]> = {
  // [초기부담, 소유권, 비용처리, 만기]
  rent: ['낮음 (선납만)', '렌트사', '렌트료 (한도 내)', '반납'],
  oplease: ['낮음 (선납만)', '리스사', '리스료 (한도 내)', '반납/인수/승계'],
  finlease: ['취득세 포함', '이용자 (자산 계상)', '감가상각+이자', '잔존가 지급 후 소유'],
  installment: ['높음 (현금+취득세)', '이용자', '감가상각+이자', '소유 유지'],
};

export function SummaryTab(props: { state: ComparisonState; result: CompareResult; norm: Norm }) {
  const { state, result, norm } = props;
  if (state.items.length === 0) {
    return <div className="card">비교 항목을 추가하면 결과가 표시됩니다.</div>;
  }
  // 만기 기준 스냅샷 (각자 자기 계약기간)
  const atEnd = state.items.map((item, i) => ({
    item, i, s: costAt(item, state.common, item.months),
  }));
  const vals = atEnd.map((x) => normalize(x.s.netCost, x.item.vehicle.count, x.item.months, norm));
  const maxAbs = Math.max(...vals.map(Math.abs), 1);
  const minVal = Math.min(...vals);
  const gb = result.globalBest;
  const gbItem = gb ? state.items.find((it) => it.id === gb.itemId) : null;
  const gbIdx = gb ? state.items.findIndex((it) => it.id === gb.itemId) : -1;

  return (
    <>
      {gb && gbItem && (
        <div className="verdict">
          <div className="muted">전체 최적 (모든 항목 × 시점 탐색)</div>
          <div className="big">
            {itemTitle(gbItem, gbIdx)} — {gb.m}개월 시점 · {gb.exitLabel}
          </div>
          <div>실질순비용 {fmtMan(gb.netCost)}원</div>
        </div>
      )}
      <div className="card">
        <h3>만기 기준 실질순비용 ({norm === 'total' ? '총액' : norm === 'perVehicle' ? '대당' : '월평균'})</h3>
        {atEnd.map((x, idx) => (
          <div className="bar-row" key={x.item.id}>
            <span className="bar-label">{itemTitle(x.item, x.i)}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(Math.abs(vals[idx]) / maxAbs) * 100}%`,
                  background: vals[idx] === minVal ? 'var(--good)' : METHOD_COLORS[x.item.method],
                  opacity: vals[idx] === minVal ? 1 : 0.45,
                }}
              />
            </div>
            <span className="bar-val">{fmtMan(vals[idx])}원</span>
          </div>
        ))}
        <p className="muted">각 항목의 자기 만기 시점 기준. 음수는 매각차익이 비용을 초과한다는 뜻.</p>
      </div>
      <div className="card">
        <h3>방식별 특징</h3>
        <table className="cmp">
          <thead>
            <tr><th>항목</th><th>초기부담</th><th>소유권</th><th>비용처리</th><th>만기</th></tr>
          </thead>
          <tbody>
            {atEnd.map((x) => (
              <tr key={x.item.id}>
                <td>{itemTitle(x.item, x.i)}</td>
                {TRAITS[x.item.method].map((t, j) => <td key={j} style={{ textAlign: 'center' }}>{t}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 6 }}>
          {atEnd.map((x) => `${METHOD_LABELS[x.item.method]} 월납 ${fmtMan(x.s.monthly)}원`).join(' · ')}
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 5: ScenarioTab.tsx 작성**

`components/results/ScenarioTab.tsx`:
```tsx
'use client';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';
import { normalize, type Norm } from './ResultTabs';

export function ScenarioTab(props: { state: ComparisonState; result: CompareResult; norm: Norm }) {
  const { state, result, norm } = props;
  if (result.scenarioRows.length === 0) {
    return <div className="card">공통 설정에서 비교 시점 시나리오를 추가하세요.</div>;
  }
  return (
    <div className="card">
      <h3>시나리오별 실질순비용 — 시점마다 최적 출구 방법 자동 선택</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp">
          <thead>
            <tr>
              <th>시점</th>
              {state.items.map((it, i) => <th key={it.id}>{itemTitle(it, i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.scenarioRows.map((row) => (
              <tr key={row.scenario.atMonths}>
                <td>{row.scenario.label} ({row.scenario.atMonths}개월)</td>
                {row.cells.map((cell) => {
                  const item = state.items.find((it) => it.id === cell.itemId)!;
                  const v = normalize(cell.snapshot.netCost, item.vehicle.count, cell.snapshot.m, norm);
                  return (
                    <td key={cell.itemId} className={row.bestItemId === cell.itemId ? 'best' : ''}>
                      {fmtMan(v)}원
                      <div className="muted">
                        {cell.snapshot.bestExit.label}{cell.snapshot.ended ? ' · 만기 종료' : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: TaxTab.tsx 작성** (한도 적용 단계 표시 — 스펙 §6.1)

`components/results/TaxTab.tsx`:
```tsx
'use client';
import { deductibleAt, taxSavingAt } from '@/lib/engine/tax';
import { marginalRate } from '@/lib/engine/taxData';
import { isExempt } from '@/lib/engine/taxData';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

export function TaxTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state } = props;
  if (state.common.biz === 'none') {
    return <div className="card">비사업자는 차량 비용처리(세금절감)가 없습니다. 공통 설정에서 사업자 유형을 선택하세요.</div>;
  }
  const mr = marginalRate(state.common);
  return (
    <div className="card">
      <h3>비용 인정 계산 과정 (각 항목 만기 기준 · 1대당 연간)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp">
          <thead>
            <tr>
              <th>항목</th><th>연비용</th><th>감가상당액</th><th>업무사용비율</th>
              <th>업무사용금액</th><th>감가 한도초과</th><th>연 인정액</th><th>세금절감 (만기·전체)</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item, i) => {
              const b = deductibleAt(item, state.common, item.months);
              const saving = taxSavingAt(item, state.common, item.months);
              const exempt = isExempt(item.vehicle.category);
              return (
                <tr key={item.id}>
                  <td>{itemTitle(item, i)}{exempt ? ' (한도제외)' : ''}</td>
                  <td>{fmtMan(b.annualCost)}원</td>
                  <td>{fmtMan(b.depEquiv)}원</td>
                  <td style={{ textAlign: 'center' }}>{Math.round(b.ratio * 100)}%</td>
                  <td>{fmtMan(b.usedAmount)}원</td>
                  <td>{b.depExcess > 0 ? `−${fmtMan(b.depExcess)}원` : '—'}</td>
                  <td>{fmtMan(b.recognizedEach)}원</td>
                  <td className="best">{fmtMan(saving)}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        한계세율 {Math.round(mr * 1000) / 10}% 적용 (누진공제 미반영 근사) ·
        한도제외 차량은 전액 인정 · 승용차는 연 1,500만(기록부 작성 시 업무비율)·감가 800만 한도 (대당)
      </p>
    </div>
  );
}
```

- [ ] **Step 7: 빈 파일로 컴파일 통과시키기** — TimelineTab·DetailTab은 Task 14에서 작성하므로 임시 스텁:

`components/results/TimelineTab.tsx`:
```tsx
'use client';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
export function TimelineTab(_props: { state: ComparisonState; result: CompareResult }) {
  return <div className="card">시점별 차트 — Task 14에서 구현</div>;
}
```

`components/results/DetailTab.tsx`:
```tsx
'use client';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
export function DetailTab(_props: { state: ComparisonState; result: CompareResult }) {
  return <div className="card">비용 분해 — Task 14에서 구현</div>;
}
```

- [ ] **Step 8: 타입 체크 + Commit**

Run: `npm run build`
Expected: `✓ Compiled successfully`

```bash
git add components lib/state/defaults.ts app/globals.css
git commit -m "feat(ui): 결과 탭 셸 + 종합·시나리오·세금 탭 (정규화 토글 포함)"
```

---

### Task 14: 결과 탭 2부 — 시점별 차트·비용 분해

**Files:**
- Modify: `components/results/TimelineTab.tsx` (스텁 교체)
- Modify: `components/results/DetailTab.tsx` (스텁 교체)

- [ ] **Step 1: TimelineTab 구현** (recharts 라인차트 — 만기 후 점선, 최적시점 마커, 하단 표)

`components/results/TimelineTab.tsx` 전체 교체:
```tsx
'use client';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

const PALETTE = ['#2563eb', '#059669', '#9333ea', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#db2777'];

export function TimelineTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state, result } = props;
  if (result.series.length === 0) return <div className="card">비교 항목을 추가하세요.</div>;

  // 행: { m, a0: 진행값, e0: 만기후값, a1: …, … }
  const rows = result.gridMonths.map((m) => {
    const row: Record<string, number | null> = { m };
    result.series.forEach((s, i) => {
      const p = s.points.find((x) => x.m === m)!;
      row[`a${i}`] = p.ended ? null : p.netCost;
      row[`e${i}`] = p.ended ? p.netCost : null;
    });
    // 점선이 실선 끝점에서 이어지도록 만기점은 양쪽에 넣는다
    result.series.forEach((s, i) => {
      const item = state.items[i];
      if (m === item.months) row[`e${i}`] = row[`a${i}`];
    });
    return row;
  });

  return (
    <>
      <div className="card">
        <h3>시점별 실질순비용 (3개월 단위) — ★ = 항목별 최적 시점</h3>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="#eef2f7" />
            <XAxis dataKey="m" tickFormatter={(m) => `${m}M`} fontSize={11} />
            <YAxis tickFormatter={(v) => fmtMan(v)} fontSize={11} width={80} />
            <Tooltip
              formatter={(v: number) => `${fmtMan(v)}원`}
              labelFormatter={(m) => `${m}개월 시점`}
            />
            <Legend />
            {result.series.map((s, i) => {
              const item = state.items[i];
              const color = PALETTE[i % PALETTE.length];
              return [
                <Line key={`a${i}`} dataKey={`a${i}`} name={itemTitle(item, i)}
                  stroke={color} strokeWidth={2} dot={false} connectNulls={false} />,
                <Line key={`e${i}`} dataKey={`e${i}`} name={`${itemTitle(item, i)} (만기 후)`}
                  stroke={color} strokeWidth={1.5} strokeDasharray="4 4" dot={false}
                  legendType="none" connectNulls={false} />,
                <ReferenceDot key={`b${i}`} x={s.bestPoint.m} y={s.bestPoint.netCost}
                  r={5} fill={color} stroke="#fff" label={{ value: '★', fontSize: 12 }} />,
              ];
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>시점별 표 — 행마다 최저 비용 항목 강조</h3>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table className="cmp">
            <thead>
              <tr>
                <th>시점</th>
                {state.items.map((it, i) => <th key={it.id}>{itemTitle(it, i)}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.gridMonths.map((m) => {
                const vals = result.series.map((s) => s.points.find((p) => p.m === m)!);
                const live = vals.filter((p) => !p.ended).map((p) => p.netCost);
                const min = Math.min(...(live.length ? live : vals.map((p) => p.netCost)));
                return (
                  <tr key={m}>
                    <td>{m}개월</td>
                    {vals.map((p, i) => (
                      <td key={i} className={p.netCost === min ? 'best' : ''}>
                        {fmtMan(p.netCost)}원{p.ended ? <span className="muted"> 종료</span> : ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">항목별 최적: {result.series.map((s, i) =>
          `${itemTitle(state.items[i], i)} → ${s.bestPoint.m}개월 (${fmtMan(s.bestPoint.netCost)}원, ${s.bestPoint.exitLabel})`,
        ).join(' / ')}</p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: DetailTab 구현** (항목·시점 선택 → 비용 구성 분해)

`components/results/DetailTab.tsx` 전체 교체:
```tsx
'use client';
import { useState } from 'react';
import { Chips, NumInput } from '@/components/ui/Field';
import { costAt } from '@/lib/engine/snapshot';
import { financials, vatRefundCumEach } from '@/lib/engine/costAt';
import { fmtMan } from '@/lib/format';
import type { CompareResult } from '@/lib/engine/compare';
import type { ComparisonState } from '@/lib/engine/types';
import { itemTitle } from '@/lib/state/defaults';

export function DetailTab(props: { state: ComparisonState; result: CompareResult }) {
  const { state } = props;
  const [sel, setSel] = useState(0);
  const [m, setM] = useState(24);
  if (state.items.length === 0) return <div className="card">비교 항목을 추가하세요.</div>;

  const item = state.items[Math.min(sel, state.items.length - 1)];
  const s = costAt(item, state.common, m);
  const f = financials(item);
  const count = item.vehicle.count;
  const vatCum = vatRefundCumEach(item, state.common, s.m) * count;

  const parts: { label: string; value: number }[] = [
    { label: '선납금', value: f.downEach * count },
    { label: '현금 추가 (할부)', value: f.cashExtraEach * count },
    { label: '취득세', value: f.acqTaxEach * count },
    { label: `누적 납입 (${s.m}개월)`, value: f.monthly * s.m * count },
    { label: '보험·정비 누적', value: (item.insuranceYr + item.maintenanceYr) * (s.m / 12) * count },
    { label: '보상판매 차감', value: -state.common.tradeIn },
    { label: '부가세 환급', value: -vatCum },
    { label: `출구 정산 (${s.bestExit.label})`, value: s.bestExit.cost - s.sunk },
    { label: '세금절감', value: -s.taxSaving },
    { label: '기회비용', value: s.oppCost },
  ].filter((p) => p.value !== 0);
  const maxAbs = Math.max(...parts.map((p) => Math.abs(p.value)), 1);

  return (
    <div className="card">
      <h3>비용 구성 분해</h3>
      <div className="row">
        <Chips
          value={String(Math.min(sel, state.items.length - 1))}
          options={state.items.map((it, i) => ({ key: String(i), label: itemTitle(it, i) }))}
          onChange={(k) => setSel(Number(k))}
        />
        <NumInput label="시점" suffix="개월" step={3} min={0} max={item.months} value={m} onChange={setM} />
      </div>
      {parts.map((p) => (
        <div className="bar-row" key={p.label}>
          <span className="bar-label">{p.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{
              width: `${(Math.abs(p.value) / maxAbs) * 100}%`,
              background: p.value < 0 ? 'var(--good)' : '#94a3b8',
            }} />
          </div>
          <span className="bar-val" style={{ color: p.value < 0 ? 'var(--good)' : undefined }}>
            {fmtMan(p.value)}원
          </span>
        </div>
      ))}
      <div className="row" style={{ justifyContent: 'flex-end', fontWeight: 700 }}>
        실질순비용 = {fmtMan(s.netCost)}원 {s.ended ? '(만기 고정)' : ''}
      </div>
      <p className="muted">
        월납 {fmtMan(s.monthly)}원/대 · 원금 {fmtMan(s.principal)}원/대 · 시세 {fmtMan(s.resaleEach)}원/대 ·
        연 인정액 {fmtMan(s.annualDeductible)}원/대
      </p>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크 + Commit**

Run: `npm run build`
Expected: `✓ Compiled successfully`

```bash
git add components/results
git commit -m "feat(ui): 시점별 라인차트(만기 후 점선·최적 마커) + 비용 분해 탭"
```

### Task 15: 대시보드 조립 (레이아웃 A)

**Files:**
- Modify: `app/page.tsx` (placeholder 전체 교체)
- Modify: `app/globals.css` (헤더 클래스 추가)

- [ ] **Step 1: globals.css에 헤더 클래스 추가** (append)

```css
/* ---------- 헤더 ---------- */
.topbar {
  background: var(--card); border-bottom: 1px solid var(--line);
  padding: 14px 20px; display: flex; align-items: baseline; gap: 12px;
}
.topbar h1 { font-size: 17px; }
.topbar .sub { font-size: 12px; color: var(--sub); }
.empty-state { text-align: center; padding: 60px 20px; color: var(--sub); }
```

- [ ] **Step 2: page.tsx 전체 교체**

`app/page.tsx`:
```tsx
'use client';
import { useMemo, useReducer } from 'react';
import { CommonSettingsCard } from '@/components/builder/CommonSettingsCard';
import { ItemList } from '@/components/builder/ItemList';
import { ResultTabs } from '@/components/results/ResultTabs';
import { compareAll } from '@/lib/engine/compare';
import { defaultState } from '@/lib/state/defaults';
import { reducer } from '@/lib/state/reducer';

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, defaultState);
  const result = useMemo(() => compareAll(state), [state]);

  return (
    <main>
      <div className="topbar">
        <h1>🚗 자동차 금융 비교 계산기</h1>
        <span className="sub">장기렌트 · 운용리스 · 금융리스 · 할부 — 자유 조합 비교</span>
      </div>
      <div className="shell">
        <div className="builder-col">
          <CommonSettingsCard common={state.common} dispatch={dispatch} />
          <ItemList items={state.items} common={state.common} dispatch={dispatch} />
        </div>
        <div className="results-col">
          {state.items.length === 0 ? (
            <div className="card empty-state">
              <p style={{ fontSize: 15, marginBottom: 8 }}>비교 항목이 없습니다</p>
              <p>왼쪽에서 [＋ 비교 항목 추가]로 시작하세요.</p>
            </div>
          ) : (
            <ResultTabs state={state} result={result} />
          )}
          <div className="card disclaimer">
            <strong>한계·면책</strong> — 본 도구는 상대 비교·의사결정 보조용입니다.
            ① 한계세율 근사(누진공제 미반영) ② 감가상각 800만 이월 단순화 ③ 기회비용 단리
            ④ 위약금·정산식은 금융사 약관별 상이 ⑤ 보상판매는 현금 차감 처리
            ⑥ 부가세 환급은 일반과세자 가정 ⑦ 업무전용보험 미가입 페널티 미계산(경고만)
            ⑧ 시세는 단순 감가커브(직접입력으로 보완 가능).
            실제 계약 전 금융사 견적과 세무사 확인이 필요합니다.
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 빌드 + 육안 확인**

Run: `npm run build`
Expected: `✓ Compiled successfully`

Run: `npm run dev` (백그라운드) 후 브라우저에서 `http://localhost:3000`
Expected: 좌측 빌더(공통 설정 + 3개 항목 카드) / 우측 결과 탭이 즉시 렌더

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "feat(ui): 대시보드 레이아웃 조립 — 좌측 빌더 + 우측 실시간 결과 (레이아웃 A)"
```

---

### Task 16: 통합 검증 — 빌드·스모크 체크리스트·README

**Files:**
- Create: `README.md`

- [ ] **Step 1: 전체 테스트 + 빌드 최종 확인**

Run: `npx vitest run && npm run build`
Expected: 테스트 전체 PASS + 빌드 성공. 실패 시 여기서 멈추고 원인 수정.

- [ ] **Step 2: 수동 스모크 체크리스트** (`npm run dev` 상태에서 하나씩 확인하고 체크)

- [ ] 초기 화면: 렌트·운용리스·할부 3항목 + 우측 종합 탭 판정 카드 표시
- [ ] [＋ 금융리스] 추가 → 시점별 탭에 4번째 라인 등장
- [ ] 항목 카드 펼쳐 차량가 변경 → 우측 결과 즉시 갱신
- [ ] 대수를 3으로 → 세금 탭 절감액이 3배로 (대당 한도 적용 확인)
- [ ] 차량 분류를 '화물·밴'으로 → 취득세율 5% 자동 입력 + 상세 탭에 부가세 환급 행 등장 (사업자일 때)
- [ ] 운행기록부 토글 + 업무사용비율 80% → 세금 탭 비율 80% 반영
- [ ] 비사업자 선택 → 세금 탭 안내문으로 전환
- [ ] 시나리오 추가/삭제 → 시나리오 탭 행 증감
- [ ] 시세 직접입력을 크게 (예: 5,000만) → 해당 시점 실질순비용 음수(이익) 표시
- [ ] 선납 80% + 잔존 30% → 카드에 경고 배지, 계산은 계속
- [ ] 브라우저 폭 960px 이하 → 상하 배치로 전환
- [ ] 항목 전부 삭제 → 빈 상태 안내 / 1개만 → 시나리오 탭 숨김(단독 분석)

- [ ] **Step 3: README.md 작성**

```markdown
# 자동차 금융 비교 계산기

장기렌트 · 운용리스 · 금융리스 · 할부를 **자유 조합**(N항목 × 다대수)으로 비교하는 웹 계산기.
예: "금융리스 그랜저 1대 vs 운용리스 카니발 3대 vs 장기렌트 카니발 3대"

## 실행

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # 계산 엔진 단위 테스트 (Vitest)
npm run build  # 프로덕션 빌드
```

## 구조

- `lib/engine/` — 순수 계산 엔진 (PMT·출구비용·세금·비교). **모든 공식은 단위 테스트로 검증**
- `lib/state/` — 기본값·리듀서 / `components/` — 빌더·결과 UI / `app/` — Next.js 셸
- `docs/superpowers/specs/` — 설계 문서 / `docs/verification-report.md` — 계산 검증 보고서

## 계산 모델 요약

| | 장기렌트 | 운용리스 | 금융리스 | 할부 |
|---|---|---|---|---|
| 월납 원금 | 차량가−선납−지원 | −잔존 추가 차감 | −잔존 추가 차감 | min(대출금, 상한) |
| 취득세 | — | — | 반영 | 반영 |
| 부가세 환급* | 매월 | 없음(면세) | 초기 1회 | 초기 1회 |
| 비용처리 | 렌트료 | 리스료 | 감가+이자 | 감가+이자 |

\* 사업자(일반과세) + 한도제외 차량(경차·9인승↑승합·화물·영업용)만.
실질순비용 = 최적 출구비용 − 세금절감 + 기회비용. 자세한 규칙: 설계 문서 §4.

## 배포 (Vercel)

1. GitHub에 저장소 push
2. [vercel.com](https://vercel.com) → Add New Project → 저장소 Import (설정 기본값 그대로)
3. 이후 `git push`마다 자동 배포. CLI 사용 시: `npx vercel`

## 한계

한계세율 근사(누진공제 X) · 감가 이월 단순화 · 기회비용 단리 · 위약금은 대표 산식 ·
부가세 환급은 일반과세자 가정 · 업무전용보험 페널티 미계산.
**상대 비교용 보조 도구입니다 — 계약 전 금융사 견적 + 세무사 확인 필수.**
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README — 실행·구조·계산 모델·Vercel 배포 가이드"
```

---

### Task 17: 검증 보고서

**Files:**
- Create: `docs/verification-report.md`

요청 ③(계산 로직 검토)의 산출물. 아래 템플릿의 골격은 그대로 쓰되, `[실행 출력]` 두 곳은 `npx vitest run` 결과의 실제 수치로 채운다.

- [ ] **Step 1: 전체 테스트 실행해 수치 확보**

Run: `npx vitest run 2>&1 | tail -20`
Expected: 전체 PASS — 테스트 개수와 파일 수를 기록해 둔다.

- [ ] **Step 2: 보고서 작성**

```markdown
# 계산 로직 검증 보고서

작성일: (작성 시점 날짜) · 대상: lib/engine (커밋 해시 기입)
방법: 모든 공식을 손계산 기대값과 대조하는 단위 테스트로 박제 — `npx vitest run`으로 상시 재검증 가능.
테스트 현황: [실행 출력 — N개 파일, M개 테스트 전체 통과]

## 1. 공식별 검증 결과

| 스펙 | 공식 | 검증 방법 | 판정 |
|------|------|----------|------|
| §4.1 | PMT 원리금균등 | 4,000만/6%/48M 손계산 939,401.5원 대조 (pmt.test.ts) | ✅ |
| §4.1 | 잔여원금 remBal | 24M 시점 잔액 52.7% + m=0/m=n 경계 + 단조감소 (pmt.test.ts) | ✅ |
| §4.2 | 방식별 원금 | 운용리스 1,600만 손계산 + 할부 대출 상한·현금추가 (costAt.test.ts) | ✅ |
| §4.2 | 취득세 | fin/inst만 280만(7%), 분류별 기본세율 (costAt/taxData.test.ts) | ✅ |
| §4.2 | 부가세 환급 | 렌트 매월 10/110 · fin/inst 초기 1회 · 운용리스 0 · 자격조건 (costAt.test.ts) | ✅ |
| §4.3 | 누적지출 | 손계산 대조 + 대수 2배 선형 + tradeIn 1회 차감 (costAt.test.ts) | ✅ |
| §4.4 | 시세 감가커브 | 0.85² = 2,890만, floor 멈춤, 직접입력 우선 (resale.test.ts) | ✅ |
| §4.4 | 렌트 출구 | 해지 vs 승계 min 선택 + 만기 반납 (exit.test.ts) | ✅ |
| §4.4 | 운용리스 출구 | 3옵션 중 인수후매각 최저 케이스 (exit.test.ts) | ✅ |
| §4.4 | 금융리스 정산 | 잔여원금+잔존−시세, 만기 remBal=0 일치성 (exit.test.ts) | ✅ |
| §4.4 | 할부 매각차익 | 시세>잔여 → 음수 비용 −1,023만 (exit.test.ts) | ✅ |
| §4.5 | 한도 5단계 | D(1,250만)·G(800만)·J(80%)·제외차량·임대업50% 손계산 (tax.test.ts) | ✅ |
| §4.5 | 대당 한도 | 3대 → 절감 3배 (tax.test.ts) | ✅ |
| §4.6 | 기회비용·net | 금리0% 전 과정 손계산 1,808만 (snapshot.test.ts) | ✅ |
| §5   | 그리드·최적·시나리오 | 수동 최소값 대조 + 기간 불일치 고정 (compare.test.ts) | ✅ |
| §5   | 성능 | 50항목×25시점 [실행 출력 — Xms] < 200ms (compare.test.ts) | ✅ |

## 2. v2 문서 대비 발견·정정 사항

1. **테스트 케이스 A 기대값 오류**: v2 문서는 "≈939,929원"이라 했으나 정확값은 **939,401.5원**.
   검산: (1.005)⁴⁸=1.2704896 → 연금현가계수 42.580316 → 40,000,000÷42.580316 = 939,401.5.
   v2 코드가 이 값을 만들었다면 월납이 약 528원 과대계상된 것 (원인 추정: 오타 또는 다른 금리 사용).
2. **테스트 케이스 D는 실무형 규칙으로 갱신**: 단순 "1,500만 제한"이 아니라
   업무사용비율(15/18) 적용 후 감가상당액 800만 한도 초과분(250만)을 추가 차감 → 인정 1,250만.
3. **보상판매 처리 변경**: v2는 금융 원금에서 차감 → v3는 현금 차감 (다대수·자유 빌더와 일관).
   월납이 보상판매에 영향받지 않게 됨. 차이는 이자 상당분 (면책 명시).
4. **신규 반영**: 금융리스 표준 모델 · 부가세 환급 · 취득세 · 차량 분류 · 운행기록부 · 800만 감가 한도.

## 3. 남은 한계 (스펙 §8과 동일)

누진공제 미반영 / 감가 이월 단순화 / 기회비용 단리 / 위약금 대표 산식 /
일반과세 가정 / 업무전용보험 페널티 미계산 / 단순 감가커브.

> 본 보고서의 모든 ✅는 저장소에서 `npx vitest run`으로 재현 가능하다.
```

- [ ] **Step 3: Commit**

```bash
git add docs/verification-report.md
git commit -m "docs: 계산 로직 검증 보고서 — 공식별 손계산 대조 + v2 오류 정정"
```

---

## 계획 셀프 리뷰 노트

- **스펙 커버리지**: §3(Task 2) §4.1(T3) §4.2~4.3(T5) §4.4(T4·T6) §4.5(T7) §4.6(T8) §4.7(T2) §5(T9) §6.1(T12~15) §6.2(T11·T15) §6.3(T11) §6.4(T12 경고·T9 빈/단독) §6.5(isUsed 메타 — T2 타입 주석+T12 칩) §7(T3~T9 테스트) §8(T15 면책·T16 README) §9(T1·T16) — 전 항목 매핑 완료.
- **타입 일관성**: `costAt()`은 `snapshot.ts` 소속 (의존 순환 방지: snapshot → tax → costAt → pmt/resale). `financials/sunkAt/vatRefundCumEach/exitOptionsAt`은 `costAt.ts` 소속. UI는 전부 `@/` alias 사용 (vitest alias는 Task 11 Step 4).
- **알려진 트레이드오프**: UI 단위 테스트 없음(빌드+스모크로 대체), 초기 항목 3개는 설계 결정(§6.3 주석), recharts 만기 후 점선은 시리즈 분할 방식.
- **§6.4 "단독 분석 모드" 해석**: 항목 1개일 때 시나리오 탭만 숨긴다. 종합 탭의 "최적 시점 판정"과 상세 분해는 단독 항목에도 유의미하므로 유지 — 스펙 문구("시점별·세금 탭만")보다 완화한 의도적 결정.




