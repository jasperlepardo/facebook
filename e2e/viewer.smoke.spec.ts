import { test, expect } from '@playwright/test'
import { desktop, hasE2eAuth, signIn } from './helpers'

test.describe('viewer smoke', () => {
  test.skip(!hasE2eAuth, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke')
  test.use(desktop)

  test('password sign-in reaches the archive shell', async ({ page }) => {
    await signIn(page)
  })

  test('media pane opens Photos tab', async ({ page }) => {
    await signIn(page)

    // Open first chat thread if media button not already available
    const media = page.getByRole('button', { name: 'Media' })
    if (!(await media.isVisible().catch(() => false))) {
      await page.locator('[data-testid^="list-item-"]').first().click()
      await expect(media).toBeVisible({ timeout: 15_000 })
    }

    await media.click()
    await expect(page.getByRole('button', { name: /Photos/i }).or(page.getByText('Photos', { exact: true }))).toBeVisible({ timeout: 10_000 })
  })

  test('hashtags Messages tab and jump to chat', async ({ page }) => {
    await signIn(page)

    await page.getByRole('button', { name: 'Hashtags' }).click()
    await expect(page.getByRole('heading', { name: 'Hashtags' })).toBeVisible({ timeout: 10_000 })

    const tag = page.locator('[data-testid^="list-item-"]').first()
    await expect(tag).toBeVisible({ timeout: 15_000 })
    await tag.click()

    // Detail: Messages tab
    await page.getByRole('button', { name: 'Messages', exact: true }).click()

    const jump = page.getByRole('button', { name: '→ Jump' }).first()
    const empty = page.getByText(/No messages tagged yet|No messages match/i)

    // Either tagged messages exist (jump) or empty state — both are valid smoke outcomes
    await expect(jump.or(empty)).toBeVisible({ timeout: 20_000 })

    if (await jump.isVisible().catch(() => false)) {
      await jump.click()
      await expect(page).toHaveURL(/[?&]msg=/, { timeout: 15_000 })
      await expect(page.getByRole('button', { name: 'Media' })).toBeVisible({ timeout: 10_000 })
    }
  })
})
