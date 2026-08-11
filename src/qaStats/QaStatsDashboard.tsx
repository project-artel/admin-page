import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { listProjects, type ProjectSummary } from '../projects/projectsApi'
import { AxisBreakdown } from './AxisBreakdown'
import { CombinationMatrix } from './CombinationMatrix'
import { RecentRuns } from './RecentRuns'
import { ScoreBreakdown } from './ScoreBreakdown'
import { TotalsRail } from './TotalsRail'
import { toDateInputValue } from './format'
import { fetchQaStats, fetchRecentQaTries } from './qaStatsApi'
import { AXES, type QaStats, type QaTrySummary } from './qaStatsTypes'
import './dashboard.css'

const RECENT_RUN_COUNT = 30
const DEFAULT_WINDOW_DAYS = 30

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

export function QaStatsDashboard({ onSessionLost }: { onSessionLost: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  // `to`는 배타 경계라 "오늘까지"는 내일 자정이다.
  const [to, setTo] = useState(() => addDays(startOfDay(new Date()), 1))
  const [from, setFrom] = useState(() => addDays(startOfDay(new Date()), -DEFAULT_WINDOW_DAYS))
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const projectFieldId = useId()
  const fromFieldId = useId()
  const toFieldId = useId()

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
    listProjects(controller.signal)
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
  }, [fail])

  useEffect(() => {
    if (projectId === null) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    Promise.all([
      fetchQaStats({ projectId, from, to }, controller.signal),
      fetchRecentQaTries(projectId, RECENT_RUN_COUNT, controller.signal),
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
  }, [projectId, from, to, reloadToken, fail])

  const cells = useMemo(() => data?.stats.cells ?? [], [data])

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · QA 실행 설정</h1>

        <span className="field">
          <label className="field__label" htmlFor={projectFieldId}>
            프로젝트
          </label>
          <select
            className="control"
            id={projectFieldId}
            value={projectId ?? ''}
            disabled={projects === null || projects.length === 0}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects === null && <option value="">불러오는 중…</option>}
            {projects?.length === 0 && <option value="">참여 중인 프로젝트 없음</option>}
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </span>

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
            <RecentRuns runs={data.runs} />
          </>
        )}

        {data === null && loading && <div className="notice">집계를 불러오는 중입니다…</div>}
      </main>
    </div>
  )
}

/** artel-home과 같은 저장 키. 두 사이트 사이에서 테마가 뒤집히면 같은 제품으로 읽히지 않는다. */
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light',
  )

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('artel-theme', next)
  }

  return (
    <button type="button" className="control" onClick={toggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? '라이트' : '다크'}
    </button>
  )
}
