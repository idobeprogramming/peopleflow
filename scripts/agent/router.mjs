// Turns GitHub events and finished runs into the next step for an issue. Every GitHub call goes
// through `api` (github.mjs in Actions, an in-memory fake in tests).
import {
  canAutoMerge, canWrite, classifyFailure, commentIntent, contextChanged, findState, followupUrl, isBot, issueFromBranch,
  linkedPull, MAX_ADAPTATIONS, MAX_QUESTION_ROUNDS, planRun, recordFailure, renderHandoff, renderState, restartState,
  snapshotContext, STATE_MARKER, DEMO_BRANCH,
} from './flow.mjs'

export const AGENT_WORKFLOW = 'Agent d\'issue'
export const REVIEW_WORKFLOW = 'Revue IA'

/** The issue, its linked PR, the discussion the agent may read and the stored state. */
export async function loadContext(api, number) {
  const issue = await api.issue(number)
  const issueComments = await api.comments(number)
  const stored = findState(issueComments)
  const link = linkedPull(await api.pulls(), number, api.repo)
  const pullComments = link.status === 'open'
    ? [...await api.comments(link.pull.number), ...await api.reviewComments(link.pull.number)]
    : []
  const comments = [...issueComments.filter((item) => !item.body?.startsWith(STATE_MARKER)), ...pullComments]
  const trusted = []
  for (const login of new Set(comments.filter((item) => !isBot(item.user)).map((item) => item.user.login))) {
    if (login !== issue.user.login && canWrite(await api.permission(login))) trusted.push(login)
  }
  return {
    number, issue, comments, trusted, link, stateId: stored?.id, state: stored?.state ?? null,
    snapshot: snapshotContext(issue, comments, { trusted }),
  }
}

async function saveState(api, context, changes) {
  context.state = { ...context.state, ...changes }
  context.stateId = await api.saveState(context.number, context.stateId, renderState(context.state))
}

async function setStatus(api, context, label) {
  await api.setStatus(context.number, label)
  if (context.link.status === 'open') await api.setStatus(context.link.pull.number, label)
}

/** Stops for a person with write access: the PR when there is one, else the issue. */
async function handOff(api, context, body) {
  await setStatus(api, context, 'needs-human')
  await api.comment(context.link.status === 'open' ? context.link.pull.number : context.number, body)
}

const askMaintainer = (api, reason, url) =>
  `### ✋ Décision ou configuration requise\n\n@${api.maintainer} : ${reason}${url ? `\n\n[Journal](${url})` : ''}`
  + '\n\nUne fois réglé : `/agent update <précision>` ou le label `agent:ready`.'

// ---------------------------------------------------------------- events

export async function onLabel(api, event) {
  if (event.label?.name !== 'agent:ready' || event.issue.pull_request) return 'ignoré'
  if (!canWrite(await api.permission(event.sender.login))) return `${event.sender.login} n’a pas le droit d’écriture`
  const context = await loadContext(api, event.issue.number)
  await saveState(api, context, restartState(context.state, event.sender.login))
  await api.dispatch({ issue: context.number, mode: 'start' })
  return 'démarré'
}

export async function onComment(api, event) {
  const { issue, comment } = event
  let number = issue.number
  if (issue.pull_request) {
    const pull = await api.pull(issue.number)
    number = pull.head.repo?.full_name === api.repo ? issueFromBranch(pull.head.ref) : null
    if (!number) return 'ignoré : pas une PR de l’agent'
  }
  const permission = await api.permission(comment.user.login)
  const stored = findState(await api.comments(number))
  const intent = commentIntent({
    issue, comment, permission, authorized: Boolean(stored?.state.authorizedBy), issueAuthor: issue.user.login,
  })
  if (!intent) return 'ignoré'
  if (intent === 'update') {
    const context = await loadContext(api, number)
    await saveState(api, context, restartState(context.state, comment.user.login))
  }
  await api.dispatch({ issue: number, mode: intent })
  return intent
}

// ---------------------------------------------------------------- start of a run

/**
 * Runs before any branch exists. Returns { path: 'triage' | 'fix' | 'stop', ... }.
 * `seedRun` holds an unpublished patch to continue from.
 */
