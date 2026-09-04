import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { listProjects, type ProjectSummary } from '../projects/projectsApi'
import { ALL_PROJECTS } from '../projects/pick'
import { ProjectPicker } from '../projects/ProjectPicker'
import { applyTheme, type Theme } from '../theme'
import { AxisBreakdown } from './AxisBreakdown'
import { CombinationMatrix } from './CombinationMatrix'
import { RecentRuns } from './RecentRuns'
import { ScoreBreakdown } from './ScoreBreakdown'
import { TotalsRail } from './TotalsRail'
import { toDateInputValue } from './format'
import { fetchQaLabels, fetchQaStats, fetchRecentQaTries } from './qaStatsApi'
import { AXES, type QaStats, type QaTrySummary } from './qaStatsTypes'
import { activeProjectId, listTestRuns, type TestRunSummary } from './testRunsApi'
import './dashboard.css'

const RECENT_RUN_COUNT = 30
const DEFAULT_WINDOW_DAYS = 30
/** `<select>`의 "전체" 줄. 빈 문자열을 쓰면 "아직 안 고름"과 구분되지 않는다(`ALL_PROJECTS`와 같은 이유). */
const ALL_TEST_RUNS = 'all'
/**
 * label 선택기의 "전체" 줄. **여기서는 빈 문자열이 맞다.**
 *
 * ALL_TEST_RUNS·ALL_PROJECTS가 `'all'`인 것은 그 자리에 오는 값이 숫자 id 라 `'all'`과 절대
 * 겹치지 않기 때문이다. `label`은 자유 문자열이라 그 보장이 없다 — 누가 실험 이름을 `all`로
 * 지으면 "전체"와 구분되지 않는다. 서버가 `label`의 앞뒤 공백을 지우고 그러고도 비면 null로
 * 읽으므로 빈 문자열은 절대 실제 이름일 수 없고, 그래서 이쪽이 유일하게 안전한 sentinel이다.
 */
const ALL_LABELS = ''

/** 로컬 달력 기준 자정. 기간 경계를 UTC로 자르면 한국에서 하루가 밀린다. */
function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

interface Loaded {
  stats: QaStats
  runs: QaTrySummary[]
}

