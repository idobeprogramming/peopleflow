// Pure decisions of the delivery loop: what an event means, who can resolve a failure, what
// changed since the agent last read the issue. No I/O, so every rule is unit-tested.
import { createHash } from 'node:crypto'

export const STATE_MARKER = '<!-- peopleflow-agent:state'
export const STATE_AUTHOR = 'github-actions[bot]'
export const DEMO_BRANCH = 'demo/broken-directory-filters'
export const MAX_FIXES_PER_PROBLEM = 2
// A fix that keeps moving the failure elsewhere would never exhaust the per-problem budget.
export const MAX_FIXES_TOTAL = 4
export const MAX_QUESTION_ROUNDS = 5
export const MAX_ADAPTATIONS = 3

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
export const isBot = (user) => user?.type === 'Bot' || /\[bot\]$/.test(user?.login ?? '')

export const canWrite = (permission) => ['admin', 'maintain', 'write'].includes(permission)

// ---------------------------------------------------------------- state

export function renderState(state) {
  // "<" and ">" are escaped so that no stored text can close the HTML comment.
  const json = JSON.stringify(state).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  return `${STATE_MARKER}\n${json}\n-->\n_🤖 Suivi de l’agent (géré par le workflow, ne pas modifier)._`
}

/** Only a comment by the workflow itself that starts with the marker holds the state. */
export function findState(comments) {
  for (const comment of comments) {
    if (comment.user?.login !== STATE_AUTHOR || !comment.body?.startsWith(STATE_MARKER)) continue
    try {
      return { id: comment.id, state: JSON.parse(comment.body.slice(STATE_MARKER.length, comment.body.indexOf('-->'))) }
    } catch {
      return null
    }
  }
  return null
}

/** A person (re)starts the work: the budgets start over, the authorization is kept or set. */
export function restartState(state, by) {
  return {
    ...state, authorizedBy: state?.authorizedBy ?? by, problems: {}, attempts: [], questionRounds: 0, adaptations: 0,
  }
}

// ---------------------------------------------------------------- discussion

/** The issue body version and the human comments taken into account. */
export function snapshotContext(issue, comments, { trusted = [] } = {}) {
  const allowed = new Set([issue.user?.login, ...trusted])
  const human = comments.filter((item) => !isBot(item.user) && allowed.has(item.user?.login))
  return {
    lastCommentId: human.reduce((last, item) => Math.max(last, item.id ?? 0), 0),
    bodyHash: hash([issue.title, issue.body ?? '']),
    // Catches edited and deleted comments, which keep the same last id.
    discussionHash: hash(human.map((item) => [item.id, item.body])),
  }
}

export function contextChanged(before, after) {
  return !before || before.bodyHash !== after.bodyHash || before.discussionHash !== after.discussionHash
}

// ---------------------------------------------------------------- events

/** What a comment asks for, or null. `issue` is the issue (or the PR) that received it. */
export function commentIntent({ issue, comment, permission, authorized, issueAuthor }) {
  if (isBot(comment.user)) return null
  const command = /^\/agent\s+(fix|update)(?=\s|$)/.exec(comment.body ?? '')?.[1]
  if (command && (command === 'update' || issue.pull_request) && canWrite(permission)) return 'update'
  if (issue.pull_request) return null
  const waiting = (issue.labels ?? []).some((label) => label.name === 'needs-info')
  if (waiting && authorized && (comment.user.login === issueAuthor || canWrite(permission))) return 'resume'
  return null
}

export function issueFromBranch(branch) {
  const match = /^agent\/issue-(\d+)-/.exec(branch ?? '')
  return match ? Number(match[1]) : null
}

/** The single pull request of an issue: the open one, else the last merged one. */
export function linkedPull(pulls, issue, repo) {
  const linked = pulls
    .filter((pull) => issueFromBranch(pull.head?.ref) === issue && pull.head?.repo?.full_name === repo)
    .sort((a, b) => b.number - a.number)
  const open = linked.find((pull) => pull.state === 'open')
  if (open) return { status: 'open', pull: open }
  const merged = linked.find((pull) => pull.merged_at)
  return merged ? { status: 'merged', pull: merged } : { status: 'none', pull: null }
}

