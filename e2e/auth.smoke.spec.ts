import { test, expect } from '@playwright/test'

test.describe('auth smoke', () => {
  test('unauthenticated home redirects to sign in', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/auth\/signin/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('sign in page shows email/password form', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  })

  test('private API rejects unauthenticated requests', async ({ request }) => {
    const res = await request.get('/api/messages?limit=1')
    expect(res.status()).toBe(401)
  })
})
