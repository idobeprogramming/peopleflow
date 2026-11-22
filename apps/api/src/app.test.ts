import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

describe('GET /api/health', () => {
  it('returns a successful health response', async () => {
    const response = await createApp().request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/health version', () => {
  it('reports the deployed version so smoke tests can wait for the new release', async () => {
    process.env.APP_VERSION = 'abc1234'
    try {
      expect(await (await createApp().request('/api/health')).json()).toEqual({ status: 'ok', version: 'abc1234' })
    } finally {
      delete process.env.APP_VERSION
    }
  })
})
