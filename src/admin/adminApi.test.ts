import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AdminApiError,
  checkLlmModels,
  createAdminUser,
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
    environmentKeyPresent: false,
    secretsKeyConfigured: true,
    lastCheck: null,
  }

  it('reads settings without any plain key field', () => {
    const settings = parseLlmSettings({ ...settingsBody, apiKey: 'must-not-be-surfaced' })
    expect(settings.maskedKey).toBe('****abcd')
    expect(settings.source).toBe('admin')
    expect(JSON.stringify(settings)).not.toContain('must-not-be-surfaced')
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