/**
 * Decides what a run does before any branch is created.
 * path: 'triage' (new work) | 'fix' (existing patch or PR) | 'followup' | 'stop'
 */
export function planRun({ mode, state, issue, link, snapshot, seedRun, headSha }) {
  if (!state?.authorizedBy) return { path: 'stop', reason: 'Issue non autorisée par agent:ready.' }
  const human = ['start', 'resume', 'update'].includes(mode)
  if (link.status === 'merged') {
    return human ? { path: 'followup' } : { path: 'stop', reason: 'La PR est déjà fusionnée.' }
  }
  if (issue.state !== 'open') return { path: 'stop', reason: 'L’issue est fermée.' }
  if (['resume', 'update'].includes(mode) && !contextChanged(state.snapshot, snapshot)) {
    return { path: 'stop', reason: 'Ces précisions sont déjà prises en compte.' }
  }
  if (seedRun && String(state.lastRun) !== String(seedRun)) {
    return { path: 'stop', reason: 'Une exécution plus récente a remplacé ce travail.' }
  }
  if (headSha && link.pull?.head.sha !== headSha) {
    return { path: 'stop', reason: 'La PR a reçu un commit plus récent.' }
  }
  if (link.status === 'open') return { path: 'fix' }
  if (human) return { path: 'triage' }
  return seedRun ? { path: 'fix' } : { path: 'stop', reason: 'Aucun travail à reprendre.' }
}

/** Prefilled link proposing a follow-up issue once the original PR is merged. */
export function followupUrl({ server, repo, issue, pull, request = '' }) {
  const body = [
    `Suite de #${issue.number} (livrée par #${pull.number}).`, '', '## Demande', request.slice(0, 1500), '',
    '## Critères d’acceptation', '- ',
  ].join('\n')
  const query = new URLSearchParams({ title: `Suivi de #${issue.number} : ${issue.title}`, body })
  return `${server}/${repo}/issues/new?${query}`
}

// ---------------------------------------------------------------- failures

// Steps of checks.yml whose failure is normally caused by the proposed code.
export const CODE_STEPS = [
  'Tests unitaires', 'Scénario de démonstration', 'Typage', 'Build', 'Lint du schéma',
  'Tests d\'intégration contre la base locale', 'Parcours annuaire, création d\'employé et accueil',
  'Réinitialiser une deuxième fois (le seed doit être rejouable)',
]
// Steps that mostly download things, but can also fail because of the code (lockfile, SQL error).
export const DOWNLOAD_STEPS = [
  'Run npm ci', 'Démarrer Supabase (migrations + seed)', 'Installer Chromium', 'Construire l\'image (sans la publier)',
]
export const SECURITY_STEPS = ['gitleaks sur l\'arbre de travail', 'Aucune clé serveur dans le bundle web']
const TRANSIENT = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|socket hang up|TLS handshake timeout|i\/o timeout|connection reset by peer|temporary failure in name resolution|toomanyrequests|too many requests|HTTP (429|50[0234])|\b50[234] (bad gateway|service unavailable|gateway time-?out)|lost communication with the server|runner has received a shutdown signal|no space left on device|unexpected EOF|download (was )?interrupted|overloaded_error|network timeout/i
const CONFIG = /Resource not accessible by integration|Bad credentials|HTTP 40[13]|permission denied|permission_denied|Input required and not supplied|invalid[ _](x-)?api[ _-]key|authentication_error|OAuth token .*(expired|invalid|revoked)|\[@octokit\/auth-app\]/i
const CODE_IN_DOWNLOAD = /SQLSTATE|EUSAGE|ERESOLVE|failed to apply migration|ERROR: (syntax|relation|column|type|duplicate)|error TS\d+/i

// Colours, then the "job<TAB>step<TAB>timestamp" prefix of `gh run view --log-failed`.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
export const cleanLog = (log) => log.replace(ANSI, '').split(/\r?\n/)
  .map((line) => line.replace(/^[^\t]*\t[^\t]*\t\uFEFF?[0-9T:.-]+Z ?/, '')).join('\n')

