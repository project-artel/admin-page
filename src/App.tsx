import { useCallback, useEffect, useState } from 'react'
import { getSession, type AdminSession } from './auth/sessionApi'
import { KnowledgeStatsDashboard } from './knowledgeStats/KnowledgeStatsDashboard'
import { QaStatsDashboard } from './qaStats/QaStatsDashboard'
import './qaStats/dashboard.css'

const homeUrl = (import.meta.env.VITE_HOME_URL ?? 'http://localhost:5173').replace(/\/$/, '')

type SessionState =
  | { kind: 'checking' }
  | { kind: 'signed-in'; user: AdminSession }
  | { kind: 'signed-out' }

/**
 * 화면 두 개는 같은 축(model / prompt / arch)으로 접히지만 묻는 것이 다르다.
 *   qa        — 에이전트가 테스트를 잘 돌렸나
 *   knowledge — 에이전트가 만든 지식이 쓸모 있나
 * 한 화면에 섞으면 세는 단위가 다른 표(런 vs content 버전)가 나란히 놓여 합이 맞아 보인다.
 */
type View = 'qa' | 'knowledge'

export function App() {
  const [session, setSession] = useState<SessionState>({ kind: 'checking' })
  const [view, setView] = useState<View>('qa')

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

  const nav = <ViewTabs view={view} onChange={setView} />

  return view === 'qa' ? (
    <QaStatsDashboard onSessionLost={signOut} nav={nav} />
  ) : (
    <KnowledgeStatsDashboard onSessionLost={signOut} nav={nav} />
  )
}

/**
 * 화면 전환.
 *
 * 라우터를 두지 않는다 — 화면이 둘뿐이고, 주소를 갖게 하려면 로그인 경계와 리다이렉트까지 함께
 * 정해야 한다. 그건 화면이 더 늘 때 한 번에 할 일이다.
 *
 * 선택 상태를 색이 아니라 `aria-pressed`로도 말한다.
 */
function ViewTabs({ view, onChange }: { view: View; onChange: (next: View) => void }) {
  return (
    <span className="field" role="group" aria-label="화면 선택">
      <button
        type="button"
        className={view === 'qa' ? 'control control--action' : 'control'}
        aria-pressed={view === 'qa'}
        onClick={() => onChange('qa')}
      >
        QA 실행
      </button>
      <button
        type="button"
        className={view === 'knowledge' ? 'control control--action' : 'control'}
        aria-pressed={view === 'knowledge'}
        onClick={() => onChange('knowledge')}
      >
        지식창고
      </button>
    </span>
  )
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
