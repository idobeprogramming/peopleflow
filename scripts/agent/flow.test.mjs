import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canAutoMerge, classifyFailure, cleanLog, CODE_STEPS, commentIntent, contextChanged, decideReview, DOWNLOAD_STEPS,
  failingTests, findState, followupUrl, issueFromBranch, linkedPull, planRun, recordFailure, renderHandoff, renderReview,
  renderState, SECURITY_STEPS, snapshotContext,
} from './flow.mjs'

const issue = { number: 12, title: 'Rapport', body: 'Ajouter', state: 'open', user: { login: 'auteur' }, labels: [] }
const waiting = { ...issue, labels: [{ name: 'needs-info' }] }
const says = (login, body, id = 1, type = 'User') => ({ id, body, user: { login, type } })
const intent = (over) => commentIntent({
  issue: waiting, comment: says('auteur', 'Oui'), permission: 'read', authorized: true, issueAuthor: 'auteur', ...over,
})

test('une réponse de l’auteur ou d’un collaborateur relance une issue autorisée', () => {
  assert.equal(intent({}), 'resume')
  assert.equal(intent({ comment: says('collegue', 'Oui'), permission: 'write' }), 'resume')
})

test('inconnu, bot, issue non autorisée ou sans needs-info : aucun lancement', () => {
  assert.equal(intent({ comment: says('inconnu', 'Oui') }), null)
  assert.equal(intent({ comment: says('x[bot]', 'Oui', 1, 'Bot'), permission: 'admin' }), null)
  assert.equal(intent({ authorized: false }), null)
  assert.equal(intent({ issue }), null)
  assert.equal(intent({ issue, comment: says('auteur', '/agent update') }), null)
  assert.equal(intent({ issue, comment: says('collegue', '/agent updatefoo'), permission: 'write' }), null)
})

test('/agent update demande le droit d’écriture; /agent fix reste réservé aux PR', () => {
  const comment = says('collegue', '/agent update inclure les inactifs')
  assert.equal(intent({ issue, comment, permission: 'write' }), 'update')
  const fix = says('collegue', '/agent fix')
  assert.equal(intent({ issue, comment: fix, permission: 'write' }), null)
  assert.equal(intent({ issue: { ...issue, pull_request: {} }, comment: fix, permission: 'write' }), 'update')
})

test('l’état survit à l’aller-retour et ne se falsifie pas', () => {
  const state = { authorizedBy: 'a', attempts: [{ tried: '--> <b>' }] }
  const body = renderState(state)
  const bot = { id: 9, body, user: { login: 'github-actions[bot]' } }
  assert.deepEqual(findState([bot]), { id: 9, state })
  assert.equal(findState([{ ...bot, user: { login: 'inconnu' } }]), null)
  assert.equal(findState([{ ...bot, body: `Texte\n${body}` }]), null)
})

test('commentaire, modification ou corps réécrit changent le contexte; bots et inconnus non', () => {
  const read = (comments, over) => snapshotContext({ ...issue, ...over }, comments, { trusted: ['collegue'] })
  const before = read([says('auteur', 'a', 1)])
  assert.equal(before.lastCommentId, 1)
  assert.equal(contextChanged(before, read([says('auteur', 'a', 1), says('inconnu', 'x', 2), says('github-actions[bot]', 'y', 3)])), false)
  assert.equal(contextChanged(before, read([says('auteur', 'a', 1), says('collegue', 'b', 2)])), true)
  assert.equal(contextChanged(before, read([says('auteur', 'modifié', 1)])), true)
  assert.equal(contextChanged(before, read([says('auteur', 'a', 1)], { body: 'Autre' })), true)
})

const pull = (number, over = {}) => ({
  number, state: 'open', merged_at: null, user: { login: 'peopleflow-agent[bot]' }, base: { ref: 'staging' },
  head: { ref: `agent/issue-12-rapport-${number}`, sha: 'abc', repo: { full_name: 'o/r' } }, ...over,
})

test('la PR liée est trouvée par sa branche, ouverte d’abord, jamais depuis un fork', () => {
  assert.equal(issueFromBranch('agent/issue-12-x-9'), 12)
  assert.equal(issueFromBranch('feature/issue-12-x'), null)
  const merged = pull(5, { state: 'closed', merged_at: 'date' })
  assert.equal(linkedPull([merged, pull(7)], 12, 'o/r').pull.number, 7)
  assert.equal(linkedPull([merged], 12, 'o/r').status, 'merged')
  assert.equal(linkedPull([pull(6, { state: 'closed' })], 12, 'o/r').status, 'none')
  assert.equal(linkedPull([pull(7, { head: { ...pull(7).head, repo: { full_name: 'x/r' } } })], 12, 'o/r').status, 'none')
  assert.equal(linkedPull([pull(7)], 1, 'o/r').status, 'none')
})

