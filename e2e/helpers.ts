import { Page, expect } from '@playwright/test'

export const e2eEmail = process.env.E2E_EMAIL
export const e2ePassword = process.env.E2E_PASSWORD
export const hasE2eAuth = !!(e2eEmail && e2ePassword)

/** Desktop viewport so sidebar nav aria-labels are available. */
export const desktop = { viewport: { width: 1280, height: 800 } }

export async function signIn(page: Page) {
  if (!e2eEmail || !e2ePassword) throw new Error('E2E_EMAIL / E2E_PASSWORD required')
  await page.goto('/auth/signin')
  await page.getByLabel('Email').fill(e2eEmail)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/auth\/signin/, { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Chat' })).toBeVisible({ timeout: 20_000 })
}
