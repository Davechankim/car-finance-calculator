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
    .getByLabel('차량 가격 (1대, 부가세 포함)')
    .fill('55000000');

  await expect(firstItem).toContainText('테스트카');
  await expect(page.getByRole('tabpanel')).toContainText('장기렌트 · 테스트카');

  await page.waitForTimeout(400);
  await page.reload();

  await expect(
    page.getByRole('button', { name: /^1\. 장기렌트 · 테스트카/ }),
  ).toBeVisible();
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
