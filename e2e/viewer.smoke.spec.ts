import { test, expect } from '@playwright/test'

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe('viewer smoke', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke')

  test('password sign-in reaches the archive shell', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel('Email').fill(email!)
    await page.getByLabel('Password').fill(password!)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).not.toHaveURL(/\/auth\/signin/, { timeout: 15_000 })
    // App shell: chat nav or thread list should be present after init
    await expect(page.getByText(/Chat|Hashtags|Settings|Story/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