export async function prepareRun(api, { number, mode, runId, seedRun = '', headSha = '', missing = [] }) {
  const context = await loadContext(api, number)
  const { issue, link } = context
  const previous = context.state?.snapshot ?? null
  const plan = planRun({ mode, state: context.state, issue, link, snapshot: context.snapshot, seedRun, headSha })
  if (plan.path === 'stop') {
    if (mode === 'update') await api.comment(number, `ℹ️ ${plan.reason}`)
    return plan
  }
  if (plan.path === 'followup') {
    const request = context.comments
      .filter((item) => /^\/agent\s+update/.test(item.body ?? '') && (context.trusted.includes(item.user.login) || item.user.login === issue.user.login))
      .at(-1)?.body.replace(/^\/agent\s+update\s*/, '')
    const url = followupUrl({ server: api.server, repo: api.repo, issue, pull: link.pull, request })
    await api.setStatus(number, '')
    await api.comment(number, `📦 La PR #${link.pull.number} est déjà fusionnée. [Créer une issue de suivi liée à #${number}](${url}), puis y poser \`agent:ready\`.`)
    return { path: 'stop', reason: 'Issue de suivi proposée.' }
  }
  if (missing.length) {
    await handOff(api, context, askMaintainer(api, `il manque ${missing.join(' ; ')}. Voir docs/AUTOMATION_SETUP.md.`))
    return { path: 'stop', reason: 'Configuration incomplète.' }
  }
  const baseBranch = link.pull?.base.ref && link.status === 'open'
    ? link.pull.base.ref
    : issue.title.startsWith('[démo]') ? DEMO_BRANCH : api.baseBranch
  const baseSha = link.status === 'open' ? link.pull.head.sha : await api.branchSha(baseBranch)
  if (!baseSha) {
    await handOff(api, context, askMaintainer(api, `la branche \`${baseBranch}\` n’existe pas. Lancer \`scripts/setup-github.ps1\`.`))
    return { path: 'stop', reason: 'Branche absente.' }
  }
  await saveState(api, context, {
    snapshot: context.snapshot, lastRun: String(runId), pr: link.status === 'open' ? link.pull.number : undefined,
  })
  await setStatus(api, context, 'agent:working')
  await api.comment(number, `🤖 ${plan.path === 'triage' ? 'Je prends la demande' : link.status === 'open' ? `Je mets à jour la PR #${link.pull.number}` : 'Je reprends le correctif'} sur \`${baseBranch}\` (${baseSha.slice(0, 7)}) — [suivre l’exécution](${api.runUrl(runId)}).`)
  return {
    path: plan.path, context, previous, baseBranch, baseSha,
    pull: link.status === 'open' ? link.pull : null,
  }
}

/** What people wrote since the agent last read the issue. */
export function renderChanges(context, previous) {
  if (!previous) return ''
  const allowed = new Set([context.issue.user.login, ...context.trusted])
  const recent = context.comments.filter((item) => allowed.has(item.user.login) && item.id > previous.lastCommentId)
  const lines = []
  if (previous.bodyHash !== context.snapshot.bodyHash) lines.push('- Le titre ou le corps de l’issue a été modifié : relis `.agent/issue.md`.')
  for (const item of recent) lines.push(`- @${item.user.login} : ${item.body.slice(0, 2000)}`)
  if (!lines.length && contextChanged(previous, context.snapshot)) lines.push('- Un commentaire a été modifié ou supprimé : relis toute la discussion.')
  return lines.join('\n')
}

// ---------------------------------------------------------------- during a run

/** Product ambiguity: one targeted question to the author, or another pass if they already replied. */
export async function askAuthor(api, { number, questions, summary = '' }) {
  const context = await loadContext(api, number)
  if (contextChanged(context.state?.snapshot, context.snapshot)) {
    await api.dispatch({ issue: number, mode: 'resume' })
    return 'relancé'
  }
  const rounds = (context.state?.questionRounds ?? 0) + 1
  await saveState(api, context, { questionRounds: rounds })
  if (rounds > MAX_QUESTION_ROUNDS) {
    await handOff(api, context, askMaintainer(api, `la demande reste ambiguë après ${MAX_QUESTION_ROUNDS} séries de questions.`))
    return 'humain'
  }
  // The label comes first: a very fast answer must already find the issue waiting.
  await setStatus(api, context, 'needs-info')
  await api.comment(number, [
    '### 🔎 Il me manque une décision', '', ...(summary ? [summary, ''] : []),
    ...questions.map((question) => `- ${question}`), '',
    `@${context.issue.user.login} : répondez ici, je reprends automatiquement.`,
  ].join('\n'))
  return 'question'
}

export async function stopForMaintainer(api, { number, reason, url }) {
  const context = await loadContext(api, number)
  await handOff(api, context, askMaintainer(api, reason, url))
}

/** Last check before publishing: 'publish' | 'adapt' | 'stop'. */
export async function checkFresh(api, { number, runId }) {
  const context = await loadContext(api, number)
  if (String(context.state?.lastRun) !== String(runId) || context.issue.state !== 'open') return 'stop'
  const open = context.link.status === 'open' ? context.link.pull.number : undefined
  if (context.link.status === 'merged' || context.state.pr !== open) return 'stop'
  if (!contextChanged(context.state.snapshot, context.snapshot)) return 'publish'
  const adaptations = (context.state.adaptations ?? 0) + 1
  if (adaptations > MAX_ADAPTATIONS) {
    await handOff(api, context, askMaintainer(api, `la demande a changé plus de ${MAX_ADAPTATIONS} fois pendant le travail.`, api.runUrl(runId)))
    return 'stop'
  }
  await saveState(api, context, { adaptations })
  await api.comment(number, '🔁 La demande a été précisée pendant le travail : j’adapte le même correctif avant de publier.')
  await api.dispatch({ issue: number, mode: 'adapt', seed_run: runId })
  return 'adapt'
}

export async function onPublished(api, { number, pull, summary }) {
  const context = await loadContext(api, number)
  const attempts = [...(context.state?.attempts ?? [])]
  if (attempts.length) attempts[attempts.length - 1] = { ...attempts.at(-1), tried: summary }
  await saveState(api, context, { pr: pull, attempts })
  await setStatus(api, context, 'agent:review')
  await api.setStatus(pull, 'agent:review')
}

// ---------------------------------------------------------------- end of a run

/** workflow_run completed. `run` is the event's workflow_run. */
export async function onRun(api, run) {
  return run.name === AGENT_WORKFLOW ? onAgentRun(api, run) : onPullRun(api, run)
}

async function onAgentRun(api, run) {
  if (run.conclusion === 'success' || run.conclusion === 'skipped') return 'rien à faire'
  const number = Number(/#(\d+) \(/.exec(run.display_title)?.[1])
  if (!number) throw new Error(`Issue introuvable pour le run ${run.id}`)
  const context = await loadContext(api, number)
  // A queued run replaced by a newer one never prepared anything; neither did a refused one.
  if (String(context.state?.lastRun) !== String(run.id)) {
    const crashed = run.conclusion === 'startup_failure' || (await api.jobs(run.id)).some((job) => job.name === 'Préparation' && job.conclusion === 'failure')
    return crashed ? routeFailure(api, context, run, { correct: {}, canCorrect: false }) : 'remplacé'
  }
  const handled = `${run.id}-${run.run_attempt}`
  if (context.state.handledRun === handled) return 'déjà traité'
  await saveState(api, context, { handledRun: handled })
  const proposal = await api.report(run.id)
  return routeFailure(api, context, run, {
    tried: proposal?.summary, correct: { mode: 'correct', seed_run: run.id, log_run: run.id }, canCorrect: Boolean(proposal),
  })
}

async function routeFailure(api, context, run, { tried, correct, canCorrect = true }) {
  const failure = classifyFailure({ jobs: await api.jobs(run.id), log: await api.log(run.id), runAttempt: run.run_attempt })
  const url = failure.url ?? run.html_url
  if (failure.kind === 'transient') {
    await api.rerunFailed(run.id)
    return 'nouvel essai'
  }
  if (failure.kind === 'code' && canCorrect) {
    return sendToClaude(api, context, { failure: { ...failure, url }, tried, run, inputs: correct })
  }
  await handOff(api, context, askMaintainer(api, failure.reason, url))
  return 'mainteneur'
}

async function sendToClaude(api, context, { failure, tried, run, inputs }) {
  const result = recordFailure(context.state, { fingerprint: failure.fingerprint, tried, run: run.id })
  await saveState(api, context, result.state)
  if (!result.allowed) {
    await handOff(api, context, renderHandoff({ state: result.state, reason: failure.reason, tests: failure.tests, url: failure.url, maintainer: api.maintainer }))
    return 'humain'
  }
  await api.comment(context.number, `🔧 ${failure.reason} Correction automatique ${result.attempt}/2 — [journal](${failure.url}).`)
  await api.dispatch({ issue: context.number, ...inputs })
  return 'correction'
}

// CI and the review of one commit finish in any order: the later one sees both results.
async function onPullRun(api, run) {
  const number = issueFromBranch(run.head_branch)
  if (!number || run.event !== 'pull_request') return 'ignoré'
  const context = await loadContext(api, number)
  const { link } = context
  if (link.status !== 'open' || link.pull.head.sha !== run.head_sha) return 'PR fermée ou plus récente'
  if (!context.state?.authorizedBy) return 'PR sans autorisation suivie'

  if (run.name !== REVIEW_WORKFLOW && ['failure', 'timed_out'].includes(run.conclusion)) {
    return routeFailure(api, context, run, { correct: { mode: 'correct', log_run: run.id, head_sha: run.head_sha } })
  }
  if (run.name === REVIEW_WORKFLOW && ['failure', 'timed_out'].includes(run.conclusion) && !await api.review(run.id)) {
    return routeFailure(api, context, run, { correct: {}, canCorrect: false })
  }

  const ci = await api.latestRun('ci.yml', run.head_sha)
  const review = await api.latestRun('ai-review.yml', run.head_sha)
  if (ci?.conclusion !== 'success' || review?.status !== 'completed') return 'en attente'
  if (review.conclusion === 'failure') return routeReview(api, context, review)

  const labels = [...context.issue.labels, ...link.pull.labels].map((label) => label.name)
  const ready = canAutoMerge({
    pull: link.pull, repo: api.repo, ci: ci.conclusion, review: review.conclusion, labels, appLogin: api.appLogin, enabled: api.demoAutoMerge,
  })
  if (!ready) return 'prête pour une personne'
  if (contextChanged(context.state.snapshot, context.snapshot)) {
    await handOff(api, context, askMaintainer(api, 'la demande a changé depuis la dernière version de la PR; fusion automatique suspendue.'))
    return 'mainteneur'
  }
  await api.merge(link.pull.number, run.head_sha)
  await api.setStatus(number, '')
  await api.comment(number, `🎬 PR #${link.pull.number} fusionnée dans \`${DEMO_BRANCH}\` : CI et revue réussies.`)
  return 'fusionnée'
}

async function routeReview(api, context, run) {
  const review = await api.review(run.id)
  if (!review) return 'en attente'
  const url = run.html_url
  // The CI and the review events can both see this verdict: only the first one acts.
  const handled = `${run.id}-${run.run_attempt}`
  if (context.state.handledReview === handled) return 'déjà traitée'
  await saveState(api, context, { handledReview: handled })
  if (review.verdict === 'invalid') {
    if (run.run_attempt > 1) {
      await handOff(api, context, askMaintainer(api, 'la revue n’a produit aucun verdict lisible, deux fois.', url))
      return 'mainteneur'
    }
    await api.rerun(run.id)
    return 'nouvel essai'
  }
  if (review.verdict === 'fix') {
    const failure = {
      fingerprint: 'review', url, reason: 'La revue demande une correction.',
      tests: review.findings.map((item) => [item.file, item.description].filter(Boolean).join(' : '))
        .concat(review.criteria.filter((item) => !item.covered).map((item) => item.criterion)),
    }
    return sendToClaude(api, context, { failure, run, inputs: { mode: 'review', review_run: run.id, head_sha: context.link.pull.head.sha } })
  }
  if (review.question && !review.weakened) {
    return askAuthor(api, { number: context.number, questions: [review.question], summary: review.summary })
  }
  const reason = review.weakened
    ? 'un test a été affaibli. La fusion reste bloquée.'
    : review.summary || 'la revue demande une décision.'
  await handOff(api, context, askMaintainer(api, reason, url))
  return 'mainteneur'
}