/** Names of the failing tests or compile errors, stable from one run to the next. */
export function failingTests(log) {
  const found = new Set()
  for (const line of cleanLog(log).split('\n')) {
    const match = /^\s*(?:FAIL|×)\s+(.+\.(?:test|spec)\.[mc]?[jt]sx?.*?)(?:\s+\d+\s*ms)?$/.exec(line)
      ?? /^\s*not ok \d+ - (.+)$/.exec(line)
      ?? /^\s*✖ (?!failing tests)(.+?) \([\d.]+m?s\)$/.exec(line)
      ?? /^\s*\d+\) (?:\[[\w-]+\] › )(.+?)[\s─]*$/.exec(line)
    if (match) found.add(match[1].replace(/:\d+:\d+/g, '').trim())
    const compile = /([\w./-]+\.tsx?)[(:]\d+[,:]\d+\)?(?::| -)? error (TS\d+)/.exec(line)
    if (compile) found.add(`${compile[1]} ${compile[2]}`)
  }
  return [...found].sort().slice(0, 20)
}

/**
 * Routes a failed run to whoever can resolve it.
 * kind: 'code' (Claude) | 'transient' (one retry by Actions) | 'maintainer'
 * jobs: [{ name, conclusion, url, steps: [{ name, conclusion }] }]
 */
export function classifyFailure({ jobs, log = '', runAttempt = 1 }) {
  const failed = jobs.filter((job) => ['failure', 'timed_out', 'cancelled'].includes(job.conclusion))
  const stepsOf = (job) => (job.steps ?? []).filter((step) => step.conclusion === 'failure').map((step) => step.name)
  const steps = failed.flatMap(stepsOf)
  const text = cleanLog(log)
  const where = steps.length ? steps.join(', ') : failed.map((job) => job.name).join(', ') || 'démarrage du workflow'
  const result = (kind, reason) => {
    const tests = kind === 'code' ? failingTests(log) : []
    const culprit = failed.find((job) => stepsOf(job).some((step) => CODE_STEPS.includes(step))) ?? failed[0]
    return {
      kind, reason, steps, tests, url: culprit?.url,
      fingerprint: kind === 'code' ? hash(tests.length ? tests : [...steps].sort()) : undefined,
    }
  }
  const transient = (reason) => (runAttempt > 1
    ? result('maintainer', `${reason} Le nouvel essai a échoué aussi.`)
    : result('transient', reason))

  if (steps.some((step) => SECURITY_STEPS.includes(step))) {
    return result('maintainer', `Contrôle de sécurité en échec : ${where}.`)
  }
  // A test log may legitimately contain "permission denied" or ECONNREFUSED: the step decides first.
  if (steps.some((step) => CODE_STEPS.includes(step))) return result('code', `Vérification en échec : ${where}.`)
  if (steps.some((step) => DOWNLOAD_STEPS.includes(step))) {
    if (CODE_IN_DOWNLOAD.test(text)) return result('code', `Vérification en échec : ${where}.`)
    if (TRANSIENT.test(text)) return transient(`Téléchargement interrompu : ${where}.`)
  }
  if (CONFIG.test(text)) return result('maintainer', `Secret absent ou permission refusée : ${where}.`)
  if (TRANSIENT.test(text)) return transient(`Panne temporaire : ${where}.`)
  return result('maintainer', `Échec que le workflow ne sait pas attribuer : ${where}.`)
}

/**
 * Counts one automatic correction. `allowed` is false once the same problem was corrected twice.
 * Attempts keep what Claude tried, for the hand-off to a person.
 */
export function recordFailure(state, { fingerprint, tried, run }) {
  const problems = { ...state.problems }
  const attempts = [...(state.attempts ?? [])]
  // `tried` describes the correction that just failed, not the first version of the patch.
  if (tried && attempts.length) attempts[attempts.length - 1] = { ...attempts.at(-1), tried }
  const total = Object.values(problems).reduce((sum, count) => sum + count, 0)
  const allowed = (problems[fingerprint] ?? 0) < MAX_FIXES_PER_PROBLEM && total < MAX_FIXES_TOTAL
  if (allowed) {
    problems[fingerprint] = (problems[fingerprint] ?? 0) + 1
    attempts.push({ fingerprint, run: String(run), tried: '' })
  }
  return { allowed, attempt: problems[fingerprint] ?? 0, state: { ...state, problems, attempts } }
}

