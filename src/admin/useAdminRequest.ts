import { useCallback, useState } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { AdminApiError } from './adminApi'

/** Sentences for the `code` values the admin endpoints answer with. */
const CODE_MESSAGE: Record<string, string> = {
  admin_required: '관리자 권한이 필요합니다. 계정의 등급이 바뀌었을 수 있습니다.',
  last_admin: '마지막 관리자는 등급을 내리거나 비활성화할 수 없습니다. 다른 관리자를 먼저 지정하세요.',
  login_email_missing:
    'GitHub로만 로그인하는 계정이라 비밀번호가 없습니다. 비밀번호를 초기화할 수 없습니다.',
  secrets_key_missing:
    '서버에 ARTEL_SECRETS_KEY가 없어 이 페이지에서 키를 저장할 수 없습니다. 서버 환경 변수 ARTEL_SECRETS_KEY 또는 OPENROUTER_API_KEY를 설정하세요.',
  invalid_api_key: '키 형식이 올바르지 않습니다. 붙여 넣은 값을 확인하세요.',
  email_taken: '이미 이 이메일로 만든 계정이 있습니다.',
  invalid_email: '이메일 형식이 올바르지 않습니다.',
  invalid_name: '이름은 1자 이상 64자 이하여야 합니다.',
}

/**
 * One place that turns a failed admin call into a sentence, or into a session
 * loss. A 403 gets its own wording because it means the account is no longer an
 * administrator, which no retry fixes.
 */
export function useAdminFailure(onSessionLost: () => void) {
  const [error, setError] = useState<string | null>(null)

  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof UnauthorizedError) {
        onSessionLost()
        return
      }
      if (cause instanceof AdminApiError && CODE_MESSAGE[cause.code] !== undefined) {
        setError(CODE_MESSAGE[cause.code])
        return
      }
      if (cause instanceof ApiError && cause.status === 403) {
        setError(CODE_MESSAGE.admin_required)
        return
      }
      setError(cause instanceof ApiError ? cause.message : '요청을 처리하지 못했습니다.')
    },
    [onSessionLost],
  )

  return { error, setError, fail }
}
