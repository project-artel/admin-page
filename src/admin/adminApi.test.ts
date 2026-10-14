import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AdminApiError,
  checkBedrockModels,
  checkLlmModels,
  getBedrockSettings,
  invalidateLlmCache,
  parseBedrockSettings,
  parseCacheInvalidation,
  putBedrockKey,
  createAdminUser,
  listLlmModels,
  parseAdminLlmModel,
  setLlmModelEnabled,
  parseLlmSettings,
  parseTemporaryPassword,
  putLlmKey,
  resetAdminUserPassword,
  updateAdminUser,
} from './adminApi'

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const userBody = {
  id: '7',
  displayName: 'Ada',
  nickname: 'Ada',
  userTag: '0001',
  email: null,
  loginEmail: 'a@b.co',
  platformRole: 'USER',
  disabled: false,
  hasPassword: true,
  mustChangePassword: true,
  oauthProviders: ['github'],
  createdAt: '2026-10-06T00:00:00Z',
}

describe('admin user endpoints', () => {
  it('posts the new account and reads the one-time password', async () => {
    const fetchMock = stubFetch({ user: userBody, temporaryPassword: 'x'.repeat(20) }, 201)

    const result = await createAdminUser({ email: 'a@b.co', name: 'Ada', platformRole: 'USER' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/users')
    expect(init.method).toBe('POST')
    expect(result.temporaryPassword).toHaveLength(20)
    expect(result.user.loginEmail).toBe('a@b.co')
    expect(result.user.oauthProviders).toEqual(['github'])
    expect(result.user.mustChangePassword).toBe(true)
  })

  it('rejects a creation response without a temporary password', () => {
    expect(() => parseTemporaryPassword({ user: userBody })).toThrow()
  })

  it('carries the error code of a refused reset', async () => {
    stubFetch({ code: 'login_email_missing', message: 'no email', fields: {} }, 409)
    await expect(resetAdminUserPassword('7')).rejects.toMatchObject({
      status: 409,
      code: 'login_email_missing',
    })
  })

  it('patches only the field that changes and reads the user back', async () => {
    const fetchMock = stubFetch(userBody)
    const user = await updateAdminUser('7', { disabled: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/users/7')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ disabled: true })
    expect(user.id).toBe('7')
  })

  it('surfaces last_admin as a typed error', async () => {
    stubFetch({ code: 'last_admin', message: 'x', fields: {} }, 409)
    const error = await updateAdminUser('7', { platformRole: 'USER' }).catch((e) => e)
    expect(error).toBeInstanceOf(AdminApiError)
    expect(error.code).toBe('last_admin')
  })
})

describe('OpenRouter key endpoints', () => {
  const settingsBody = {
    configured: true,
    source: 'admin',
    maskedKey: '****abcd',
    adminKeyStored: true,
    adminKeyUnreadable: false,
    adminKeyUpdatedAt: '2026-10-06T00:00:00Z',
    secretsKeyConfigured: true,
    lastCheck: null,
  }

  it('reads settings without any plain key field', () => {
    const settings = parseLlmSettings({ ...settingsBody, apiKey: 'must-not-be-surfaced' })
    expect(settings.maskedKey).toBe('****abcd')
    expect(settings.source).toBe('admin')
    expect(JSON.stringify(settings)).not.toContain('must-not-be-surfaced')
  })

  it('treats the removed environment source as none', () => {
    expect(parseLlmSettings({ source: 'environment', configured: false }).source).toBe('none')
  })

  it('treats an unknown source as none and a missing flag as saving allowed', () => {
    const settings = parseLlmSettings({ source: 'SOMETHING' })
    expect(settings.source).toBe('none')
    expect(settings.secretsKeyConfigured).toBe(true)
  })

  it('reports an unconfigured secrets key', () => {
    expect(parseLlmSettings({ ...settingsBody, secretsKeyConfigured: false }).secretsKeyConfigured).toBe(false)
  })

  it('clears the key by sending null', async () => {
    const fetchMock = stubFetch({ ...settingsBody, configured: false, source: 'none', maskedKey: null })
    await putLlmKey(null)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/settings/llm')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ apiKey: null })
  })

  it('surfaces secrets_key_missing from a save', async () => {
    stubFetch({ code: 'secrets_key_missing', message: 'x', fields: {} }, 409)
    await expect(putLlmKey('sk-or-abc')).rejects.toMatchObject({ code: 'secrets_key_missing' })
  })

  it('reads which required models the key reaches', async () => {
    stubFetch({
      checkedAt: '2026-10-06T00:00:00Z',
      source: 'admin',
      maskedKey: '****abcd',
      keyValid: true,
      requiredModels: ['a', 'b'],
      reachableModels: ['a'],
      missingModels: ['b'],
      error: null,
    })
    const check = await checkLlmModels()
    expect(check.requiredModels).toEqual(['a', 'b'])
    expect(check.reachableModels).toEqual(['a'])
    expect(check.missingModels).toEqual(['b'])
    expect(check.error).toBeNull()
  })

  it('reads a check that could not reach OpenRouter', async () => {
    stubFetch({ checkedAt: null, source: 'none', maskedKey: null, keyValid: null, requiredModels: [],
      reachableModels: [], missingModels: [], error: 'no_key' })
    expect((await checkLlmModels()).error).toBe('no_key')
  })
})

describe('admin llm model endpoints', () => {
  const modelBody = {
    id: 'bedrock/us.openai.gpt-6.1-sol',
    label: 'GPT-6.1 Sol (AWS Bedrock)',
    provider: 'openai',
    route: 'bedrock',
    enabled: false,
    supportsVision: true,
    maxInputTokens: 922000,
    updatedAt: '2026-10-14T00:00:00Z',
  }

  it('parses a catalog row', () => {
    expect(parseAdminLlmModel(modelBody)).toEqual(modelBody)
  })

  it('falls back to safe values for missing or malformed fields', () => {
    const parsed = parseAdminLlmModel({ id: 'google/gemma-4-31b-it:free', enabled: 'yes', maxInputTokens: 'x' })
    expect(parsed).toEqual({
      id: 'google/gemma-4-31b-it:free',
      label: 'google/gemma-4-31b-it:free',
      provider: '',
      route: 'openrouter',
      enabled: false,
      supportsVision: false,
      maxInputTokens: null,
      updatedAt: null,
    })
    expect(parseAdminLlmModel({ id: 'bedrock/x' }).route).toBe('bedrock')
  })

  it('lists rows from a bare array or an items wrapper', async () => {
    stubFetch([modelBody])
    expect(await listLlmModels()).toHaveLength(1)
    stubFetch({ items: [modelBody, modelBody] })
    expect(await listLlmModels()).toHaveLength(2)
    stubFetch({})
    expect(await listLlmModels()).toEqual([])
  })

  it('patches with the id in the body and reads back the row', async () => {
    const fetchMock = stubFetch({ ...modelBody, enabled: true })

    const result = await setLlmModelEnabled(modelBody.id, true)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/llm-models')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ id: modelBody.id, enabled: true })
    expect(result.enabled).toBe(true)
  })

  it('raises the server code on a refusal', async () => {
    stubFetch({ code: 'not_found', message: 'unknown model' }, 404)
    await expect(setLlmModelEnabled('nope', true)).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })
})

describe('Bedrock key endpoints', () => {
  const bedrockBody = {
    configured: true,
    maskedKey: '…abcd',
    updatedAt: '2026-10-14T00:00:00Z',
    region: 'us-west-2',
    lastCheck: {
      checkedAt: '2026-10-14T00:01:00Z',
      keyConfigured: true,
      models: [
        { id: 'bedrock/a', reachable: true, error: null },
        { id: 'bedrock/b', reachable: false, error: 'not available' },
      ],
    },
  }

  it('parses settings with the last check', () => {
    expect(parseBedrockSettings(bedrockBody)).toEqual(bedrockBody)
  })

  it('falls back to safe values for a malformed body', () => {
    expect(parseBedrockSettings({ lastCheck: 'x', models: 3 })).toEqual({
      configured: false,
      maskedKey: null,
      updatedAt: null,
      region: null,
      lastCheck: null,
    })
    const check = parseBedrockSettings({ lastCheck: { models: [{ id: 'm', reachable: 'yes' }] } }).lastCheck
    expect(check?.keyConfigured).toBe(false)
    expect(check?.models[0]).toEqual({ id: 'm', reachable: false, error: null })
    expect(check?.models).toHaveLength(1)
  })

  it('reads settings from the bedrock path', async () => {
    const fetchMock = stubFetch(bedrockBody)
    expect((await getBedrockSettings()).region).toBe('us-west-2')
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/admin/settings/bedrock')
  })

  it('saves and deletes the key through PUT', async () => {
    const fetchMock = stubFetch(bedrockBody)
    await putBedrockKey('abc')
    await putBedrockKey(null)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/settings/bedrock')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ apiKey: 'abc' })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ apiKey: null })
  })

  it('surfaces secrets_key_missing from a save', async () => {
    stubFetch({ code: 'secrets_key_missing', message: 'x' }, 409)
    await expect(putBedrockKey('abc')).rejects.toMatchObject({ status: 409, code: 'secrets_key_missing' })
  })

  it('posts the check and reads per-model results', async () => {
    const fetchMock = stubFetch(bedrockBody.lastCheck)
    const check = await checkBedrockModels()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/settings/bedrock/check')
    expect(init.method).toBe('POST')
    expect(check.models.map((model) => model.reachable)).toEqual([true, false])
    expect(check.models[1].error).toBe('not available')
  })
})

describe('cache invalidation endpoint', () => {
  it('posts and reads the result', async () => {
    const fetchMock = stubFetch({ agentServerInvalidated: true, error: null })
    const result = await invalidateLlmCache()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/admin/settings/llm/invalidate-cache')
    expect(init.method).toBe('POST')
    expect(result).toEqual({ agentServerInvalidated: true, error: null })
  })

  it('treats a missing flag as not invalidated and keeps the error text', () => {
    expect(parseCacheInvalidation({ error: 'timeout' })).toEqual({ agentServerInvalidated: false, error: 'timeout' })
    expect(() => parseCacheInvalidation(null)).toThrow()
  })
})
