import {
  ApiError,
  apiFetch,
  asNullableString,
  asRecord,
  asString,
  readJson as readPlainJson,
} from '../api/orchestration'

/**
 * Every `/api/admin/*` endpoint shape lives in this file, so a server-side
 * rename touches one module. The shapes follow the "API contract" table in
 * `.plan/general/2026-10-06-self-host-with-email-login-and-openrouter-key.md`;
 * where the plan names no field, the camelCase name used here is an assumption
 * and the parsers accept the obvious alternatives.
 */

export type PlatformRole = 'USER' | 'DEVELOPER' | 'ADMIN'
export const PLATFORM_ROLES: readonly PlatformRole[] = ['USER', 'DEVELOPER', 'ADMIN']

export interface AdminUser {
  id: string
  /** The name shown for the account; `nickname` and `userTag` are not needed here. */
  displayName: string
  /** Address the person signs in with by email. `null` for an account that only uses GitHub. */
  loginEmail: string | null
  /** Contact address, which may exist without a password login. */
  email: string | null
  platformRole: PlatformRole
  disabled: boolean
  hasPassword: boolean
  mustChangePassword: boolean
  oauthProviders: string[]
  createdAt: string | null
}

/** A password the server shows exactly once. Never persist it beyond the screen that displays it. */
export interface TemporaryPasswordResult {
  user: AdminUser
  temporaryPassword: string
}

export interface CreateUserRequest {
  email: string
  name: string
  platformRole: PlatformRole
}

export type LlmKeySource = 'admin' | 'environment' | 'none'

export type LlmCheckError = 'no_key' | 'invalid_key' | 'upstream_unavailable'

export interface LlmKeyCheck {
  checkedAt: string | null
  source: LlmKeySource
  maskedKey: string | null
  /** Whether OpenRouter accepted the key. `null` when no check reached it. */
  keyValid: boolean | null
  requiredModels: string[]
  reachableModels: string[]
  missingModels: string[]
  /** Why the check could not finish, or `null` when it did. */
  error: LlmCheckError | null
}

export interface LlmSettings {
  /** Whether some key is in effect. */
  configured: boolean
  source: LlmKeySource
  /** The server's masked tail such as `****abcd`. The full key is never sent. */
  maskedKey: string | null
  adminKeyStored: boolean
  /** A stored key exists but cannot be decrypted, so it must be set again. */
  adminKeyUnreadable: boolean
  adminKeyUpdatedAt: string | null
  environmentKeyPresent: boolean
  /** False when `ARTEL_SECRETS_KEY` is missing, so the admin page cannot store a key. */
  secretsKeyConfigured: boolean
  lastCheck: LlmKeyCheck | null
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * An admin call the server refused with `{code, message, fields}`. `code` is
 * what screens map to a sentence (`last_admin`, `secrets_key_missing`, ...);
 * it is empty when the body had none.
 */
export class AdminApiError extends ApiError {
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(status, message)
    this.name = 'AdminApiError'
    this.code = code
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.ok) return readPlainJson(response)
  let code = ''
  let message = `요청이 거절되었습니다. (HTTP ${response.status})`
  try {
    const body = (await response.json()) as Record<string, unknown>
    if (typeof body.code === 'string') code = body.code
    if (typeof body.message === 'string' && body.message !== '') message = body.message
  } catch {
    // The body is optional; the status alone still describes the refusal.
  }
  throw new AdminApiError(response.status, code, message)
}

export function parseRole(value: unknown): PlatformRole {
  return value === 'ADMIN' || value === 'DEVELOPER' ? value : 'USER'
}

export function parseAdminUser(raw: unknown): AdminUser {
  const row = asRecord(raw)
  return {
    id: String(row.id ?? ''),
    displayName: asNullableString(row.displayName) ?? asNullableString(row.nickname) ?? '',
    loginEmail: asNullableString(row.loginEmail),
    email: asNullableString(row.email),
    platformRole: parseRole(row.platformRole),
    disabled: row.disabled === true,
    hasPassword: row.hasPassword === true,
    mustChangePassword: row.mustChangePassword === true,
    oauthProviders: Array.isArray(row.oauthProviders)
      ? row.oauthProviders.filter((value): value is string => typeof value === 'string')
      : [],
    createdAt: asNullableString(row.createdAt),
  }
}

