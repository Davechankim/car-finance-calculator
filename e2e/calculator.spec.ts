import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText(
    '입력 내용이 이 브라우저에 자동 저장되었습니다.',
  );
});

test('기본 비교 결과를 표시하고 키보드로 결과 탭을 이동한다', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: '🚗 자동차 금융 비교 계산기' }),
  ).toBeVisible();

  const summaryTab = page.getByRole('tab', { name: /종합/ });
  const timelineTab = page.getByRole('tab', { name: /시점별/ });
  const resultPanel = page.getByRole('tabpanel');

  await expect(summaryTab).toHaveAttribute('aria-selected', 'true');
  await expect(resultPanel).toContainText('48개월 동일 보유기간 기준 최적');

  await summaryTab.focus();
  await summaryTab.press('ArrowRight');

  await expect(timelineTab).toBeFocused();
  await expect(timelineTab).toHaveAttribute('aria-selected', 'true');
  await expect(
    resultPanel.getByRole('heading', { name: /시점별 실질순비용/ }),
  ).toBeVisible();
});

test('차량 입력을 변경하면 결과와 자동 저장 데이터가 함께 갱신된다', async ({ page }) => {
  const firstItem = page.getByRole('button', { name: /^1\. 장기렌트/ });
  await firstItem.click();

  const firstItemRegion = page.getByRole('region', { name: /^1\. 장기렌트/ });
  await firstItemRegion.getByLabel('차량명 (선택)').fill('테스트카');
  await firstItemRegion
    .getByLabel(/차량 가격 \(1대/)
    .fill('55000000');

  await expect(firstItem).toContainText('테스트카');
  await expect(page.getByRole('tabpanel')).toContainText('장기렌트 · 테스트카');

  await page.waitForTimeout(400);
  await page.reload();

  await expect(
    page.getByRole('button', { name: /^1\. 장기렌트 · 테스트카/ }),
  ).toBeVisible();
});

test('월납 구성요소를 분리해 총액과 금융 월납을 따로 표시하고 저장한다', async ({ page }) => {
  const firstItem = page.getByRole('button', { name: /^1\. 장기렌트/ });
  await firstItem.click();
  const region = page.getByRole('region', { name: /^1\. 장기렌트/ });

  await region
    .getByLabel('월 차량대금·렌트료 (1대당 · 0 = 자동계산)')
    .fill('700000');
  await region.getByLabel('월 서비스·기타 수수료').fill('200000');
  await region.getByLabel('월 보험료 포함분').fill('100000');
  await region.getByLabel('보험료 (연)').fill('1200000');

  await expect(region).toContainText('실제 총 월 현금납입은 100만원입니다.');
  await expect(region).toContainText(
    '보험 비용이 월납 포함분과 별도 연간비용에 모두 입력되어 중복 합산됩니다.',
  );
  await expect(page.getByRole('tabpanel')).toContainText(
    '장기렌트 총 월납 100만원 (금융·차량대금 70만원)',
  );

  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForTimeout(300);
  const restoredButton = page.getByRole('button', { name: /^1\. 장기렌트/ });
  await restoredButton.click();
  await expect(restoredButton).toHaveAttribute('aria-expanded', 'true');
  const restored = page.getByRole('region', { name: /^1\. 장기렌트/ });
  await expect(restored.getByLabel('월 서비스·기타 수수료')).toHaveValue('200,000');
});

test('승인 세법기간과 VAT 과세유형을 명시하고 v3 규칙 ID를 저장한다', async ({ page }) => {
  await expect(
    page.getByRole('group', { name: '부가세 과세유형' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '남은 승인기간 12개월만' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('계산·차량 사용 시작일').fill('2026-07-28');
  await expect(
    page.getByRole('button', { name: '남은 승인기간 5.1개월만' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: /세금/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('5.1개월 기준');
  await expect(page.getByRole('tabpanel')).toContainText(
    '입력 시작일부터 남은 5.1개월까지만 적용',
  );
  await expect(page.getByRole('tabpanel')).not.toContainText('5.129032258');

  await page.getByRole('button', { name: '이후에도 동일 가정' }).click();
  await expect(page.getByText(
    '2026 승인 규칙이 이후에도 바뀌지 않는다는 시나리오입니다.',
  )).toBeVisible();

  await page.waitForTimeout(400);
  const envelope = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('car-finance-calculator:comparison:v1') ?? '{}',
  ));
  expect(envelope.version).toBe(3);
  expect(envelope.taxRuleSetId).toBe('KR-2026-car-finance');
  expect(envelope.state.common.taxRuleHorizon).toBe('assumeUnchanged');
  expect(envelope.state.common.taxStartDate).toBe('2026-07-28');
});

test('운용리스 정비비 대체규칙과 VAT 없는 취득가격을 명시적으로 선택한다', async ({
  page,
}) => {
  const operatingLease = page.getByRole('button', { name: /^2\. 운용리스/ });
  await operatingLease.click();
  const operatingLeaseRegion = page.getByRole('region', { name: /^2\. 운용리스/ });
  const knownMaintenance = operatingLeaseRegion.getByRole('checkbox', {
    name: '계약서에서 정비비 구분 가능',
  });
  await expect(operatingLeaseRegion.getByText(
    '정비비 미구분: 보험·자동차세 차감 후 7% 적용',
  )).toBeVisible();
  await operatingLeaseRegion.getByLabel('월 정비비 포함분').fill('100000');
  await expect(operatingLeaseRegion.getByText(
    '입력한 월 정비비는 현금흐름에만 반영됩니다. 세무 계산에는 입력액 대신 보험·자동차세 차감 후 7% 대체규칙을 적용합니다.',
  )).toBeVisible();
  await knownMaintenance.check();
  await expect(operatingLeaseRegion.getByText(
    '입력한 월 정비비는 현금흐름에만 반영됩니다. 세무 계산에는 입력액 대신 보험·자동차세 차감 후 7% 대체규칙을 적용합니다.',
  )).toHaveCount(0);

  const installment = page.getByRole('button', { name: /^3\. 할부/ });
  await installment.click();
  const installmentRegion = page.getByRole('region', { name: /^3\. 할부/ });
  await installmentRegion.getByRole('checkbox', {
    name: '입력 가격에 VAT 포함',
  }).uncheck();
  await expect(installmentRegion.getByLabel(/차량 가격 \(1대 · VAT 없음\)/))
    .toBeVisible();
});

test('매각 VAT 토글은 실제 매각 출구에만 노출되고 결과에 반영된다', async ({ page }) => {
  const saleVatName = '과세사업용 자산 (매각 시 매출 VAT)';
  await page.getByRole('button', { name: '이후에도 동일 가정' }).click();

  const rent = page.getByRole('button', { name: /^1\. 장기렌트/ });
  await rent.click();
  const rentRegion = page.getByRole('region', { name: /^1\. 장기렌트/ });
  await expect(rentRegion.getByRole('checkbox', { name: saleVatName })).toHaveCount(0);

  const operatingLease = page.getByRole('button', { name: /^2\. 운용리스/ });
  await operatingLease.click();
  const operatingLeaseRegion = page.getByRole('region', { name: /^2\. 운용리스/ });
  const saleVat = operatingLeaseRegion.getByRole('checkbox', { name: saleVatName });
  await expect(saleVat).toBeChecked();

  const operatingLeaseCost = page
    .getByRole('tabpanel')
    .locator('.bar-row')
    .filter({ hasText: '2. 운용리스' })
    .locator('.bar-val');
  const costWithSaleVat = await operatingLeaseCost.innerText();
  await saleVat.uncheck();
  await expect(operatingLeaseRegion.getByText('매각 시 VAT를 차감하지 않음')).toBeVisible();
  await expect(operatingLeaseCost).not.toHaveText(costWithSaleVat);

  await page.getByRole('button', { name: '간이과세', exact: true }).click();
  await expect(saleVat).toBeVisible();
  await saleVat.check();
  await expect(operatingLeaseRegion.getByText(
    '매각 VAT는 선택한 업종별 간이과세 산식으로 추정합니다.',
  )).toBeVisible();

  await page.getByRole('button', { name: '겸영·불확실', exact: true }).click();
  await expect(operatingLeaseRegion.getByText(
    '겸영·불확실 매각 VAT는 과소계상 방지를 위해 일반세율 (부가세 포함가의 10/110) 보수값을 적용합니다.',
  )).toBeVisible();

  await page.getByRole('button', { name: '면세', exact: true }).click();
  await expect(operatingLeaseRegion.getByRole(
    'checkbox',
    { name: saleVatName },
  )).toHaveCount(0);

  await page.getByRole('button', { name: '간이과세', exact: true }).click();
  await page.getByRole('button', { name: '법인', exact: true }).click();
  await expect(page.getByRole('button', { name: '일반과세', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '간이과세', exact: true }))
    .toHaveCount(0);
});

test('프로젝트 가져오기는 중복 접근성 제어 없이 파일 선택기를 연다', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Choose File' })).toHaveCount(0);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '가져오기', exact: true }).click();
  const fileChooser = await fileChooserPromise;
  expect(fileChooser.isMultiple()).toBe(false);
});

test('다른 세법 버전의 저장 입력을 복구하고 확인 전 원본 자동저장을 멈춘다', async ({
  page,
}) => {
  const oldEnvelope = await page.evaluate(() => {
    const key = 'car-finance-calculator:comparison:v1';
    const envelope = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    envelope.taxRuleSetId = 'KR-2025-car-finance';
    envelope.state.items[0].vehicle.name = '복구차량';
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return envelope;
  });
  await page.reload();

  await expect(page.getByRole('status')).toContainText(
    '이전 세법 규칙(KR-2025-car-finance)의 입력을 복구했습니다.',
  );
  await expect(page.getByRole('button', { name: /^1\. 장기렌트 · 복구차량/ }))
    .toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('car-finance-calculator:comparison:v1') ?? '{}',
  ).taxRuleSetId)).toBe(oldEnvelope.taxRuleSetId);

  await page.getByRole('button', { name: '현재 세법으로 저장' }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('car-finance-calculator:comparison:v1') ?? '{}',
  ).taxRuleSetId)).toBe('KR-2026-car-finance');
});

