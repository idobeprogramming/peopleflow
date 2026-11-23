#!/usr/bin/env node
// Thin I/O layer over lib.mjs for GitHub Actions. Usage: node scripts/agent/cli.mjs <command> [...args]
import { appendFileSync, copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { cleanLog, decideReview, issueFromBranch, renderReview } from './flow.mjs'
import { createGitHub } from './github.mjs'
import {
  checkDiff, decideTriage, parseUnifiedDiff, renderDailyReport, renderGuardComment, renderIssue, renderReport,
  renderTriageComment, selectDiscussion,
} from './lib.mjs'
import {
  askAuthor, checkFresh, loadContext, onComment, onLabel, onPublished, onRun, prepareRun, renderChanges, stopForMaintainer,
} from './router.mjs'

const [command, ...args] = process.argv.slice(2)

function output(name, value) {
  const text = String(value)
  if (!process.env.GITHUB_OUTPUT) return console.log(`${name}=${text}`)
  const delimiter = `EOF_${Math.random().toString(36).slice(2)}`
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${text}\n${delimiter}\n`)
}

function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n')
  else console.log(markdown)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const commands = {
  // agent-events.yml: decides what the event means, then dispatches the agent workflow.
  async event() {
    const api = createGitHub()
    const event = readJson(process.env.GITHUB_EVENT_PATH)
    const handlers = {
      issues: () => onLabel(api, event),
      issue_comment: () => onComment(api, event),
      workflow_dispatch: async () => onRun(api, await api.finishedAgentRun(process.env.RUN_ID)),
      workflow_run: () => onRun(api, { ...event.workflow_run, name: event.workflow.name }),
    }
    summary(`Routage : ${await handlers[process.env.GITHUB_EVENT_NAME]()}`)
  },

  // First job of a run. Writes the data files Claude reads; never interpolates them into YAML.
  async prepare([outDir = '.agent']) {
    const api = createGitHub()
    const env = process.env
    const number = Number(env.ISSUE)
    if (!Number.isInteger(number) || number < 1) throw new Error(`Numéro d’issue invalide : ${env.ISSUE}`)
    const missing = []
    if (env.HAS_CLAUDE !== 'true') missing.push('le secret CLAUDE_CODE_OAUTH_TOKEN (abonnement) ou ANTHROPIC_API_KEY (API)')
    if (env.HAS_APP !== 'true') missing.push('la variable AGENT_APP_ID et le secret AGENT_APP_PRIVATE_KEY (GitHub App)')
    const run = await prepareRun(api, {
      number, mode: env.MODE, runId: env.GITHUB_RUN_ID, seedRun: env.SEED_RUN, headSha: env.HEAD_SHA, missing,
    })
    output('path', run.path)
    if (run.path === 'stop') return summary(`Arrêt : ${run.reason}`)
    const { context } = run
    mkdirSync(outDir, { recursive: true })
    // Prompts come from the default branch, whatever the age of the branch being worked on.
    const here = new URL('./', import.meta.url)
    for (const file of readdirSync(here).filter((name) => /\.(prompt\.md|schema\.json)$/.test(name))) {
      copyFileSync(new URL(file, here), `${outDir}/${file}`)
    }
    const write = (name, text) => text && writeFileSync(`${outDir}/${name}`, text)
    write('issue.md', renderIssue(context.issue, selectDiscussion(context.comments, {
      issueAuthor: context.issue.user.login, trusted: context.trusted,
    })))
    write('changes.md', renderChanges(context, run.previous))
    if (env.LOG_RUN) write('failure.log', cleanLog(await api.log(env.LOG_RUN)).split('\n').slice(-400).join('\n'))
    if (env.SEED_RUN) write('previous.patch', api.artifact(env.SEED_RUN, 'proposal', 'proposal.patch'))
    if (env.REVIEW_RUN) write('review.json', api.artifact(env.REVIEW_RUN, 'review-verdict', 'verdict.json'))
    output('base_branch', run.baseBranch)
    output('base_sha', run.baseSha)
    output('pr', run.pull?.number ?? '')
    output('branch', run.pull?.head.ref ?? '')
    output('labels', JSON.stringify(context.issue.labels.map((label) => label.name)))
    output('title', context.issue.title)
  },

  async ask([file]) {
    const { questions = [], summary: text = '' } = readJson(file)
    summary(`Question à l’auteur : ${await askAuthor(createGitHub(), { number: Number(process.env.ISSUE), questions, summary: text })}`)
  },

  async stop() {
    const api = createGitHub()
    await stopForMaintainer(api, {
      number: Number(process.env.ISSUE), reason: process.env.REASON, url: api.runUrl(process.env.GITHUB_RUN_ID),
    })
  },

  async fresh() {
    const action = await checkFresh(createGitHub(), { number: Number(process.env.ISSUE), runId: process.env.GITHUB_RUN_ID })
    output('action', action)
    summary(`Avant publication : ${action}`)
  },

  async published([reportFile]) {
    await onPublished(createGitHub(), {
      number: Number(process.env.ISSUE), pull: Number(process.env.PR), summary: String(readJson(reportFile).summary ?? '').slice(0, 500),
    })
  },

  // Data files for the reviewer: the linked issue with its discussion.
  async 'review-context'([outDir = '.agent']) {
    const context = await loadContext(createGitHub(), issueFromBranch(process.env.HEAD_REF))
    mkdirSync(outDir, { recursive: true })
    writeFileSync(`${outDir}/issue.md`, renderIssue(context.issue, selectDiscussion(context.comments, {
      issueAuthor: context.issue.user.login, trusted: context.trusted,
    })))
  },

  // Publishes the verdict and fails unless the PR conforms: this job is the merge gate.
  async 'review-verdict'([rawFile, diffFile, outFile]) {
    let raw = ''
    try {
      raw = readFileSync(rawFile, 'utf8')
    } catch {
      // No decision written: decideReview reports an unreadable verdict.
    }
    const guard = checkDiff(parseUnifiedDiff(readFileSync(diffFile, 'utf8')))
    const weakenedTests = guard.human.filter((item) => item.rule === 'weakened-test').map((item) => item.message)
    const decision = decideReview(raw, { weakenedTests })
    writeFileSync(outFile, JSON.stringify(decision))
    summary(renderReview(decision))
    await createGitHub().comment(Number(process.env.PR), renderReview(decision))
    if (decision.verdict !== 'pass') process.exitCode = 1
  },

  triage([file, labelsJson = '[]']) {
    let raw = ''
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      // The agent did not write its decision; decideTriage reports it as a failure.
    }
    const decision = decideTriage(raw, { labels: JSON.parse(labelsJson) })
    output('action', decision.action)
    if (decision.action === 'fail') {
      output('reason', `triage impossible. ${decision.reason}`)
      summary(`Triage : échec — ${decision.reason}`)
      return
    }
    const comment = renderTriageComment(decision)
    output('comment', comment)
    output('reason', decision.reason ?? '')
    writeFileSync(file.replace(/\.json$/, '') + '.questions.json', JSON.stringify({ questions: decision.triage.questions }))
    writeFileSync(file.replace(/\.json$/, '') + '.plan.md', comment)
    summary(comment)
  },

  // Exits 0 always; the workflow reads `verdict` (ok | stop | human).
  guard([patchFile, labelsJson = '[]']) {
    const files = parseUnifiedDiff(readFileSync(patchFile, 'utf8'))
    const result = checkDiff(files, { labels: JSON.parse(labelsJson) })
    const verdict = result.stop.length ? 'stop' : result.human.length ? 'human' : 'ok'
    output('verdict', verdict)
    output('changed_lines', result.changedLines)
    output('comment', renderGuardComment(result))
    summary(verdict === 'ok' ? `Garde-fous : OK (${result.changedLines} lignes)` : renderGuardComment(result))
  },

  report([reportFile, issue, changedLines]) {
    let report
    try {
      report = readJson(reportFile)
    } catch {
      report = { summary: 'L’agent n’a pas produit de rapport structuré.', changes: [], tests: [], commands: [], assumptions: [], openQuestions: [] }
    }
    const body = renderReport(report, { issue: issue ? Number(issue) : undefined, changedLines: changedLines ? Number(changedLines) : undefined })
    writeFileSync(reportFile.replace(/\.json$/, '') + '.md', body)
    output('title', (report.title || report.summary || 'Changement proposé par l’agent').slice(0, 72))
    summary(body)
  },

  // Collects the day's activity with the gh CLI and prints the markdown report.
  daily([date = new Date().toISOString().slice(0, 10), outFile]) {
    const gh = (...ghArgs) => JSON.parse(execFileSync('gh', ghArgs, { encoding: 'utf8' }) || '[]')
    const base = process.env.AGENT_BASE_BRANCH || 'staging'
    const fields = 'number,title,url,labels'
    const merged = gh('pr', 'list', '--state', 'merged', '--base', base, '--search', `merged:>=${date}`, '--json', fields)
    const openPulls = gh('pr', 'list', '--state', 'open', '--json', fields)
    const blocked = ['needs-human', 'needs-info', 'agent:failed'].flatMap((label) =>
      gh('issue', 'list', '--state', 'open', '--label', label, '--json', fields))
    const unique = [...new Map(blocked.map((item) => [item.number, item])).values()]
      .map((item) => ({ ...item, labels: item.labels.map((label) => label.name) }))
    const markdown = renderDailyReport({ date, merged, openPulls, blocked: unique, stagingUrl: process.env.STAGING_URL })
    if (outFile) writeFileSync(outFile, markdown)
    summary(markdown)
  },
}

if (!commands[command]) {
  console.error(`Commande inconnue : ${command}. Disponibles : ${Object.keys(commands).join(', ')}`)
  process.exit(2)
}
await commands[command](args)
