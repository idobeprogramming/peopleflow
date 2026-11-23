// End-to-end scenarios of the delivery loop against an in-memory GitHub.
import assert from 'node:assert/strict'
import test from 'node:test'
import { findState } from './flow.mjs'
import {
  askAuthor, checkFresh, loadContext, onComment, onLabel, onPublished, onRun, prepareRun, renderChanges,
} from './router.mjs'

const DEMO = 'demo/broken-directory-filters'

function fakeGitHub({ title = 'Rapport', runs = {}, latest = {} } = {}) {
  let nextId = 100
  const issue = { number: 12, title, body: 'Ajouter', state: 'open', user: { login: 'auteur' }, labels: [] }
  const threads = { 12: [] }
  const labels = {}
  const calls = { dispatch: [], reruns: [], merged: [] }
  const pulls = []
  const bot = { login: 'github-actions[bot]', type: 'Bot' }
  const say = (number, login, body) => {
    const comment = { id: nextId++, body, user: { login, type: 'User' }, created_at: 'd' }
    ;(threads[number] ??= []).push(comment)
    return comment
  }
  const named = (number) => (labels[number] ? [{ name: labels[number] }] : [])
  const api = {
    repo: 'o/r', server: 'https://github.com', maintainer: 'chef', baseBranch: 'staging',
    appLogin: 'peopleflow-agent[bot]', demoAutoMerge: true,
    runUrl: (id) => `https://run/${id}`,
    permission: async (login) => ({ chef: 'admin', collegue: 'write' }[login] ?? 'read'),
    issue: async () => ({ ...issue, labels: named(12) }),
    comments: async (number) => threads[number] ?? [],
    reviewComments: async () => [],
    pulls: async () => pulls.map((pull) => ({ ...pull, labels: named(pull.number) })),
    pull: async (number) => pulls.find((pull) => pull.number === number),
    branchSha: async () => 'base000',
    saveState: async (number, id, body) => {
      const existing = threads[number].find((item) => item.id === id)
      if (existing) existing.body = body
      else threads[number].push({ id: (id = nextId++), body, user: bot })
      return id
    },
    comment: async (number, body) => { (threads[number] ??= []).push({ id: nextId++, body, user: bot, created_at: 'd' }) },
    setStatus: async (number, label) => { labels[number] = label },
    dispatch: async (inputs) => { calls.dispatch.push(inputs) },
    jobs: async (id) => runs[id]?.jobs ?? [],
    log: async (id) => runs[id]?.log ?? '',
    report: async (id) => runs[id]?.report ?? null,
    review: async (id) => runs[id]?.review ?? null,
    latestRun: async (file) => latest[file],
    rerunFailed: async (id) => { calls.reruns.push(id) },
    rerun: async (id) => { calls.reruns.push(id) },
    merge: async (number, sha) => { calls.merged.push([number, sha]) },
  }
  const openPull = (base = 'staging', sha = 'head1') => pulls.push({
    number: 30, state: 'open', merged_at: null, user: { login: 'peopleflow-agent[bot]' }, base: { ref: base },
    head: { ref: 'agent/issue-12-rapport-1', sha, repo: { full_name: 'o/r' } }, labels: [],
  })
  return {
    api, latest, issue, threads, labels, calls, pulls, say, openPull,
    state: () => findState(threads[12]).state,
    last: (number = 12) => threads[number].filter((item) => item.user.login === bot.login).at(-1).body,
    label: () => onLabel(api, { label: { name: 'agent:ready' }, issue, sender: { login: 'chef' } }),
    event: (number, comment) => onComment(api, {
      issue: { ...issue, number, labels: named(12), ...(number === 12 ? {} : { pull_request: {} }) }, comment,
    }),
    prepare: (mode, runId, over) => prepareRun(api, { number: 12, mode, runId, ...over }),
    agentRun: (id, conclusion = 'failure') => onRun(api, {
      id, name: 'Agent d\'issue', conclusion, display_title: 'Agent d\'issue #12 (start)', run_attempt: 1, html_url: `https://run/${id}`,
    }),
    pullRun: (name, id, conclusion, over = {}) => onRun(api, {
      id, name, conclusion, event: 'pull_request', head_branch: 'agent/issue-12-rapport-1', head_sha: 'head1', run_attempt: 1, html_url: `https://run/${id}`, ...over,
    }),
  }
}

