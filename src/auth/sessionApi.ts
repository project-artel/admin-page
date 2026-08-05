import { apiFetch, asRecord, asString, readJson, UnauthorizedError } from '../api/orchestration'

export interface AdminSession {
  id: string
  displayName: string
}

/**
 * 현재 세션. 로그인하지 않았으면 null이다.
 *
 * 여기서만 401을 예외가 아니라 값으로 다룬다 — 이 호출의 401은 "세션이 만료됐다"가 아니라
 * "아직 로그인하지 않았다"이고, 그건 오류 화면이 아니라 로그인 경계로 가야 한다.
 */
export async function getSession(signal?: AbortSignal): Promise<AdminSession | null> {
  let response: Response
  try {
    response = await apiFetch('/api/auth/me', { signal })
  } catch (error) {
    if (error instanceof UnauthorizedError) return null
    throw error
  }

  const body = asRecord(await readJson(response))
  return {
    id: asString(body.id, 'id'),
    // displayName만 필수다. 나머지가 없다고 로그인 화면으로 돌려보내면 사용자에게 나갈 길이 없다.
    displayName: asString(body.displayName, 'displayName'),
  }
}
