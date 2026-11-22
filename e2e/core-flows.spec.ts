import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'Chargement' })).toHaveCount(0)
})

async function openDirectory(page: import('@playwright/test').Page) {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Employés' }).click()
  await expect(page.getByRole('heading', { name: 'Annuaire des employés' })).toBeVisible()
}

test('Ventes et En accueil affichent seulement Nicolas Gagnon', async ({ page }) => {
  await openDirectory(page)
  await page.getByLabel('Filtrer par département').selectOption({ label: 'Ventes' })
  await page.getByLabel('Filtrer par statut').selectOption({ label: 'En accueil' })
  const rows = page.locator('.employee-table tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Nicolas Gagnon')
})

test('créer un employé l’ajoute à l’annuaire', async ({ page }) => {
  await openDirectory(page)
  await page.getByRole('button', { name: 'Nouvel employé' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Prénom').fill('Élodie')
  await dialog.getByLabel('Nom', { exact: true }).fill('Testeuse')
  await dialog.getByLabel('Courriel professionnel').fill(`elodie.testeuse.${Date.now()}@exemple.ca`)
  await dialog.getByLabel('Poste').fill('Analyste QA')
  await dialog.getByLabel('Lieu de travail').fill('À distance')
  await dialog.getByRole('button', { name: 'Créer le profil' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Élodie Testeuse — profil enregistré.' })).toBeVisible()
  await page.getByRole('button', { name: 'Fermer la fiche' }).click()
  await page.getByLabel('Rechercher un employé').fill('Testeuse')
  await expect(page.locator('.employee-table tbody tr')).toContainText(['Élodie Testeuse'])
})

test('terminer une tâche d’accueil met à jour le compteur', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Accueil' }).click()
  const counter = page.locator('.task-counter')
  const before = Number((await counter.innerText()).split('/')[0])
  await page.getByRole('button', { name: /^Terminer / }).first().click()
  await expect(counter).toHaveText(new RegExp(`^${before + 1}/`))
})