const redTest = {
  jobs: [{ name: 'Tests', conclusion: 'failure', url: 'https://job/1', steps: [{ name: 'Tests unitaires', conclusion: 'failure' }] }],
  log: 'FAIL  src/a.test.ts > somme', report: { summary: 'Premier essai' },
}

test('1. question, réponse de l’auteur, reprise sans reposer le label', async () => {
  const hub = fakeGitHub()
  assert.equal(await hub.label(), 'démarré')
  assert.equal((await hub.prepare('start', 1)).path, 'triage')
  assert.equal(await askAuthor(hub.api, { number: 12, questions: ['Inclure les inactifs ?'] }), 'question')
  assert.equal(hub.labels[12], 'needs-info')
  assert.match(hub.last(), /@auteur/)

  assert.equal(await hub.event(12, hub.say(12, 'inconnu', 'Moi je dis oui')), 'ignoré')
  assert.equal(await hub.event(12, hub.say(12, 'auteur', 'Oui')), 'resume')
  assert.deepEqual(hub.calls.dispatch.at(-1), { issue: 12, mode: 'resume' })
  assert.equal((await hub.prepare('resume', 2)).path, 'triage')
  // A second queued answer that was already read does not start another run.
  assert.equal((await hub.prepare('resume', 3)).path, 'stop')
  assert.equal(hub.state().authorizedBy, 'chef')
})

test('1. une réponse arrivée pendant le triage relance sans question', async () => {
  const hub = fakeGitHub()
  await hub.label()
  await hub.prepare('start', 1)
  hub.say(12, 'auteur', 'Précision : inclure les inactifs')
  assert.equal(await askAuthor(hub.api, { number: 12, questions: ['Inclure ?'] }), 'relancé')
})

test('1. sans autorisation initiale, rien ne démarre', async () => {
  const hub = fakeGitHub()
  hub.labels[12] = 'needs-info'
  assert.equal(await hub.event(12, hub.say(12, 'auteur', 'Oui')), 'ignoré')
  assert.equal(await onLabel(hub.api, { label: { name: 'agent:ready' }, issue: hub.issue, sender: { login: 'inconnu' } }), 'inconnu n’a pas le droit d’écriture')
  assert.deepEqual(hub.calls.dispatch, [])
})

test('1. les questions sans fin finissent chez un mainteneur', async () => {
  const hub = fakeGitHub()
  await hub.label()
  await hub.prepare('start', 1)
  for (let round = 0; round < 5; round += 1) await askAuthor(hub.api, { number: 12, questions: ['?'] })
  assert.equal(await askAuthor(hub.api, { number: 12, questions: ['?'] }), 'humain')
  assert.equal(hub.labels[12], 'needs-human')
})

test('2. test rouge avant la PR : deux corrections avec patch et journal, puis une personne', async () => {
  const hub = fakeGitHub({ runs: { 1: redTest, 2: { ...redTest, report: { summary: 'Essai A' } }, 3: { ...redTest, report: { summary: 'Essai B' } } } })
  await hub.label()
  await hub.prepare('start', 1)
  assert.equal(await hub.agentRun(1), 'correction')
  assert.deepEqual(hub.calls.dispatch.at(-1), { issue: 12, mode: 'correct', seed_run: 1, log_run: 1 })
  assert.equal(await hub.agentRun(1), 'déjà traité')
  assert.equal((await hub.prepare('correct', 2, { seedRun: '1' })).path, 'fix')
  assert.equal(await hub.agentRun(2), 'correction')
  await hub.prepare('correct', 3, { seedRun: '2' })
  assert.equal(await hub.agentRun(3), 'humain')
  assert.equal(hub.labels[12], 'needs-human')
  assert.match(hub.last(), /1\. Essai A\n2\. Essai B[\s\S]*src\/a\.test\.ts > somme[\s\S]*https:\/\/job\/1/)
})

