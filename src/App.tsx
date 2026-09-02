import { useCallback, useEffect, useState } from 'react'
import { getSession, type AdminSession } from './auth/sessionApi'
import { ExpectedLabelsView } from './expectedLabels/ExpectedLabelsView'
import { KnowledgeGraphDashboard } from './knowledgeGraph/KnowledgeGraphDashboard'
import { KnowledgeStatsDashboard } from './knowledgeStats/KnowledgeStatsDashboard'
import { LlmUsageDashboard } from './llmUsage/LlmUsageDashboard'
import { QaStatsDashboard } from './qaStats/QaStatsDashboard'
import './qaStats/dashboard.css'

const homeUrl = (import.meta.env.VITE_HOME_URL ?? 'http://localhost:5173').replace(/\/$/, '')

type SessionState =
  | { kind: 'checking' }
  | { kind: 'signed-in'; user: AdminSession }
  | { kind: 'signed-out' }

/**
 * 앞의 두 화면은 같은 축(model / prompt / arch)으로 접히지만 묻는 것이 다르다.
 *   qa        — 에이전트가 테스트를 잘 돌렸나
 *   knowledge — 에이전트가 만든 지식이 쓸모 있나
 * 한 화면에 섞으면 세는 단위가 다른 표(런 vs content 버전)가 나란히 놓여 합이 맞아 보인다.
 *
 * `graph`는 축이 아예 없다.
 *   graph     — 지식들이 서로 어떤 관계로 얽혀 있나
 * 집계가 아니라 지도라, 앞의 둘과 나란히 두면 같은 축으로 접히는 표처럼 읽힌다. 그래서 탭을
 * 나눈다.
 *
 * `labels`는 대시보드가 아니라 그 셋의 **입력**이다. QA 화면의 미탐·오탐·미보고가 전부 이 라벨과
 * 대조해 나온 값이라, 라벨을 다는 자리가 그 숫자를 읽는 자리와 같은 도구 안에 있어야 한다 —
 * 제품 화면에 두면 제품 사용자가 정답지를 건드리고, 라벨 품질이 곧 벤치마크 신뢰도다.
 *
 * `usage`는 세는 단위가 앞의 셋과 또 다르다.
 *   usage     — 그걸 돌리는 데 돈이 얼마 들었나
 * `qa`도 토큰과 비용을 보여주지만 그것은 런을 실행 설정 4-튜플로 **분할**해 센 것이고, 이쪽은
 * LLM 호출 하나하나를 기능·모델·프로젝트·일자로 각각 접는다. 게다가 QA 화면은 QA 실행 지출만
 * 덮는다 — 시나리오 작성과 임베딩은 저기 안 나온다. 한 화면에 섞으면 합이 맞아 보이는 두 표가
 * 나란히 놓인다.
 */
type View = 'qa' | 'knowledge' | 'graph' | 'labels' | 'usage'

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
  // 화면이 이 값으로 판단하는 것은 무엇을 요청할지 하나뿐이다. 인가는 서버가 한다.
  const all = session.user.platformRole === 'DEVELOPER'

  if (view === 'qa') return <QaStatsDashboard onSessionLost={signOut} nav={nav} seesAllProjects={all} />
  if (view === 'usage') return <LlmUsageDashboard onSessionLost={signOut} nav={nav} seesAllProjects={all} />
  if (view === 'knowledge')
    return <KnowledgeStatsDashboard onSessionLost={signOut} nav={nav} seesAllProjects={all} />
  if (view === 'graph')
    return <KnowledgeGraphDashboard onSessionLost={signOut} nav={nav} seesAllProjects={all} />
  return <ExpectedLabelsView onSessionLost={signOut} nav={nav} seesAllProjects={all} />
}

const TABS: Array<{ view: View; label: string }> = [
  { view: 'qa', label: 'QA 실행' },
  { view: 'usage', label: '토큰 사용량' },
  { view: 'knowledge', label: '지식창고' },
  { view: 'graph', label: '지식 그래프' },
  { view: 'labels', label: '기대 판정 라벨' },
]

/**
 * 화면 전환.
 *
 * 라우터를 두지 않는다 — 화면이 몇 개뿐이고, 주소를 갖게 하려면 로그인 경계와 리다이렉트까지
 * 함께 정해야 한다. 그건 화면이 더 늘 때 한 번에 할 일이다.
 *
 * 선택 상태를 색이 아니라 `aria-pressed`로도 말한다.
 */
function ViewTabs({ view, onChange }: { view: View; onChange: (next: View) => void }) {
  return (
    <span className="field" role="group" aria-label="화면 선택">
      {TABS.map((tab) => (
        <button
          key={tab.view}
          type="button"
          className={view === tab.view ? 'control control--action' : 'control'}
          aria-pressed={view === tab.view}
          onClick={() => onChange(tab.view)}
        >
          {tab.label}
        </button>
      ))}
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
