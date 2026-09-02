import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { listProjects, type ProjectSummary } from '../projects/projectsApi'
import { ProjectPicker } from '../projects/ProjectPicker'
import { toDateInputValue } from '../qaStats/format'
import { ThemeToggle } from '../qaStats/QaStatsDashboard'
import { KnowledgeAxisBreakdown } from './AxisBreakdown'
import { KnowledgeTotalsRail } from './TotalsRail'
import { fetchKnowledgeStats } from './knowledgeStatsApi'
import { AXES, type KnowledgeStats } from './knowledgeStatsTypes'
import '../qaStats/dashboard.css'

/**
 * QA 집계(30일)보다 넓다. 지식은 만들어진 뒤 후속 런이 지우거나 인용해야 신호가 생기는데 그
 * 후속 런은 같은 날 돌지 않는다. 좁게 자르면 창 끝자락의 지식이 평가받을 시간을 갖지 못한 채
 * "아직 아무도 안 지웠다"로 집계된다. 서버 기본값과 같은 값이다.
 */
const DEFAULT_WINDOW_DAYS = 90

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

export function KnowledgeStatsDashboard({
  onSessionLost,
  nav,
  seesAllProjects,
}: {
  onSessionLost: () => void
  /** `DEVELOPER` 등급인지. 선택기가 전 프로젝트를 부를지 고르는 데만 쓴다. */
  seesAllProjects: boolean
  nav?: ReactNode
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  // `to`는 배타 경계라 "오늘까지"는 내일 자정이다.
  const [to, setTo] = useState(() => addDays(startOfDay(new Date()), 1))
  const [from, setFrom] = useState(() => addDays(startOfDay(new Date()), -DEFAULT_WINDOW_DAYS))
  const [data, setData] = useState<KnowledgeStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

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

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchKnowledgeStats({ projectId, from, to }, controller.signal)
      .then((stats) => {
        setData(stats)
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

  const cells = useMemo(() => data?.cells ?? [], [data])

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · 지식창고</h1>
        {nav}

        <ProjectPicker projects={projects} value={projectId} onChange={(next) => setProjectId(next)} />

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
            <KnowledgeTotalsRail total={data.total} />

            {data.truncated && (
              <div className="notice" role="status">
                조합이 {data.cellLimit}개를 넘어 일부가 잘렸습니다. 아래 표의 합은 위 총계보다
                작습니다. 기간을 좁히면 전체가 들어옵니다.
              </div>
            )}

            {/*
              인용 판정이 한 건도 없는 기간에는 인용률 칸이 전부 미상이다. 그 상태를 설명하지
              않으면 "지식을 아무도 안 쓴다"로 읽힌다 — 실제로는 인용 보고 기능이 붙기 전 런만
              모여 있다는 뜻이다.
            */}
            {data.total.retrievalTotal > 0 && data.total.citationKnownTotal === 0 && (
              <div className="notice" role="status">
                이 기간의 검색은 인용 여부를 알 수 없습니다. 인용률이 0%가 아니라 미상으로 나오는
                이유이며, 인용 보고를 하는 런이 쌓이면 채워집니다.
              </div>
            )}

            <section aria-labelledby="knowledge-axes-title">
              <div className="section__head">
                <h2 className="section__title" id="knowledge-axes-title">
                  축별 분해
                </h2>
                {/* 이 화면에서 가장 오해받기 쉬운 두 숫자라 제목 옆에 못박는다. */}
                <span className="section__note">
                  후속 런이 지운 비율에는 수리와 폐기가 섞여 있음 · 인용률의 분모는 검색 노출이
                  아니라 인용 판정이 가능했던 검색
                </span>
              </div>
              <div className="axis-grid">
                {AXES.map((axis) => (
                  <KnowledgeAxisBreakdown key={axis} axis={axis} cells={cells} />
                ))}
              </div>
            </section>
          </>
        )}

        {data === null && loading && <div className="notice">집계를 불러오는 중입니다…</div>}
      </main>
    </div>
  )
}