test('2. panne réseau : un seul nouvel essai, sans Claude', async () => {
  const jobs = [{ name: 'Tests', conclusion: 'failure', url: 'u', steps: [{ name: 'Run npm ci', conclusion: 'failure' }] }]
  const hub = fakeGitHub({ runs: { 1: { jobs, log: 'ECONNRESET' }, 9: { jobs, log: 'ECONNRESET' } } })
  await hub.label()
  await hub.prepare('start', 1)
  assert.equal(await hub.agentRun(1), 'nouvel essai')
  hub.openPull()
  assert.equal(await hub.pullRun('CI', 9, 'failure', { run_attempt: 2 }), 'mainteneur')
  assert.deepEqual(hub.calls.reruns, [1])
  assert.equal(hub.calls.dispatch.length, 1)
})

test('2. permission refusée ou exécution annulée : mainteneur tout de suite', async () => {
  const denied = { jobs: [{ name: 'Publication', conclusion: 'failure', url: 'u', steps: [{ name: 'PR', conclusion: 'failure' }] }], log: 'HTTP 403' }
  const hub = fakeGitHub({ runs: { 1: denied } })
  await hub.label()
  await hub.prepare('start', 1)
  assert.equal(await hub.agentRun(1), 'mainteneur')
  assert.match(hub.last(), /@chef/)
  assert.equal(await hub.agentRun(99, 'cancelled'), 'remplacé')
})

test('2. secret absent : mainteneur avant tout travail', async () => {
  const hub = fakeGitHub()
  await hub.label()
  assert.equal((await hub.prepare('start', 1, { missing: ['ANTHROPIC_API_KEY'] })).path, 'stop')
  assert.match(hub.last(), /@chef : il manque ANTHROPIC_API_KEY/)
})

test('3. une précision pendant le travail adapte le même correctif avant publication', async () => {
  const hub = fakeGitHub()
  await hub.label()
  await hub.prepare('start', 1)
  assert.equal(await checkFresh(hub.api, { number: 12, runId: 1 }), 'publish')
  hub.say(12, 'auteur', 'Inclure aussi les inactifs')
  assert.equal(await checkFresh(hub.api, { number: 12, runId: 1 }), 'adapt')
  assert.deepEqual(hub.calls.dispatch.at(-1), { issue: 12, mode: 'adapt', seed_run: 1 })
  const run = await hub.prepare('adapt', 2, { seedRun: '1' })
  assert.equal(run.path, 'fix')
  assert.equal(renderChanges(run.context, run.previous), '- @auteur : Inclure aussi les inactifs')
  assert.equal(await checkFresh(hub.api, { number: 12, runId: 2 }), 'publish')
  // The replaced run can no longer publish.
  assert.equal(await checkFresh(hub.api, { number: 12, runId: 1 }), 'stop')
})

test('3. /agent update et agent:ready mettent à jour la PR ouverte', async () => {
  const hub = fakeGitHub()
  await hub.label()
  await hub.prepare('start', 1)
  hub.openPull()
  await onPublished(hub.api, { number: 12, pull: 30, summary: 'Fait' })
  assert.equal(await hub.event(12, hub.say(12, 'collegue', '/agent update trier par nom')), 'update')
  const run = await hub.prepare('update', 2)
  assert.deepEqual([run.path, run.pull.number, run.baseSha], ['fix', 30, 'head1'])
  await hub.label()
  assert.equal((await hub.prepare('start', 3)).pull.number, 30)
  assert.equal(await hub.event(30, hub.say(30, 'collegue', '/agent fix le titre')), 'update')
  assert.equal((await hub.prepare('update', 4)).path, 'fix')
  assert.equal(await checkFresh(hub.api, { number: 12, runId: 4 }), 'publish')
})

test('3. après la fusion, /agent update propose une issue de suivi', async () => {
  const hub = fakeGitHub()
  await hub.label()
  hub.openPull()
  Object.assign(hub.pulls[0], { state: 'closed', merged_at: 'd' })
  hub.issue.state = 'closed'
  assert.equal(await hub.event(12, hub.say(12, 'chef', '/agent update trier par nom')), 'update')
  assert.equal((await hub.prepare('update', 2)).path, 'stop')
  assert.match(hub.last(), /issues\/new\?title=[^)]*trier/)
})

