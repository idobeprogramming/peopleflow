// GitHub access for router.mjs, used only in Actions. Reads and dispatches use the workflow token
// (GH_TOKEN); only a demo merge uses the App token, so that the push behaves like a person's.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENT_WORKFLOW } from './router.mjs'

const STATUS_LABELS = ['agent:ready', 'agent:working', 'agent:review', 'agent:failed', 'needs-info', 'needs-human']

export function createGitHub(env = process.env) {
  const repo = env.GITHUB_REPOSITORY
  const server = env.GITHUB_SERVER_URL || 'https://github.com'

  async function request(method, path, body, { token = env.GH_TOKEN, allow = [] } = {}) {
    const url = path.startsWith('http') ? path : `${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repo}${path}`
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok && !allow.includes(response.status)) {
      throw new Error(`HTTP ${response.status} ${method} ${path} : ${(await response.text()).slice(0, 300)}`)
    }
    const text = await response.text()
    return { status: response.status, link: response.headers.get('link') ?? '', data: text ? JSON.parse(text) : null }
  }
  const get = async (path) => (await request('GET', path)).data
  async function all(path, pick = (data) => data) {
    const items = []
    let next = `${path}${path.includes('?') ? '&' : '?'}per_page=100`
    while (next) {
      const page = await request('GET', next)
      items.push(...pick(page.data))
      next = /<([^>]+)>; rel="next"/.exec(page.link)?.[1]
    }
    return items
  }
  const gh = (...args) => execFileSync('gh', [...args, '--repo', repo], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })

  /** Downloads an artifact file from a run, or returns null when it does not exist. */
  function artifact(runId, name, file) {
    const dir = mkdtempSync(join(tmpdir(), 'agent-'))
    try {
      gh('run', 'download', String(runId), '--name', name, '--dir', dir)
    } catch {
      return null
    }
    const path = join(dir, file)
    return existsSync(path) ? readFileSync(path, 'utf8') : null
  }
  const json = (text) => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  return {
    repo,
    server,
    artifact,
    maintainer: env.AGENT_MAINTAINER || env.GITHUB_REPOSITORY_OWNER,
    baseBranch: env.AGENT_BASE_BRANCH || 'staging',
    appLogin: env.APP_SLUG ? `${env.APP_SLUG}[bot]` : '',
    demoAutoMerge: env.DEMO_AUTO_MERGE !== 'off',
    runUrl: (id) => `${server}/${repo}/actions/runs/${id}`,
    async permission(login) {
      const { status, data } = await request('GET', `/collaborators/${encodeURIComponent(login)}/permission`, undefined, { allow: [404] })
      return status === 404 ? 'none' : data.permission
    },
    issue: (number) => get(`/issues/${number}`),
    comments: (number) => all(`/issues/${number}/comments`),
    reviewComments: async (number) => (await all(`/pulls/${number}/comments`))
      .map((item) => ({ ...item, body: `\`${item.path}:${item.line ?? '?'}\` — ${item.body}` })),
    pull: (number) => get(`/pulls/${number}`),
    pulls: () => all('/pulls?state=all'),
    async branchSha(branch) {
      const { status, data } = await request('GET', `/branches/${encodeURIComponent(branch)}`, undefined, { allow: [404] })
      return status === 404 ? null : data.commit.sha
    },
    async saveState(number, id, body) {
      const { data } = id
        ? await request('PATCH', `/issues/comments/${id}`, { body })
        : await request('POST', `/issues/${number}/comments`, { body })
      return data.id
    },
    comment: (number, body) => request('POST', `/issues/${number}/comments`, { body: body.slice(0, 60000) }),
    async setStatus(number, label) {
      if (label) await request('POST', `/issues/${number}/labels`, { labels: [label] })
      for (const other of STATUS_LABELS.filter((item) => item !== label)) {
        await request('DELETE', `/issues/${number}/labels/${encodeURIComponent(other)}`, undefined, { allow: [404] })
      }
    },
    dispatch: (inputs) => request('POST', '/actions/workflows/issue-agent.yml/dispatches', {
      ref: env.DEFAULT_BRANCH || 'main',
      inputs: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, String(value ?? '')])),
    }),
    /** Waits for an agent run to finish: its logs and its retry are refused before that. */
    async finishedAgentRun(id) {
      if (!/^[0-9]+$/.test(id ?? '')) throw new Error(`Numéro de run invalide : ${id}`)
      for (let tries = 0; tries < 60; tries += 1) {
        const run = await get(`/actions/runs/${id}`)
        if (!run.path.startsWith('.github/workflows/issue-agent.yml')) throw new Error(`Le run ${id} n’est pas un run de l’agent`)
        if (run.status === 'completed') return { ...run, name: AGENT_WORKFLOW }
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
      throw new Error(`Le run ${id} n’est toujours pas terminé`)
    },
    jobs: async (id) => (await all(`/actions/runs/${id}/jobs?filter=latest`, (data) => data.jobs))
      .map((job) => ({ name: job.name, conclusion: job.conclusion, url: job.html_url, steps: job.steps })),
    async log(id) {
      try {
        return gh('run', 'view', String(id), '--log-failed')
      } catch {
        return ''
      }
    },
    report: async (id) => json(artifact(id, 'proposal', 'report.json')),
    review: async (id) => json(artifact(id, 'review-verdict', 'verdict.json')),
    async latestRun(file, sha) {
      const { workflow_runs: runs } = await get(`/actions/workflows/${file}/runs?head_sha=${sha}&event=pull_request&per_page=20`)
      return runs.sort((a, b) => b.id - a.id)[0]
    },
    rerunFailed: (id) => request('POST', `/actions/runs/${id}/rerun-failed-jobs`),
    rerun: (id) => request('POST', `/actions/runs/${id}/rerun`),
    merge: (number, sha) => request('PUT', `/pulls/${number}/merge`, { merge_method: 'squash', sha }, { token: env.APP_TOKEN }),
  }
}