test('비교 항목을 추가하고 복제한 뒤 삭제할 수 있다', async ({ page }) => {
  await page.getByRole('button', { name: '금융리스', exact: true }).click();

  const addedItem = page.getByRole('button', { name: /^4\. 금융리스/ });
  await expect(addedItem).toBeVisible();
  await addedItem.click();

  const addedItemRegion = page.getByRole('region', { name: /^4\. 금융리스/ });
  await addedItemRegion
    .getByRole('button', { name: '금융리스 복제' })
    .click();

  await expect(page.getByRole('button', { name: /^5\. 금융리스/ })).toBeVisible();

  await addedItemRegion
    .getByRole('button', { name: '금융리스 삭제' })
    .click();

  await expect(page.getByRole('button', { name: /^5\. 금융리스/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^4\. 금융리스/ })).toBeVisible();
});

test('가이드와 개인정보처리방침을 전역 내비게이션에서 열 수 있다', async ({ page }) => {
  await page.getByRole('link', { name: '사용 가이드' }).click();
  await expect(page.getByRole('heading', {
    name: '월납액보다 먼저 “언제까지 보유할지” 정하세요',
  })).toBeVisible();

  await page.getByRole('link', { name: '개인정보처리방침' }).click();
  await expect(page.getByRole('heading', {
    name: '계산 입력은 기본적으로 이용자의 브라우저에만 남습니다',
  })).toBeVisible();
});

test('기본 릴리스 설정은 광고 스크립트·meta·슬롯·ads.txt를 모두 닫는다', async ({
  page,
  request,
}) => {
  await expect(
    page.locator('script[src*="pagead2.googlesyndication.com"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('meta[name="google-adsense-account"]'),
  ).toHaveCount(0);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);

  const adsTxt = await request.get('/ads.txt');
  expect(adsTxt.status()).toBe(404);
  expect(await adsTxt.text()).not.toContain('pub-');
});

test('모바일 폭에서 핵심 계산 UI가 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '🚗 자동차 금융 비교 계산기' }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: /^1\. 장기렌트/ })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toBeVisible();
});
