#!/usr/bin/env node
// Thin I/O layer over lib.mjs for GitHub Actions. Usage: node scripts/agent/cli.mjs <command> [...args]
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import {
  renderIssue, selectDiscussion,
  checkDiff, decideTriage, nextAttempt, parseUnifiedDiff, renderDailyReport, renderGuardComment, renderReport,
  renderTriageComment,
} from './lib.mjs'

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
  // Writes the issue and its trusted discussion as an untrusted data file the agent reads,
  // instead of interpolating them into YAML. Optional inputs: <outDir>/comments.json (the
  // issue's comments) and <outDir>/trusted.json (commenters with write access).
  'write-issue'([outDir = '.agent']) {
    const event = readJson(process.env.GITHUB_EVENT_PATH)
    const issue = event.issue
    mkdirSync(outDir, { recursive: true })
    const optional = (path) => {
      try {
        return readJson(path)
      } catch {
        return []
      }
    }
    const discussion = selectDiscussion(optional(`${outDir}/comments.json`), {
      issueAuthor: issue.user?.login, trusted: optional(`${outDir}/trusted.json`),
    })
    writeFileSync(`${outDir}/issue.md`, renderIssue(issue, discussion))
    output('labels', JSON.stringify((issue.labels ?? []).map((label) => label.name)))
    output('number', issue.number)
    summary(`Discussion : ${discussion.kept.length} commentaire(s) lu(s), ${discussion.ignored} ignoré(s).`)
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
      output('comment', `### ⚠️ Triage impossible\n\n${decision.reason}`)
      summary(`Triage : échec — ${decision.reason}`)
      return
    }
    const comment = renderTriageComment(decision)
    output('comment', comment)
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

  attempt([labelsJson = '[]']) {
    const attempt = nextAttempt(JSON.parse(labelsJson))
    output('attempt', attempt ?? 'exhausted')
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
commands[command](args)