const snapshot = snapshotContext(issue, [])
const plan = (over) => planRun({
  mode: 'start', state: { authorizedBy: 'a', lastRun: 10, snapshot: null }, issue, snapshot,
  link: { status: 'none', pull: null }, ...over,
})

test('le plan garde une seule PR par issue', () => {
  const open = { status: 'open', pull: pull(7) }
  const merged = { status: 'merged', pull: pull(7) }
  assert.equal(plan({}).path, 'triage')
  assert.equal(plan({ link: open }).path, 'fix')
  assert.equal(plan({ mode: 'update', link: merged }).path, 'followup')
  assert.equal(plan({ mode: 'correct', link: merged }).path, 'stop')
  assert.equal(plan({ state: null }).path, 'stop')
  assert.equal(plan({ issue: { ...issue, state: 'closed' } }).path, 'stop')
})

test('le plan ignore un travail déjà lu ou remplacé', () => {
  assert.equal(plan({ mode: 'update', state: { authorizedBy: 'a', snapshot } }).path, 'stop')
  assert.equal(plan({ mode: 'correct', seedRun: '9' }).path, 'stop')
  assert.equal(plan({ mode: 'correct', seedRun: '10' }).path, 'fix')
  assert.equal(plan({ mode: 'correct', headSha: 'vieux', link: { status: 'open', pull: pull(7) } }).path, 'stop')
  assert.equal(plan({ mode: 'correct' }).path, 'stop')
})

test('l’issue de suivi proposée renvoie à l’originale', () => {
  const url = new URL(followupUrl({ server: 'https://github.com', repo: 'o/r', issue, pull: pull(7), request: 'Ajouter & trier' }))
  assert.match(url.searchParams.get('body'), /Suite de #12 \(livrée par #7\)[\s\S]*Ajouter & trier/)
})

const job = (step, conclusion = 'failure') => [{ name: 'J', conclusion, url: 'u', steps: [{ name: step, conclusion: 'failure' }] }]
const kind = (step, log, runAttempt) => classifyFailure({ jobs: job(step), log, runAttempt }).kind

test('chaque erreur va à qui peut la résoudre', () => {
  assert.equal(kind('Tests unitaires', 'FAIL  a.test.ts > x'), 'code')
  assert.equal(kind('Typage', 'a.ts(1,2): error TS2322: x'), 'code')
  assert.equal(kind('Tests unitaires', 'permission denied for table; connect ECONNREFUSED'), 'code')
  assert.equal(kind('Run npm ci', 'npm error ECONNRESET'), 'transient')
  assert.equal(kind('Run npm ci', 'npm error code EUSAGE'), 'code')
  assert.equal(kind('Démarrer Supabase (migrations + seed)', 'ERROR: syntax error (SQLSTATE 42601)'), 'code')
  assert.equal(kind('Démarrer Supabase (migrations + seed)', 'toomanyrequests: rate'), 'transient')
  assert.equal(kind('Run npm ci', 'npm error ECONNRESET', 2), 'maintainer')
  assert.equal(kind('Créer la branche et la PR', 'HTTP 403: Resource not accessible by integration'), 'maintainer')
  assert.equal(kind('gitleaks sur l\'arbre de travail', 'ECONNRESET'), 'maintainer')
  assert.equal(kind('Étape inconnue', 'bizarre'), 'maintainer')
  assert.equal(classifyFailure({ jobs: [], log: '' }).kind, 'maintainer')
})

test('les étapes connues existent encore dans checks.yml', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/checks.yml', import.meta.url), 'utf8')
  for (const step of [...CODE_STEPS, ...DOWNLOAD_STEPS, ...SECURITY_STEPS]) {
    const name = step.replace(/^Run /, '')
    assert.ok(yaml.includes(`name: ${name}`) || yaml.includes(`run: ${name}`), `étape absente de checks.yml : ${step}`)
  }
})

