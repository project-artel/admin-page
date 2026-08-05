import { useCallback, useEffect, useState } from 'react'
import { getSession, type AdminSession } from './auth/sessionApi'
import { QaStatsDashboard } from './qaStats/QaStatsDashboard'
import './qaStats/dashboard.css'

const homeUrl = (import.meta.env.VITE_HOME_URL ?? 'http://localhost:5173').replace(/\/$/, '')

type SessionState =
  | { kind: 'checking' }
  | { kind: 'signed-in'; user: AdminSession }
  | { kind: 'signed-out' }

export function App() {
  const [session, setSession] = useState<SessionState>({ kind: 'checking' })

  useEffect(() => {
    const controller = new AbortController()
    getSession(controller.signal)
      .then((user) => {
        setSession(user === null ? { kind: 'signed-out' } : { kind: 'signed-in', user })
      })
      .catch(() => {
        // 세션 확인 자체가 실패하면 로그인 경계로 보낸다. 여기서 오류 화면을 띄우면
        // 사용자에게 나갈 길이 없다.
        if (!controller.signal.aborted) setSession({ kind: 'signed-out' })
      })
    return () => controller.abort()
  }, [])

  const signOut = useCallback(() => setSession({ kind: 'signed-out' }), [])

  if (session.kind === 'checking') {
    return (
      <div className="boundary">
        <p className="notice">세션을 확인하는 중입니다…</p>
      </div>
    )
  }

  if (session.kind === 'signed-out') {
    return <SignInBoundary />
  }

  return <QaStatsDashboard onSessionLost={signOut} />
}

/**
 * 로그인 경계.
 *
 * 자체 OAuth 화면을 두지 않는다 — 세션 쿠키는 orchestration 도메인에 붙고 artel-home이 이미 그
 * 흐름을 갖고 있다. 여기에 두 번째 로그인 진입점을 만들면 리다이렉트 대상이 둘이 되고, 둘 중
 * 하나는 반드시 먼저 낡는다.
 */
function SignInBoundary() {
  return (
    <div className="boundary">
      <div className="boundary__inner notice">
        <p className="notice__title">로그인이 필요합니다</p>
        <p>
          ARTEL 세션으로 로그인한 뒤 이 페이지를 새로고침하세요.{' '}
          <a className="link" href={homeUrl}>
            artel-home에서 로그인
          </a>
        </p>
      </div>
    </div>
  )
}