export function renderHandoff({ state, reason, tests = [], url, maintainer }) {
  return [
    '### ✋ Les corrections automatiques n’ont pas suffi', '',
    `@${maintainer} : ${reason}`, '',
    '**Ce que Claude a essayé**',
    ...((state.attempts ?? []).length
      ? state.attempts.map((item, index) => `${index + 1}. ${item.tried || '(aucun résumé produit)'}`)
      : ['- (aucune correction)']),
    '', '**Ce qui échoue encore**',
    ...(tests.length ? tests.map((item) => `- \`${item.replace(/`/g, '')}\``) : ['- Voir le journal.']),
    '', `[Test et journal en échec](${url})`,
  ].join('\n')
}

// ---------------------------------------------------------------- review

/** Validates the second review. Anything unreadable or inconsistent blocks the merge. */
export function decideReview(raw, { weakenedTests = [] } = {}) {
  let review
  try {
    review = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    review = null
  }
  const valid = review && ['pass', 'fix', 'human'].includes(review.verdict)
    && Array.isArray(review.criteria) && (review.criteria.length > 0 || review.verdict !== 'pass')
    && Array.isArray(review.findings) && typeof review.testWeakened === 'boolean'
  if (!valid) {
    return {
      verdict: 'invalid', weakened: false, criteria: [], findings: [], question: '',
      summary: 'La revue n’a pas produit de verdict lisible.',
    }
  }
  const base = {
    summary: String(review.summary ?? ''), criteria: review.criteria, findings: review.findings,
    question: String(review.question ?? ''), weakened: review.testWeakened || weakenedTests.length > 0,
  }
  if (base.weakened) {
    return { ...base, verdict: 'human', findings: [...base.findings, ...weakenedTests.map((description) => ({ file: '', description }))] }
  }
  const missing = review.criteria.some((item) => !item.covered)
  if (review.verdict === 'pass') return { ...base, verdict: missing || review.findings.length ? 'fix' : 'pass' }
  // "Fix" without anything precise to fix cannot go back to Claude.
  if (review.verdict === 'fix' && !missing && review.findings.length === 0) return { ...base, verdict: 'human' }
  return { ...base, verdict: review.verdict }
}

const REVIEW_TITLES = {
  pass: '### ✅ Revue IA : conforme',
  fix: '### 🔧 Revue IA : correction demandée',
  human: '### ✋ Revue IA : décision humaine requise',
  invalid: '### ⚠️ Revue IA : verdict illisible, fusion bloquée',
}

export function renderReview(decision) {
  const lines = [REVIEW_TITLES[decision.verdict], '', decision.summary]
  if (decision.weakened) lines.push('', '**Fusion bloquée :** un test a été affaibli.')
  if (decision.criteria.length) {
    lines.push('', '**Critères**', ...decision.criteria.map((item) => `- ${item.covered ? '✅' : '❌'} ${item.criterion}${item.test ? ` — ${item.test}` : ''}`))
  }
  if (decision.findings.length) {
    lines.push('', '**Défauts**', ...decision.findings.map((item) => `- ${item.file ? `\`${item.file}\` : ` : ''}${item.description}`))
  }
  if (decision.question) lines.push('', `**Question :** ${decision.question}`)
  return lines.join('\n')
}

/** Only an agent PR aimed at the demo branch, with a green CI and a passing review, merges itself. */
export function canAutoMerge({ pull, repo, ci, review, labels = [], appLogin, enabled = true }) {
  return Boolean(enabled && pull.state === 'open' && !pull.draft
    && pull.base.ref === DEMO_BRANCH
    && appLogin && pull.user?.login === appLogin
    && pull.head.repo?.full_name === repo && issueFromBranch(pull.head.ref)
    && ci === 'success' && review === 'success'
    && !labels.some((label) => ['needs-human', 'needs-info'].includes(label)))
}