export function QaStatsDashboard({
  onSessionLost,
  nav,
  seesAllProjects,
}: {
  onSessionLost: () => void
  /** `DEVELOPER` 등급인지. 선택기가 전 프로젝트를 부를지 고르는 데만 쓴다. */
  seesAllProjects: boolean
  /** 화면 전환 탭. 대시보드가 자기 topbar를 가지고 있어 여기로 받아 끼운다. */
  nav?: ReactNode
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  // `to`는 배타 경계라 "오늘까지"는 내일 자정이다.
  const [to, setTo] = useState(() => addDays(startOfDay(new Date()), 1))
  const [from, setFrom] = useState(() => addDays(startOfDay(new Date()), -DEFAULT_WINDOW_DAYS))
  // 9011(프로브)·9012(L1 상세)·9013(L2 중간)·9014(L3 추상)처럼 난이도별로 쪼갠 test run을
  // 하나 골라 보는 자리다. 기본값은 반드시 null(전체)이다 — qaStatsApi.ts의 QaStatsQuery 주석
  // 참고.
  const [testRunId, setTestRunId] = useState<string | null>(null)
  // null이면 "부를 프로젝트가 없음" 또는 "부르는 중"이고, 배열이면 로드가 끝난 것(빈 배열도
  // 포함)이다. 선택기의 disabled·안내 문구가 이 상태를 그대로 따라간다.
  const [testRuns, setTestRuns] = useState<TestRunSummary[] | null>(null)
  // testRunId와 독립인 필터다. 자유 입력이 아니라 이미 쓰인 label 목록에서 고르게 한다 —
  // 자유 문자열을 허용하면 "content map 1차"와 "content map 1차 실험"이 같은 실험인데도
  // 두 칸으로 갈릴 수 있고, 고르게 만들면 tag 체계 없이 그것이 막힌다. 새 이름을 짓는 자리는
  // 여기가 아니라 런을 걸 때다.
  const [label, setLabel] = useState<string | null>(null)
  // null이면 "부를 프로젝트가 없음" 또는 "부르는 중", 배열이면 로드가 끝난 것(빈 배열 포함) —
  // testRuns와 같은 규약이다.
  const [labels, setLabels] = useState<string[] | null>(null)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const fromFieldId = useId()
  const toFieldId = useId()
  const testRunFieldId = useId()
  const labelFieldId = useId()

  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof UnauthorizedError) {
        onSessionLost()
        return
      }
      setError(cause instanceof ApiError ? cause.message : '데이터를 불러오지 못했습니다.')
    },
    [onSessionLost],
  )

  useEffect(() => {
    const controller = new AbortController()
    listProjects(seesAllProjects, controller.signal)
      .then((items) => {
        setProjects(items)
        setProjectId((current) => current ?? items[0]?.id ?? null)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setProjects([])
        fail(cause)
      })
    return () => controller.abort()
  }, [fail, seesAllProjects])

  useEffect(() => {
    if (projectId === null) return
    const one = activeProjectId(projectId)

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    Promise.all([
      fetchQaStats({ projectId: one, from, to, testRunId, label }, controller.signal),
      // `GET /api/qa-tries`는 프로젝트를 요구한다. 목록이라 합산할 대상이 아니어서
      // ARTEL-750 이 넓히지 않았고, 그래서 전체를 고르면 최근 런 자리가 빈다.
      one === null ? Promise.resolve([]) : fetchRecentQaTries(one, RECENT_RUN_COUNT, controller.signal),
    ])
      .then(([stats, runs]) => {
        setData({ stats, runs })
        setLoading(false)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setData(null)
        setLoading(false)
        fail(cause)
      })

    return () => controller.abort()
  }, [projectId, from, to, testRunId, label, reloadToken, fail])

  useEffect(() => {
    // 프로젝트가 바뀌면 이전 프로젝트에서 고른 test run·label은 새 프로젝트에서는 뜻이 없다.
    // 그대로 두면 그 값이 다른 프로젝트 조회에 실려 나가 빈 집계가 나오는데, 화면에는 예전
    // 프로젝트의 이름만 남아 사용자가 원인을 알 수 없다.
    setTestRunId(null)
    setLabel(null)

    const one = activeProjectId(projectId)
    if (one === null) {
      setTestRuns(null)
      return
    }

    const controller = new AbortController()
    setTestRuns(null)
    listTestRuns(one, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setTestRuns(items)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        // 목록이 비어도 test run 은 "전체"로 계속 조회할 수 있다 — 실패는 선택기만 비운다.
        setTestRuns([])
        fail(cause)
      })

    return () => controller.abort()
  }, [projectId, fail])

  useEffect(() => {
    // `GET /api/qa-stats/labels`는 projectId가 optional이라 test run 목록과 달리 "전 프로젝트
    // 합산"(ALL_PROJECTS)에서도 부를 수 있다 — activeProjectId를 쓰면 그 상태에서 label
    // 선택기가 공연히 막힌다. 그래서 이 효과가 막는 조건은 projectId === null(아직 아무것도
    // 안 고른 초기 상태)뿐이다. 두 선택기의 disabled 조건이 다른 것은 버그가 아니라 각 API의
    // 경계가 다르기 때문이다.
    if (projectId === null) {
      setLabels(null)
      return
    }

    const controller = new AbortController()
    setLabels(null)
    // ALL_PROJECTS는 화면 전용 sentinel이라 서버는 모른다 — null로 바꿔 "볼 수 있는 전
    // 프로젝트"를 묻는다.
    fetchQaLabels(projectId === ALL_PROJECTS ? null : projectId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setLabels(items)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        // 목록이 비어도 label은 "전체"로 계속 조회할 수 있다 — 실패는 선택기만 비운다.
        setLabels([])
        fail(cause)
      })

    return () => controller.abort()
  }, [projectId, fail])

  const cells = useMemo(() => data?.stats.cells ?? [], [data])
  const selectedTestRun = testRuns?.find((run) => run.id === testRunId) ?? null

  // test run과 label 안내를 하나로 합친다. 둘을 세로로 쌓으면 두 필터가 AND로 겹치는지 사용자가
  // 읽어 낼 수 없다 — 한 줄로 합치면 그 관계("이고")가 문장에 그대로 드러난다. "N인"·"N이고"
  // 형태를 쓰는 이유는 test run 이름·label 모두 자유 문자열이라 받침 유무로 조사가 갈리는
  // "이/가"·"은/는"을 문자열 뒤에 못 붙이기 때문이다 — "이다"의 활용형인 "인"·"이고"는 받침과
  // 무관하게 항상 같은 형태다.
  const scopeNoticeSubject =
    testRunId !== null && label !== null ? (
      <>
        Test Run <strong>{selectedTestRun?.name ?? testRunId}</strong>이고 label{' '}
        <strong>{label}</strong>인
      </>
    ) : testRunId !== null ? (
      <>
        Test Run <strong>{selectedTestRun?.name ?? testRunId}</strong>인
      </>
    ) : label !== null ? (
      <>
        label <strong>{label}</strong>인
      </>
    ) : null

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · QA 실행 설정</h1>
        {nav}

        <ProjectPicker
          projects={projects}
          value={projectId}
          onChange={(next) => setProjectId(next)}
          allowAll
          allLabel={seesAllProjects ? '전체 프로젝트' : '참여 중인 전체'}
        />

        <span className="field">
          <label className="field__label" htmlFor={fromFieldId}>
            기간
          </label>
          <input
            className="control control--date"
            id={fromFieldId}
            type="date"
            aria-label="시작일"
            value={toDateInputValue(from)}
            max={toDateInputValue(addDays(to, -1))}
            onChange={(event) => {
              const next = event.target.valueAsDate
              if (next) setFrom(startOfDay(next))
            }}
          />
          <span className="field__label" aria-hidden="true">
            –
          </span>
          <input
            className="control control--date"
            id={toFieldId}
            type="date"
            aria-label="종료일"
            // 표시는 포함 경계로 한다. 사람이 읽는 "8월 5일까지"는 5일을 포함한다.
            value={toDateInputValue(addDays(to, -1))}
            min={toDateInputValue(from)}
            onChange={(event) => {
              const next = event.target.valueAsDate
              if (next) setTo(addDays(startOfDay(next), 1))
            }}
          />
        </span>

        <span className="field">
          <label className="field__label" htmlFor={testRunFieldId}>
            Test Run
          </label>
          <select
            className="control"
            id={testRunFieldId}
            // `/api/projects/{projectId}/test-runs`가 프로젝트 경계를 지나 프로젝트를 못
            // 고르면 부를 목록 자체가 없다. 목록을 부르는 중에도 아직 고를 것이 없기는
            // 마찬가지라 같이 막는다 — 두 상태 모두 <option> 문구로 이유를 남긴다.
            disabled={activeProjectId(projectId) === null || testRuns === null}
            value={testRunId ?? ALL_TEST_RUNS}
            onChange={(event) => {
              const next = event.target.value
              setTestRunId(next === ALL_TEST_RUNS ? null : next)
            }}
          >
            {activeProjectId(projectId) === null ? (
              <option value={ALL_TEST_RUNS}>프로젝트를 먼저 고르세요</option>
            ) : testRuns === null ? (
              <option value={ALL_TEST_RUNS}>불러오는 중…</option>
            ) : (
              <>
                <option value={ALL_TEST_RUNS}>전체</option>
                {testRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </span>

        <span className="field">
          <label className="field__label" htmlFor={labelFieldId}>
            Label
          </label>
          <select
            className="control"
            id={labelFieldId}
            // test run 선택기와 disabled 조건이 다르다 — label 목록은 projectId가 optional이라
            // "전 프로젝트 합산"(ALL_PROJECTS)에서도 부를 수 있다. 그래서 여기서는
            // activeProjectId가 아니라 projectId === null(아직 아무것도 안 고른 초기 상태)만
            // 막는다. 목록 fetch 쪽 useEffect에 같은 근거가 더 자세히 적혀 있다.
            disabled={projectId === null || labels === null}
            value={label ?? ALL_LABELS}
            onChange={(event) => {
              const next = event.target.value
              setLabel(next === ALL_LABELS ? null : next)
            }}
          >
            {projectId === null ? (
              <option value={ALL_LABELS}>프로젝트를 먼저 고르세요</option>
            ) : labels === null ? (
              <option value={ALL_LABELS}>불러오는 중…</option>
            ) : (
              <>
                <option value={ALL_LABELS}>전체</option>
                {labels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </>
            )}
          </select>
        </span>

        <span className="topbar__spacer" />

        <button
          type="button"
          className="control control--action"
          disabled={loading || projectId === null}
          onClick={() => setReloadToken((token) => token + 1)}
        >
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
        <ThemeToggle />
      </header>

      <main className="main">
        {error !== null && (
          <div className="notice notice--critical" role="alert">
            <p className="notice__title">불러오지 못했습니다</p>
            {error}
          </div>
        )}

        {projects?.length === 0 && error === null && (
          <div className="notice">
            참여 중인 프로젝트가 없습니다. 집계는 프로젝트 참여자에게만 보입니다.
          </div>
        )}

        {scopeNoticeSubject !== null && (
          <div className="notice" role="status">
            {scopeNoticeSubject} QA run만 봅니다. label과 test run은 둘 다 qa run 컬럼이라, 부모
            qa run이 없는 단독 실행 런에는 둘 다 없습니다 — 어느 쪽을 걸어도 그 런들은 이
            집계에서 항상 빠집니다. 전체를 보려면 선택을 다시 "전체"로 되돌리세요.
          </div>
        )}

        {data !== null && (
          <>
            <TotalsRail total={data.stats.total} />

            {data.stats.truncated && (
              <div className="notice" role="status">
                조합이 {data.stats.cellLimit}개를 넘어 일부가 잘렸습니다. 아래 표의 합은 위 총계보다
                작고, 여기에는 <strong>미탐·오탐과 커버리지도 포함됩니다</strong> — 잘린 조합의
                미탐은 아래 어느 표에도 나타나지 않습니다. 기간을 좁히면 전체가 들어옵니다.
              </div>
            )}

            <section aria-labelledby="axes-title">
              <div className="section__head">
                <h2 className="section__title" id="axes-title">
                  축별 분해
                </h2>
                {/* 이 화면에서 가장 오해받기 쉬운 숫자라 제목 옆에 못박는다. */}
                <span className="section__note">
                  완주율은 QA 통과율이 아니라 런이 끝까지 돌았는지의 비율. 진행 중·취소는 분모에서
                  제외
                </span>
              </div>
              <div className="axis-grid">
                {AXES.map((axis) => (
                  <AxisBreakdown key={axis} axis={axis} cells={cells} />
                ))}
              </div>
            </section>

            <ScoreBreakdown cells={cells} />
            <CombinationMatrix cells={cells} />
            {projectId === ALL_PROJECTS ? (
              <p className="muted">
                최근 런은 프로젝트를 하나 골라야 나옵니다. 이 목록은 합산하는 집계가 아니라 런
                하나하나라, 전체를 고르면 어느 프로젝트의 런인지 줄마다 달라 표가 읽히지 않습니다.
              </p>
            ) : (
              <RecentRuns runs={data.runs} />
            )}
          </>
        )}

        {data === null && loading && <div className="notice">집계를 불러오는 중입니다…</div>}
      </main>
    </div>
  )
}

/** 저장은 artel-home과 공유하는 쿠키로 간다. src/theme.ts 참고. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? 'light',
  )

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button type="button" className="control" onClick={toggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? '라이트' : '다크'}
    </button>
  )
}