function parseUserList(body: unknown): AdminUser[] {
  const items = Array.isArray(body) ? body : asRecord(body).items
  return Array.isArray(items) ? items.map(parseAdminUser) : []
}

export function parseTemporaryPassword(body: unknown): TemporaryPasswordResult {
  const record = asRecord(body)
  return {
    temporaryPassword: asString(record.temporaryPassword, 'temporaryPassword'),
    user: parseAdminUser(record.user),
  }
}

export async function listAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  return parseUserList(await readJson(await apiFetch('/api/admin/users', { signal })))
}

export async function createAdminUser(request: CreateUserRequest): Promise<TemporaryPasswordResult> {
  const response = await apiFetch('/api/admin/users', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(request),
  })
  return parseTemporaryPassword(await readJson(response))
}

export async function resetAdminUserPassword(userId: string): Promise<TemporaryPasswordResult> {
  const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
  })
  return parseTemporaryPassword(await readJson(response))
}

/** Sends only the fields that change. */
export async function updateAdminUser(
  userId: string,
  change: { platformRole?: PlatformRole; disabled?: boolean },
): Promise<AdminUser> {
  const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(change),
  })
  return parseAdminUser(await readJson(response))
}

function parseSource(value: unknown): LlmKeySource {
  return value === 'admin' || value === 'environment' ? value : 'none'
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function parseCheckError(value: unknown): LlmCheckError | null {
  return value === 'no_key' || value === 'invalid_key' || value === 'upstream_unavailable' ? value : null
}

export function parseLlmKeyCheck(raw: unknown): LlmKeyCheck {
  const record = asRecord(raw)
  return {
    checkedAt: asNullableString(record.checkedAt),
    source: parseSource(record.source),
    maskedKey: asNullableString(record.maskedKey),
    keyValid: typeof record.keyValid === 'boolean' ? record.keyValid : null,
    requiredModels: parseStringList(record.requiredModels),
    reachableModels: parseStringList(record.reachableModels),
    missingModels: parseStringList(record.missingModels),
    error: parseCheckError(record.error),
  }
}

export function parseLlmSettings(body: unknown): LlmSettings {
  const record = asRecord(body)
  const lastCheck = record.lastCheck
  return {
    configured: record.configured === true,
    source: parseSource(record.source),
    maskedKey: asNullableString(record.maskedKey),
    adminKeyStored: record.adminKeyStored === true,
    adminKeyUnreadable: record.adminKeyUnreadable === true,
    adminKeyUpdatedAt: asNullableString(record.adminKeyUpdatedAt),
    environmentKeyPresent: record.environmentKeyPresent === true,
    // Missing means an older server that never needed the key; do not block saving.
    secretsKeyConfigured: record.secretsKeyConfigured !== false,
    lastCheck: typeof lastCheck === 'object' && lastCheck !== null ? parseLlmKeyCheck(lastCheck) : null,
  }
}

export async function getLlmSettings(signal?: AbortSignal): Promise<LlmSettings> {
  return parseLlmSettings(await readJson(await apiFetch('/api/admin/settings/llm', { signal })))
}

/**
 * Sets the key, or clears it when `apiKey` is `null`. The answer is read back as
 * settings, which carry only the masked tail, so the plain key never returns.
 */
export async function putLlmKey(apiKey: string | null): Promise<LlmSettings> {
  const response = await apiFetch('/api/admin/settings/llm', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ apiKey }),
  })
  return parseLlmSettings(await readJson(response))
}

export async function checkLlmModels(): Promise<LlmKeyCheck> {
  const response = await apiFetch('/api/admin/settings/llm/check', { method: 'POST' })
  return parseLlmKeyCheck(await readJson(response))
}
