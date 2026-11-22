// Pure helpers used by the agent workflows. No I/O here so every rule is unit-tested.

export const PROTECTED_PATHS = ['.github/', 'AGENTS.md', 'scripts/agent/']
export const DATA_PATHS = ['supabase/seed.sql', 'supabase/migrations/']
export const MAX_CHANGED_LINES = 400
const IGNORED_FOR_SIZE = ['package-lock.json']
const TEST_FILE = /\.(test|spec)\.(m?[jt]sx?)$/
const ASSERTION = /\b(expect|assert(\.\w+)?)\s*\(/
const DESTRUCTIVE_SQL = /\b(drop\s+(table|column|schema|type|index|view|function)|truncate\b|delete\s+from|alter\s+table\s+[\w."]+\s+(drop|alter\s+column\s+[\w"]+\s+(set\s+not\s+null|type)))/i
const SECRET_PATTERNS = [
  { name: 'clé OpenAI ou Anthropic', pattern: /\bsk-(ant-)?[A-Za-z0-9_-]{20,}/ },
  { name: 'jeton GitHub', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/ },
  { name: 'JWT (clé Supabase possible)', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'clé privée', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'clé Supabase secrète', pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
]

/** Parses `git diff --binary` style unified output into per-file additions and removals. */
export function parseUnifiedDiff(text) {
  const files = []
  let current = null
  for (const line of text.split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
    if (header) {
      current = { path: header[2], oldPath: header[1], added: [], removed: [], isNew: false, isDeleted: false }
      files.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith('new file mode')) current.isNew = true
    else if (line.startsWith('deleted file mode')) current.isDeleted = true
    else if (line.startsWith('+++') || line.startsWith('---')) continue
    else if (line.startsWith('+')) current.added.push(line.slice(1))
    else if (line.startsWith('-')) current.removed.push(line.slice(1))
  }
  return files
}

const startsWithAny = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(prefix))

/**
 * Applies the delivery guardrails to a parsed diff.
 * Returns { stop: Violation[], human: Violation[] }: `stop` rejects the patch, `human` pauses for a decision.
 */
export function checkDiff(files, { labels = [], maxLines = MAX_CHANGED_LINES } = {}) {
  const stop = []
  const human = []
  const allowData = labels.includes('migration')

  if (files.length === 0) stop.push({ rule: 'empty', message: 'Le patch est vide.' })

  for (const file of files) {
    for (const path of new Set([file.path, file.oldPath])) {
      if (startsWithAny(path, PROTECTED_PATHS)) {
        stop.push({ rule: 'protected-path', message: `Fichier protégé modifié : ${path}` })
      }
    }
    if (!allowData && startsWithAny(file.path, DATA_PATHS)) {
      human.push({ rule: 'data-change', message: `Seed ou migration modifié sans le label migration : ${file.path}` })
    }
    if (file.path.startsWith('supabase/migrations/') && !file.isNew) {
      human.push({ rule: 'migration-rewrite', message: `Une migration existante a été réécrite : ${file.path}` })
    }
    if (file.path.endsWith('.sql') && file.added.some((line) => DESTRUCTIVE_SQL.test(stripSqlComment(line)))) {
      human.push({ rule: 'destructive-sql', message: `SQL destructif dans ${file.path}` })
    }
    if (TEST_FILE.test(file.path) || file.path.startsWith('demo/')) {
      // Any assertion that disappears or is rewritten counts: replacing a precise check with a looser
      // one keeps the count but weakens the test. Moving an identical line is allowed.
      const kept = new Set(file.added.map((line) => line.trim()))
      const changedAssertions = file.removed.filter((line) => ASSERTION.test(line) && !kept.has(line.trim()))
      if (file.isDeleted || changedAssertions.length > 0) {
        human.push({ rule: 'weakened-test', message: `Assertion retirée ou réécrite dans ${file.path}` })
      }
    }
    for (const line of file.added) {
      const secret = SECRET_PATTERNS.find(({ pattern }) => pattern.test(line))
      if (secret) stop.push({ rule: 'secret', message: `Secret probable (${secret.name}) dans ${file.path}` })
    }
  }

  const codeFiles = files.filter((file) => /\.(m?[jt]sx?|sql)$/.test(file.path))
  const touchesTests = files.some((file) => TEST_FILE.test(file.path) || file.path.startsWith('demo/') || file.path.startsWith('e2e/'))
  if (codeFiles.length > 0 && !touchesTests) {
    stop.push({ rule: 'no-test', message: 'Du code a changé sans aucun test ajouté ou modifié.' })
  }

  const changed = files
    .filter((file) => !IGNORED_FOR_SIZE.includes(file.path))
    .reduce((total, file) => total + file.added.length + file.removed.length, 0)
  if (changed > maxLines) {
    human.push({ rule: 'too-large', message: `${changed} lignes modifiées (limite ${maxLines}). Découper la demande.` })
  }

  return { stop: dedupe(stop), human: dedupe(human), changedLines: changed }
}

function stripSqlComment(line) {
  return line.replace(/--.*$/, '')
}

function dedupe(items) {
  const seen = new Set()
  return items.filter((item) => !seen.has(item.message) && seen.add(item.message))
}