test('le même test en échec garde la même empreinte malgré temps et messages', () => {
  const log = (ms, message) => `CI\tTests unitaires\t2026-11-23T10:00:00.000Z  FAIL  src/a.test.ts > somme ${ms}ms\nCI\tTests unitaires\t2026-11-23T10:00:00.000Z ${message}`
  const a = classifyFailure({ jobs: job('Tests unitaires'), log: log(12, 'attendu 1') })
  const b = classifyFailure({ jobs: job('Tests unitaires'), log: log(90, 'attendu 2') })
  assert.deepEqual(a.tests, ['src/a.test.ts > somme'])
  assert.equal(a.fingerprint, b.fingerprint)
  const other = classifyFailure({ jobs: job('Tests unitaires'), log: 'FAIL  src/b.test.ts > autre' })
  assert.notEqual(a.fingerprint, other.fingerprint)
  assert.deepEqual(failingTests('✖ filtre combiné (1.2ms)\n✖ failing tests:'), ['filtre combiné'])
  const colour = `${String.fromCharCode(27)}[31m`
  assert.equal(cleanLog(`J\tS\t2026-11-23T10:00:00.0Z ${colour}rouge`), 'rouge')
})

test('deux corrections du même problème, puis une personne', () => {
  const fail = (state, over) => recordFailure(state, { fingerprint: 'f', run: 1, ...over })
  const one = fail({})
  const two = fail(one.state, { tried: 'Premier essai' })
  const three = fail(two.state, { tried: 'Deuxième essai' })
  assert.deepEqual([one.allowed, two.allowed, three.allowed], [true, true, false])
  const text = renderHandoff({ state: three.state, reason: 'Échec.', tests: ['a.test.ts'], url: 'https://run', maintainer: 'm' })
  assert.match(text, /@m[\s\S]*1\. Premier essai\n2\. Deuxième essai[\s\S]*a\.test\.ts[\s\S]*https:\/\/run/)
})

test('un échec qui se déplace sans cesse finit aussi chez une personne', () => {
  let state = {}
  for (const fingerprint of ['a', 'b', 'c', 'd']) state = recordFailure(state, { fingerprint, run: 1 }).state
  assert.equal(recordFailure(state, { fingerprint: 'e', run: 1 }).allowed, false)
})

const review = {
  verdict: 'pass', summary: 'ok', criteria: [{ criterion: 'c', covered: true, test: 't' }], findings: [], testWeakened: false, question: '',
}

test('la revue donne conforme, correction ou décision humaine', () => {
  assert.equal(decideReview(review).verdict, 'pass')
  assert.equal(decideReview({ ...review, verdict: 'fix', findings: [{ file: 'a', description: 'b' }] }).verdict, 'fix')
  assert.equal(decideReview({ ...review, verdict: 'human', question: 'Inactifs inclus ?' }).question, 'Inactifs inclus ?')
  assert.equal(decideReview({ ...review, verdict: 'fix' }).verdict, 'human')
})

test('la revue bloque un test affaibli, un critère non couvert et un verdict illisible', () => {
  const weakened = decideReview({ ...review, testWeakened: true })
  assert.equal(weakened.verdict, 'human')
  assert.match(renderReview(weakened), /Fusion bloquée/)
  assert.equal(decideReview(review, { weakenedTests: ['Assertion retirée'] }).verdict, 'human')
  assert.equal(decideReview({ ...review, criteria: [{ criterion: 'c', covered: false }] }).verdict, 'fix')
  assert.equal(decideReview('non').verdict, 'invalid')
  assert.equal(decideReview({ verdict: 'pass' }).verdict, 'invalid')
  assert.equal(decideReview({ ...review, criteria: [] }).verdict, 'invalid')
})

test('la fusion automatique vise seulement la démo, après CI et revue réussies', () => {
  const demo = pull(7, { base: { ref: 'demo/broken-directory-filters' } })
  const merge = (over) => canAutoMerge({ pull: demo, repo: 'o/r', ci: 'success', review: 'success', appLogin: 'peopleflow-agent[bot]', ...over })
  assert.equal(merge({}), true)
  assert.equal(merge({ pull: pull(7) }), false)
  assert.equal(merge({ ci: 'failure' }), false)
  assert.equal(merge({ review: undefined }), false)
  assert.equal(merge({ labels: ['needs-human'] }), false)
  assert.equal(merge({ pull: { ...demo, user: { login: 'autre' } } }), false)
  assert.equal(merge({ appLogin: '' }), false)
  assert.equal(merge({ enabled: false }), false)
})