const verdict = (over) => ({
  verdict: 'fix', summary: 's', criteria: [], findings: [{ file: 'a.ts', description: 'filtre inversé' }], question: '', weakened: false, ...over,
})
async function reviewed(review, { base = 'staging', title, ci = 'success' } = {}) {
  const failed = review.verdict !== 'pass'
  const hub = fakeGitHub({
    title, runs: { 8: { review } },
    latest: {
      'ci.yml': { status: 'completed', conclusion: ci },
      'ai-review.yml': { id: 8, status: 'completed', conclusion: failed ? 'failure' : 'success', run_attempt: 1, html_url: 'https://run/8' },
    },
  })
  await hub.label()
  await hub.prepare('start', 1)
  hub.openPull(base)
  await onPublished(hub.api, { number: 12, pull: 30, summary: 'Fait' })
  return { hub, result: await hub.pullRun('Revue IA', 8, failed ? 'failure' : 'success') }
}

test('4. un défaut précis repart à Claude sur la même PR, deux fois au plus', async () => {
  const { hub, result } = await reviewed(verdict())
  assert.equal(result, 'correction')
  assert.deepEqual(hub.calls.dispatch.at(-1), { issue: 12, mode: 'review', review_run: 8, head_sha: 'head1' })
  assert.equal(await hub.pullRun('CI', 7, 'success'), 'déjà traitée')
  hub.latest['ai-review.yml'].run_attempt = 2
  assert.equal(await hub.pullRun('Revue IA', 8, 'failure'), 'correction')
  hub.latest['ai-review.yml'].run_attempt = 3
  assert.equal(await hub.pullRun('Revue IA', 8, 'failure'), 'humain')
  assert.match(hub.last(30), /filtre inversé/)
})

test('4. une ambiguïté retourne à l’auteur', async () => {
  const { hub, result } = await reviewed(verdict({ verdict: 'human', question: 'Inactifs inclus ?' }))
  assert.equal(result, 'question')
  assert.equal(hub.labels[12], 'needs-info')
  assert.match(hub.last(), /Inactifs inclus \?[\s\S]*@auteur/)
})

test('4. un test affaibli bloque et va au mainteneur, même avec une question', async () => {
  const { hub, result } = await reviewed(verdict({ verdict: 'human', weakened: true, question: 'ok ?' }), { base: DEMO })
  assert.equal(result, 'mainteneur')
  assert.equal(hub.labels[30], 'needs-human')
  assert.deepEqual(hub.calls.merged, [])
})

test('4. la fusion automatique vise seulement la démo', async () => {
  const demo = await reviewed(verdict({ verdict: 'pass', findings: [] }), { base: DEMO, title: '[démo] filtre' })
  assert.equal(demo.result, 'fusionnée')
  assert.deepEqual(demo.hub.calls.merged, [[30, 'head1']])
  const staging = await reviewed(verdict({ verdict: 'pass', findings: [] }))
  assert.equal(staging.result, 'prête pour une personne')
  const pending = await reviewed(verdict({ verdict: 'pass', findings: [] }), { base: DEMO, ci: null })
  assert.equal(pending.result, 'en attente')
})

test('4. CI rouge : correction sur la PR; commit dépassé : ignoré', async () => {
  const { hub } = await reviewed(verdict({ verdict: 'pass', findings: [] }))
  hub.api.jobs = async () => redTest.jobs
  hub.api.log = async () => redTest.log
  assert.equal(await hub.pullRun('CI', 9, 'failure'), 'correction')
  assert.deepEqual(hub.calls.dispatch.at(-1), { issue: 12, mode: 'correct', log_run: 9, head_sha: 'head1' })
  assert.equal(await hub.pullRun('CI', 9, 'failure', { head_sha: 'vieux' }), 'PR fermée ou plus récente')
})

test('le commentaire d’état n’apparaît pas dans la discussion lue par Claude', async () => {
  const hub = fakeGitHub()
  await hub.label()
  assert.deepEqual((await loadContext(hub.api, 12)).comments, [])
})
