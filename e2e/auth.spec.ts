import { expect, test } from '@playwright/test'

test('un mauvais mot de passe affiche une erreur générique', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Courriel').fill('camille.fortin@example.test')
  await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toHaveText('Courriel ou mot de passe invalide.')
  await expect(page.getByLabel('Mot de passe')).toHaveValue('')
})

test('la session vit dans un cookie HttpOnly et SameSite=Strict, puis la déconnexion la révoque', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Utiliser ce compte' }).click()
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /Vue d.ensemble/ })).toBeVisible()

  const session = (await context.cookies()).find((cookie) => cookie.name.endsWith('peopleflow_session'))
  expect(session).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' })
  expect(await page.evaluate(() => document.cookie)).not.toContain('peopleflow_session')

  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  const response = await page.request.get('/api/employees', {
    headers: { Cookie: `${session!.name}=${session!.value}` },
  })
  expect(response.status()).toBe(401)
})

test("l'API refuse tout accès sans session", async ({ request }) => {
  expect((await request.get('/api/employees')).status()).toBe(401)
  expect((await request.get('/api/health')).status()).toBe(200)
})
