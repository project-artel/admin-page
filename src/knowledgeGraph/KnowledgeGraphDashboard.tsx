import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { ApiError, UnauthorizedError } from '../api/orchestration'
import { listProjects, type ProjectSummary } from '../projects/projectsApi'
import { ProjectPicker } from '../projects/ProjectPicker'
import { formatCount } from '../qaStats/format'
import { ThemeToggle } from '../qaStats/QaStatsDashboard'
import { GraphCanvas } from './GraphCanvas'
import { GraphDetail } from './GraphDetail'
import { GraphLegend } from './GraphLegend'
import { RelationList } from './RelationList'
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraphTypes'
import { useGraphDrag } from './useGraphDrag'
import { fetchKnowledgeGraph } from './knowledgeGraphApi'
import type { GraphSelection, KnowledgeGraph } from './knowledgeGraphTypes'
import '../qaStats/dashboard.css'
import './graph.css'

/**
 * 지식창고 그래프.
 *
 * 지표 화면과 나란히 서지만 묻는 것이 다르다 — 지표는 "지식이 쓸모 있나"를, 여기는 "지식이 서로
 * 어떻게 얽혀 있나"를 묻는다. 그래서 기간도 축도 없고, 대신 그래프 한 장이 전부다.
 *
 * 프로젝트 선택·로딩·오류·빈 상태는 `QaStatsDashboard`와 같은 골격을 쓴다. 어드민에서 화면을
 * 옮겨 다니는 사람이 화면마다 다른 규칙을 다시 배우게 하지 않는다.
 */

/** 그래프가 읽히는 한계 안에서 고르게 한다. 기본값은 서버 기본값과 같다. */
const NODE_LIMITS = [100, 200, 500]
const DEFAULT_NODE_LIMIT = 200

const NO_NODES: KnowledgeGraphNode[] = []
const NO_EDGES: KnowledgeGraphEdge[] = []

export function KnowledgeGraphDashboard({
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
  const [nodeLimit, setNodeLimit] = useState(DEFAULT_NODE_LIMIT)
  const [data, setData] = useState<KnowledgeGraph | null>(null)
  const [selection, setSelection] = useState<GraphSelection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const limitFieldId = useId()

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

    fetchKnowledgeGraph(projectId, nodeLimit, controller.signal)
      .then((graph) => {
        setData(graph)
        // 고른 것은 그래프에 매인다. 다른 프로젝트의 노드 id가 우연히 같으면 엉뚱한 지식이
        // 선택된 채로 남는다.
        setSelection(null)
        setLoading(false)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setData(null)
        setSelection(null)
        setLoading(false)
        fail(cause)
      })

    return () => controller.abort()
  }, [projectId, nodeLimit, reloadToken, fail])

  /**
   * 배치는 데이터가 바뀔 때만 계산한다.
   *
   * 노드가 수백 개면 반발력이 O(n²)이라 한 번의 계산도 공짜가 아니다. 선택이 바뀔 때마다 다시
   * 돌면 노드를 누를 때마다 화면이 멎고, 게다가 그래프 모양까지 그대로일 이유가 없어진다.
   */
  // 훅은 조건부로 부를 수 없으니 데이터가 없을 때는 빈 그래프를 넘긴다. 상수라 참조가 안 바뀌고,
  // 그래서 응답을 기다리는 동안 배치가 매 렌더 다시 계산되지 않는다.
  const { layout: live, drag } = useGraphDrag(data?.nodes ?? NO_NODES, data?.edges ?? NO_EDGES)
  const layout = data === null ? null : live

  // 세는 것은 응답이 아니라 그려진 것이다. 안내 문구의 수와 그림이 어긋나면 안내가 거짓말이 된다.
  const nodeCount = layout?.nodes.length ?? 0
  const edgeCount = layout?.edges.length ?? 0

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · 지식창고 그래프</h1>
        {nav}

        <ProjectPicker projects={projects} value={projectId} onChange={(next) => setProjectId(next)} />

        <span className="field">
          <label className="field__label" htmlFor={limitFieldId}>
            노드 상한
          </label>
          <select
            className="control"
            id={limitFieldId}
            value={String(nodeLimit)}
            onChange={(event) => setNodeLimit(Number(event.target.value))}
          >
            {NODE_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {formatCount(limit)}개
              </option>
            ))}
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
            참여 중인 프로젝트가 없습니다. 지식창고는 프로젝트 참여자에게만 보입니다.
          </div>
        )}

        {data !== null && layout !== null && (
          <>
            {data.truncated && (
              <div className="notice" role="status">
                <p className="notice__title">그래프가 잘렸습니다</p>
                지식이 상한 {formatCount(data.nodeLimit)}개를 넘어 일부만 받았습니다.{' '}
                <strong>잘린 지식에 걸린 관계도 함께 빠집니다</strong> — 여기 보이지 않는 관계가
                실제로 없는 것인지 잘린 것인지는 이 화면에서 알 수 없습니다. 상한을 올려 보세요.
              </div>
            )}

            {layout.droppedEdges > 0 && (
              <div className="notice" role="status">
                양 끝 중 한쪽이 응답에 없어 그리지 못한 관계가{' '}
                {formatCount(layout.droppedEdges)}개 있습니다.
              </div>
            )}

            {/*
              노드 0개와 간선 0개는 서로 다른 정상 상태다. "지식이 없다"와 "지식은 있는데 아직
              아무 관계도 맺히지 않았다"는 다른 사실이고, 뒤엣것은 그래프를 그려야 한다 —
              점만 흩어진 그림 자체가 그 사실이다.
            */}
            {nodeCount === 0 ? (
              <div className="notice" role="status">
                <p className="notice__title">지식이 없습니다</p>
                이 프로젝트의 지식창고가 비어 있습니다. QA 런이 돌거나 문서를 넣으면 채워집니다.
              </div>
            ) : (
              <>
                {edgeCount === 0 && (
                  <div className="notice" role="status">
                    <p className="notice__title">관계가 없습니다</p>
                    지식 {formatCount(nodeCount)}개는 있지만 서로 이어진 것이 하나도 없습니다.
                    아래 그림의 점 하나하나가 그 지식입니다.
                  </div>
                )}

                <section aria-labelledby="graph-title">
                  <div className="section__head">
                    <h2 className="section__title" id="graph-title">
                      지식 관계 그래프
                    </h2>
                    <span className="section__note">
                      선 모양이 관계 종류, 도형이 출처. 노드나 선을 고르면 오른쪽에 근거가 나옵니다
                    </span>
                  </div>

                  <div className="graph-layout">
                    <div className="graph-layout__canvas">
                      <GraphCanvas drag={drag} layout={layout} selection={selection} onSelect={setSelection} />
                      <GraphLegend layout={layout} />
                    </div>
                    <GraphDetail layout={layout} selection={selection} onSelect={setSelection} />
                  </div>
                </section>

                {edgeCount > 0 && (
                  <section aria-labelledby="relations-title">
                    <div className="section__head">
                      <h2 className="section__title" id="relations-title">
                        관계 목록
                      </h2>
                      <span className="section__note">
                        그림을 집지 않고도 같은 관계를 고를 수 있는 자리 · 메모가 그 관계의 유일한
                        근거
                      </span>
                    </div>
                    <RelationList layout={layout} selection={selection} onSelect={setSelection} />
                  </section>
                )}
              </>
            )}
          </>
        )}

        {data === null && loading && <div className="notice">그래프를 불러오는 중입니다…</div>}
      </main>
    </div>
  )
}
