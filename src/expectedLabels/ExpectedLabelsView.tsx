import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { listProjects, type ProjectSummary } from '../projects/projectsApi'
import { ProjectPicker } from '../projects/ProjectPicker'
import { StepLabelList } from './StepLabelList'
import {
  fetchScenario,
  listScenarios,
  saveLabels,
  type LabelScenario,
  type ScenarioListItem,
} from './expectedLabelsApi'
import { changedLabels } from './labels'
import './labels.css'

/**
 * 기대 판정 라벨링 화면(ARTEL-302).
 *
 * **왜 admin-page인가.** 이 라벨은 모델 비교용 **정답지**다. 같은 리포의 QA 대시보드가 이 라벨로
 * 채점된 결과(미탐·오탐·미보고)를 축별로 읽는다. 제품 화면에 두면 제품 사용자가 정답지를 건드리게
 * 되고, 라벨 품질이 곧 벤치마크 신뢰도라 그대로 무너진다.
 *
 * **본문은 편집하지 않는다.** 스텝의 행위·TC는 읽기 전용으로만 보인다. 서버도 라벨 전용 경로를
 * 따로 두어 본문을 안 받으므로, 이 화면이 저작자가 방금 고친 스텝을 되돌릴 방법이 없다.
 */
export function ExpectedLabelsView({
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
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  // 원본과 편집본을 따로 든다 — 무엇이 바뀌었는지가 저장할 목록이고, 되돌리기의 기준이다.
  const [saved, setSaved] = useState<LabelScenario | null>(null)
  const [draft, setDraft] = useState<LabelScenario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)


  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof UnauthorizedError) {
        onSessionLost()
        return
      }
      setError(cause instanceof ApiError ? cause.message : '불러오지 못했습니다.')
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
    setScenarios([])
    setScenarioId(null)
    setSaved(null)
    setDraft(null)
    listScenarios(projectId, controller.signal)
      .then((items) => {
        setScenarios(items)
        setScenarioId(items[0]?.testScenarioId ?? null)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) fail(cause)
      })
    return () => controller.abort()
  }, [projectId, fail])

  useEffect(() => {
    if (projectId === null || scenarioId === null) return
    const controller = new AbortController()
    setError(null)
    fetchScenario(projectId, scenarioId, controller.signal)
      .then((scenario) => {
        setSaved(scenario)
        setDraft(scenario)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) fail(cause)
      })
    return () => controller.abort()
  }, [projectId, scenarioId, fail])

  const setLabel = useCallback((step: number, value: boolean | null) => {
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            steps: current.steps.map((row) =>
              row.step === step ? { ...row, expectedPassed: value } : row,
            ),
          },
    )
  }, [])

  const pending = saved !== null && draft !== null ? changedLabels(saved.steps, draft.steps) : []

  // `pending`을 의존성으로 받지 않는다 — 매 렌더 새 배열이라 이 콜백이 매번 새로 만들어진다.
  // 저장 직전에 다시 계산하면 값도 더 최신이다.
  const save = useCallback(() => {
    if (draft === null || saved === null) return
    const changed = changedLabels(saved.steps, draft.steps)
    if (changed.length === 0) return
    setBusy(true)
    setError(null)
    saveLabels(draft.testScenarioId, changed)
      .then((fresh) => {
        // 서버가 돌려준 본문으로 갈아탄다 — 그 사이 저작 쪽에서 스텝이 바뀌었을 수 있고,
        // 로컬 편집본을 그대로 두면 화면이 없는 스텝에 라벨을 달고 있는 것처럼 보인다.
        setSaved(fresh)
        setDraft(fresh)
      })
      .catch(fail)
      .finally(() => setBusy(false))
  }, [draft, saved, fail])

  return (
    <div className="shell">
      <header className="section__head">
        <h1 className="section__title">기대 판정 라벨</h1>
        {nav}
      </header>

      <main className="main">
        <p className="section__note section__note--block">
          QA 에이전트의 스텝 판정은 자기채점이라, 관대한 모델이 높은 점수를 받고 “전부 통과”라고
          답하는 전략이 만점이 됩니다. 여기서 각 스텝이 통과해야 하는지 실패해야 하는지를 사람이
          정해 두면 그 전략이 최악 점수가 됩니다. 스텝 본문은 여기서 고칠 수 없습니다.
        </p>

        <ProjectPicker projects={projects} value={projectId} onChange={(next) => setProjectId(next)} />

        {error !== null && <p className="notice notice--critical">{error}</p>}

        <div className="labels__layout">
          <nav className="labels__scenarios" aria-label="시나리오">
            {scenarios.length === 0 ? (
              <p className="muted">시나리오가 없습니다.</p>
            ) : (
              scenarios.map((item) => (
                <button
                  key={item.testScenarioId}
                  type="button"
                  className={
                    item.testScenarioId === scenarioId
                      ? 'control control--action'
                      : 'control'
                  }
                  aria-pressed={item.testScenarioId === scenarioId}
                  onClick={() => setScenarioId(item.testScenarioId)}
                >
                  {item.title === '' ? '(제목 없음)' : item.title}
                </button>
              ))
            )}
          </nav>

          <section className="labels__panel">
            {draft === null ? (
              <p className="muted">시나리오를 고르세요.</p>
            ) : (
              <>
                <h2 className="panel__title">
                  {draft.title === '' ? '(제목 없음)' : draft.title}
                </h2>
                <StepLabelList steps={draft.steps} onChange={setLabel} />
                <div className="labels__actions">
                  <button
                    type="button"
                    className="control control--action"
                    disabled={busy || pending.length === 0}
                    onClick={save}
                  >
                    {busy ? '저장 중…' : `저장 (${pending.length})`}
                  </button>
                  {pending.length > 0 && !busy && (
                    <span className="muted">저장하지 않은 변경 {pending.length}개</span>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