/** Validates the triage JSON produced by the agent and turns it into a workflow decision. */
export function decideTriage(raw, { labels = [] } = {}) {
  let triage
  try {
    triage = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { action: 'fail', reason: 'La réponse du triage n’est pas du JSON valide.' }
  }
  const problems = []
  if (typeof triage?.ready !== 'boolean') problems.push('ready')
  if (!Array.isArray(triage?.questions)) problems.push('questions')
  if (!triage?.plan || typeof triage.plan.summary !== 'string') problems.push('plan.summary')
  if (problems.length) return { action: 'fail', reason: `Champs manquants dans le triage : ${problems.join(', ')}` }

  if (!triage.ready || triage.questions.length > 0) {
    return { action: 'ask', triage }
  }
  const schema = triage.plan.schemaChange
  if (schema === 'destructive') {
    return { action: 'human', triage, reason: 'Le plan modifie ou supprime des données existantes.' }
  }
  if (schema === 'additive' && !labels.includes('migration')) {
    return { action: 'human', triage, reason: 'Le plan ajoute une migration; poser le label migration pour l’autoriser.' }
  }
  return { action: 'implement', triage }
}

export function renderTriageComment(decision) {
  const { triage } = decision
  if (decision.action === 'ask') {
    return [
      '### 🔎 Triage : il me manque des précisions',
      '',
      ...triage.questions.map((question) => `- ${question}`),
      '',
      'Répondez dans un commentaire puis reposez le label `agent:ready`.',
    ].join('\n')
  }
  const plan = triage.plan
  const lines = [
    decision.action === 'human' ? '### ✋ Triage : décision requise' : '### 🧭 Plan de l’agent',
    '',
    plan.summary,
    '',
    '**Fichiers visés**',
    ...list(plan.files),
    '',
    '**Tests à écrire d’abord**',
    ...list(plan.tests),
  ]
  if (plan.assumptions?.length) lines.push('', '**Hypothèses**', ...list(plan.assumptions))
  if (decision.action === 'human') lines.push('', `**Arrêt :** ${decision.reason}`)
  return lines.join('\n')
}

function list(items = []) {
  return items.length ? items.map((item) => `- ${item}`) : ['- (aucun)']
}

export function renderGuardComment({ stop, human, changedLines }) {
  const lines = ['### 🛑 Garde-fous du workflow', '']
  if (stop.length) lines.push('**Patch rejeté**', ...stop.map((item) => `- ${item.message}`), '')
  if (human.length) lines.push('**Décision humaine requise**', ...human.map((item) => `- ${item.message}`), '')
  lines.push(`Lignes modifiées : ${changedLines}.`)
  return lines.join('\n')
}

/** Markdown for the PR body and the issue comment, from the agent's structured report. */
export function renderReport(report, { issue, changedLines } = {}) {
  const commands = (report.commands ?? []).map(
    ({ command, exitCode }) => `| \`${command}\` | ${exitCode === 0 ? '✅ 0' : `❌ ${exitCode}`} |`,
  )
  return [
    `## Résumé`,
    report.summary,
    '',
    '## Changements',
    ...list(report.changes),
    '',
    '## Tests ajoutés ou modifiés',
    ...list(report.tests),
    '',
    '## Commandes lancées par l’agent',
    '| Commande | Code de sortie |',
    '| --- | --- |',
    ...(commands.length ? commands : ['| (aucune) | — |']),
    '',
    '## Hypothèses',
    ...list(report.assumptions),
    '',
    '## Limites et décisions à prendre',
    ...list(report.openQuestions),
    '',
    `_Le runner de vérification a relancé toutes les vérifications sur un checkout neuf.${changedLines !== undefined ? ` ${changedLines} lignes modifiées.` : ''}_`,
    issue ? `\nCloses #${issue}` : '',
  ].join('\n')
}

/** Returns the next correction attempt number, or null when the budget is spent. */
export function nextAttempt(labels, max = 2) {
  for (let attempt = max; attempt >= 1; attempt -= 1) {
    if (labels.includes(`agent:attempt-${attempt}`)) return attempt < max ? attempt + 1 : null
  }
  return 1
}

/** Daily report: what shipped, what is ready to test, what needs a person. */
export function renderDailyReport({ date, merged = [], openPulls = [], blocked = [], stagingUrl }) {
  const pr = (item) => `- #${item.number} ${item.title}${item.url ? ` — ${item.url}` : ''}`
  return [
    `# Rapport PeopleFlow — ${date}`,
    '',
    `## Livré dans staging (${merged.length})`,
    ...(merged.length ? merged.map(pr) : ['- Rien aujourd’hui.']),
    stagingUrl ? `\nÀ essayer : ${stagingUrl}` : '',
    '',
    `## En revue (${openPulls.length})`,
    ...(openPulls.length ? openPulls.map(pr) : ['- Aucune PR ouverte.']),
    '',
    `## Décision requise (${blocked.length})`,
    ...(blocked.length
      ? blocked.map((item) => `- #${item.number} ${item.title} (${item.labels.join(', ')})`)
      : ['- Rien de bloqué.']),
    '',
  ].join('\n')
}
