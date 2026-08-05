const orchestrationUrl = (
  import.meta.env.VITE_ORCHESTRATION_URL ?? 'http://localhost:8080'
).replace(/\/$/, '')

/** orchestration 경로의 절대 URL. `fetch`를 거치지 않는 곳(OAuth 리다이렉트)이 쓴다. */
export function orchestrationUrlFor(path: string): string {
  return `${orchestrationUrl}${path}`
}

export class UnauthorizedError extends Error {
  constructor() {
    super('세션이 만료되었습니다.')
    this.name = 'UnauthorizedError'
  }
}

/** 서버가 거절했거나 응답이 계약과 다를 때. `status`가 0이면 응답 자체를 못 받은 것이다. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let refreshInFlight: Promise<boolean> | null = null

/**
 * refresh 쿠키를 새 access 쿠키로 바꾼다.
 *
 * 한 화면이 여러 패널을 동시에 부르므로 access 토큰이 만료되면 401이 한꺼번에 터진다. 하나의
 * 호출을 공유하지 않으면 각 패널이 따로 재발급하고, 늦게 온 응답이 먼저 온 응답이 막 심어 둔
 * 쿠키를 덮어쓰는 경합이 된다. (artel-home과 같은 이유, 같은 구조.)
 */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${orchestrationUrl}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

/**
 * 401이면 재발급 뒤 **한 번만** 다시 보낸다. 두 번째도 거절당했다면 refresh 쿠키까지 만료된
 * 것이고, 더 시도해 봐야 이미 끝난 세션을 상대로 도는 것이다.
 */
async function sendWithRefresh(send: () => Promise<Response>): Promise<Response> {
  let response = await send()

  if (response.status === 401 && (await refreshSession())) {
    response = await send()
  }

  return response
}

/** 인증이 필요한 호출은 전부 여기를 지난다. 세션 만료 처리가 한 곳에만 있어야 한다. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await sendWithRefresh(() =>
    fetch(`${orchestrationUrl}${path}`, { ...init, credentials: 'include' }),
  )

  if (response.status === 401) {
    throw new UnauthorizedError()
  }

  return response
}

/** 본문을 JSON으로 읽는다. 오류 응답의 본문은 형태를 보장할 수 없어 상태 코드만 남긴다. */
export async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new ApiError(response.status, `요청이 거절되었습니다. (HTTP ${response.status})`)
  }

  try {
    return await response.json()
  } catch {
    throw new ApiError(response.status, '서버 응답을 읽지 못했습니다.')
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(0, '서버 응답 형식이 올바르지 않습니다.')
  }
  return value as Record<string, unknown>
}

export function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ApiError(0, `서버 응답에 ${field}가 없습니다.`)
  }
  return value
}

export function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * 수 필드. 문자열 숫자도 받는다 — `costUsd`는 서버에서 `NUMERIC`이라 직렬화 설정에 따라
 * 문자열로 나갈 수 있고, 그때 조용히 0이 되면 비용 비교가 통째로 틀린다.
 */
export function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** null이 "0"이 아니라 "모른다"인 수. 비용과 평균 소요가 그렇다. */
export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
