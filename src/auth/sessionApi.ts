import { apiFetch, asRecord, asString, readJson, UnauthorizedError } from '../api/orchestration'

export interface AdminSession {
  id: string
  displayName: string
  /**
   * 프로젝트 밖의 등급. 서버가 정하고 화면은 무엇을 요청할지 고르는 데만 쓴다.
   *
   * 인가를 여기서 판단하지 않는다. `DEVELOPER`라고 적힌 값을 받아도 서버가 열지 않은 것은
   * 열리지 않고, 반대로 이 값이 `USER`라고 해서 화면이 무엇을 감추면 그것은 서버가 이미 하는
   * 일을 두 곳에서 하는 것이 된다.
   */
  platformRole: 'USER' | 'DEVELOPER'
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
    // 없으면 USER다. 이 필드를 필수로 두면 서버가 조금 옛 버전일 때 로그인이 통째로 막힌다.
    platformRole: body.platformRole === 'DEVELOPER' ? 'DEVELOPER' : 'USER',
  }
}
