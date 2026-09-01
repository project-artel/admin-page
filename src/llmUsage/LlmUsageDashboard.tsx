import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { listProjects, type ProjectSummary } from '../projects/projectsApi'
import { ThemeToggle } from '../qaStats/QaStatsDashboard'
import { formatCount, toDateInputValue } from '../qaStats/format'
import { BreakdownTable } from './BreakdownTable'
import { DailyTrend } from './DailyTrend'
import { QaRunCosts } from './QaRunCosts'
import { TotalsRail } from './TotalsRail'
import { fetchLlmUsageStats, fetchQaRunUsage } from './llmUsageApi'
import { serviceLabel, type LlmUsageStats, type QaRunUsage } from './llmUsageTypes'
import './usage.css'

const QA_RUN_COUNT = 50
const DEFAULT_WINDOW_DAYS = 30

/** 전 프로젝트 합산을 고른 상태. 빈 문자열을 쓰면 "아직 안 고름"과 구분되지 않는다. */
const ALL_PROJECTS = 'all'

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
  stats: LlmUsageStats
  runs: QaRunUsage[]
}

/**
 * LLM 토큰과 비용.
 *
 * QA 대시보드와 나란히 두지 않고 탭을 나눈 이유는 세는 단위가 다르기 때문이다 — 저쪽은 런을
 * 실행 설정 4-튜플로 **분할**해 세고, 이쪽은 호출 하나하나를 네 축으로 각각 접는다. 한 화면에
 * 섞으면 합이 맞아 보이는 두 표가 나란히 놓인다.
 *
 * 기본 스코프가 전 프로젝트 합산인 것도 그 차이다. "이번 달 얼마 썼나"는 프로젝트 하나의 질문이
 * 아니다. 다만 관리자 role이 없어 "전체"는 **참여 중인 프로젝트 전체**이고, 그 경계를 화면에
 * 적어 둔다.
 */
export function LlmUsageDashboard({
  onSessionLost,
  nav,
}: {
  onSessionLost: () => void
  /** 화면 전환 탭. 대시보드가 자기 topbar를 가지고 있어 여기로 받아 끼운다. */
  nav?: ReactNode
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [scope, setScope] = useState<string>(ALL_PROJECTS)
  // `to`는 배타 경계라 "오늘까지"는 내일 자정이다.
  const [to, setTo] = useState(() => addDays(startOfDay(new Date()), 1))
  const [from, setFrom] = useState(() => addDays(startOfDay(new Date()), -DEFAULT_WINDOW_DAYS))
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const scopeFieldId = useId()
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
      .then(setProjects)
      .catch((cause) => {
        if (controller.signal.aborted) return
        setProjects([])
        fail(cause)
      })
    return () => controller.abort()
  }, [fail])

  useEffect(() => {
    const controller = new AbortController()
    const query = { projectId: scope === ALL_PROJECTS ? null : scope, from, to }
    setLoading(true)
    setError(null)

    Promise.all([
      fetchLlmUsageStats(query, controller.signal),
      fetchQaRunUsage(query, QA_RUN_COUNT, controller.signal),
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
  }, [scope, from, to, reloadToken, fail])

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · 토큰 사용량</h1>
        {nav}

        <span className="field">
          <label className="field__label" htmlFor={scopeFieldId}>
            프로젝트
          </label>
          <select
            className="control"
            id={scopeFieldId}
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value={ALL_PROJECTS}>참여 중인 전체</option>
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
          disabled={loading}
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
            참여 중인 프로젝트가 없습니다. 지출은 프로젝트 참여자에게만 보입니다.
          </div>
        )}

        {data !== null && (
          <>
            <TotalsRail stats={data.stats} />

            {/* 이 화면에서 가장 오해받기 쉬운 두 가지를 표 위에 못박는다. */}
            <div className="notice" role="note">
              <p className="notice__title">이 숫자가 덮는 범위</p>
              {scope === ALL_PROJECTS
                ? '참여 중인 프로젝트 전체의 지출입니다. 관리자 role이 없어 배포 전체가 아닙니다.'
                : '고른 프로젝트 하나의 지출입니다.'}{' '}
              기간은 <strong>모델을 호출한 시각</strong> 기준입니다 — agent가 사용량을 모아 보내므로
              저장 시각과는 분 단위로 벌어지고, 월 경계에서는 날짜가 달라집니다.
              {data.stats.unattributedCalls > 0 && (
                <>
                  {' '}
                  대상 행이 사라져 프로젝트를 알 수 없는 호출{' '}
                  <strong>{formatCount(data.stats.unattributedCalls)}건</strong>은 위 합계에서
                  빠져 있습니다.
                </>
              )}
            </div>

            <DailyTrend
              days={data.stats.daily}
              from={from}
              to={to}
              zone={data.stats.zone}
            />

            <section aria-labelledby="usage-axes">
              <div className="section__head">
                <h2 className="section__title" id="usage-axes">
                  축별 분해
                </h2>
                {/* 축이 서로 겹친다는 사실을 여기서 한 번만 말한다. QA 화면과 달리 이 셋은
                    분할이 아니라 같은 호출을 세 번 접은 것이라, 두 축을 겹쳐 볼 수 없다. */}
                <span className="section__note">
                  세 표는 같은 호출을 다르게 접은 것이라 각각의 합이 모두 위 총계와 같음
                </span>
              </div>

              <div className="axis-grid">
                <BreakdownTable
                  title="기능별"
                  axisLabel="기능"
                  rows={data.stats.byService.map((cell) => ({
                    key: cell.service,
                    label: serviceLabel(cell.service),
                    sublabel: cell.service,
                    totals: cell.totals,
                  }))}
                  note="임베딩은 출력 토큰이 항상 0"
                  emptyMessage="이 기간에 기록된 호출이 없습니다."
                />

                <BreakdownTable
                  title="모델별"
                  axisLabel="모델"
                  rows={data.stats.byModel.map((cell) => ({
                    key: `${cell.provider}/${cell.model}`,
                    label: cell.model,
                    sublabel: cell.provider,
                    totals: cell.totals,
                  }))}
                  emptyMessage="이 기간에 기록된 호출이 없습니다."
                />

                <BreakdownTable
                  title="프로젝트별"
                  axisLabel="프로젝트"
                  rows={data.stats.byProject.map((cell) => ({
                    key: cell.projectId,
                    label: cell.projectName,
                    sublabel: cell.projectId,
                    totals: cell.totals,
                  }))}
                  note="이름은 조회 시점 기준"
                  emptyMessage="이 기간에 기록된 호출이 없습니다."
                />
              </div>
            </section>

            <QaRunCosts runs={data.runs} />
          </>
        )}

        {data === null && loading && <div className="notice">지출을 불러오는 중입니다…</div>}
      </main>
    </div>
  )
}
