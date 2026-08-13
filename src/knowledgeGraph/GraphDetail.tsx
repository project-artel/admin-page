import { EMPTY_MARK, formatCount, formatTimestamp } from '../qaStats/format'
import type { GraphLayout, RoutedEdge } from './layout'
import {
  relationStyle,
  sourceLabel,
  type GraphSelection,
  type KnowledgeGraphNode,
} from './knowledgeGraphTypes'
import { orEmptyMark, truncate } from './text'

/**
 * 고른 것 하나의 근거.
 *
 * 그래프는 무엇이 무엇과 얽혀 있는지까지만 말한다. **왜** 얽혀 있는지는 간선의 `note`에만 있고,
 * 그 글은 여기 말고 나올 자리가 없다. 그래서 없을 때도 빈칸으로 두지 않고 없다고 쓴다.
 */
export function GraphDetail({
  layout,
  selection,
  onSelect,
}: {
  layout: GraphLayout
  selection: GraphSelection | null
  onSelect: (next: GraphSelection) => void
}) {
  if (selection === null) {
    return (
      <aside className="detail" aria-label="선택 상세">
        <p className="detail__hint">
          노드를 고르면 그 지식의 요약과 출처가, 간선을 고르면 그 관계를 남긴 메모가 여기 나옵니다.
        </p>
      </aside>
    )
  }

  if (selection.kind === 'node') {
    const found = layout.nodes.find((positioned) => positioned.node.id === selection.id)
    if (!found) return <aside className="detail" aria-label="선택 상세" />
    return <NodeDetail node={found.node} layout={layout} onSelect={onSelect} />
  }

  const routed = layout.edges.find((edge) => edge.key === selection.key)
  if (!routed) return <aside className="detail" aria-label="선택 상세" />
  return <EdgeDetail routed={routed} layout={layout} onSelect={onSelect} />
}

function NodeDetail({
  node,
  layout,
  onSelect,
}: {
  node: KnowledgeGraphNode
  layout: GraphLayout
  onSelect: (next: GraphSelection) => void
}) {
  const connected = layout.edges.filter(
    (routed) => routed.edge.from === node.id || routed.edge.to === node.id,
  )

  return (
    <aside className="detail" aria-label="선택 상세">
      <h3 className="detail__title">{node.summary ?? '요약 없음'}</h3>
      <dl className="detail__fields">
        <dt>태그</dt>
        <dd>{orEmptyMark(node.tag)}</dd>
        <dt>출처</dt>
        <dd>{sourceLabel(node.source)}</dd>
        <dt>버전</dt>
        <dd className="mono">{node.version === null ? EMPTY_MARK : `v${node.version}`}</dd>
        <dt>만든 런</dt>
        {/* 문서에서 뽑은 지식에는 만든 런이 없다. 0이나 빈칸이 아니라 그 사실을 쓴다. */}
        <dd className="mono">
          {node.createdByQaTryId === null ? (
            <span className="muted">런에서 만들어지지 않음</span>
          ) : (
            `QA #${node.createdByQaTryId}`
          )}
        </dd>
        <dt>만든 시각</dt>
        <dd className="mono">
          {node.createdAt === null ? EMPTY_MARK : formatTimestamp(node.createdAt)}
        </dd>
        <dt>지식 ID</dt>
        <dd className="mono">{node.id}</dd>
      </dl>

      <h4 className="detail__subtitle">걸린 관계 {formatCount(connected.length)}개</h4>
      {connected.length === 0 ? (
        <p className="detail__hint">이 지식은 아직 어떤 지식과도 이어져 있지 않습니다.</p>
      ) : (
        <ul className="detail__links">
          {connected.map((routed) => {
            const outgoing = routed.edge.from === node.id
            const otherId = outgoing ? routed.edge.to : routed.edge.from
            const other = layout.nodes.find((positioned) => positioned.node.id === otherId)
            const style = relationStyle(routed.edge.relation)
            return (
              <li key={routed.key}>
                <button
                  type="button"
                  className="detail__link"
                  onClick={() => onSelect({ kind: 'edge', key: routed.key })}
                >
                  {/* 방향을 화살표 하나로만 말하지 않는다. 나가는/들어오는을 글자로 붙인다. */}
                  <span className="detail__direction">{outgoing ? '나감 →' : '← 들어옴'}</span>
                  <span className="mono">{routed.edge.relation}</span>
                  <span>{style.label}</span>
                  <span className="detail__peer">
                    {otherId === node.id
                      ? '자기 자신'
                      : truncate(other?.node.summary ?? `지식 ${otherId}`, 28)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

function EdgeDetail({
  routed,
  layout,
  onSelect,
}: {
  routed: RoutedEdge
  layout: GraphLayout
  onSelect: (next: GraphSelection) => void
}) {
  const style = relationStyle(routed.edge.relation)
  const from = layout.nodes.find((positioned) => positioned.node.id === routed.edge.from)
  const to = layout.nodes.find((positioned) => positioned.node.id === routed.edge.to)

  return (
    <aside className="detail" aria-label="선택 상세">
      <h3 className="detail__title">
        <span className="mono">{routed.edge.relation}</span> {style.label}
      </h3>
      <p className="detail__hint">{style.strokeHint}으로 그려집니다.</p>

      <dl className="detail__fields">
        <dt>시작</dt>
        <dd>
          <button
            type="button"
            className="detail__link"
            onClick={() => onSelect({ kind: 'node', id: routed.edge.from })}
          >
            {from?.node.summary ?? `지식 ${routed.edge.from}`}
          </button>
        </dd>
        <dt>끝</dt>
        <dd>
          <button
            type="button"
            className="detail__link"
            onClick={() => onSelect({ kind: 'node', id: routed.edge.to })}
          >
            {to?.node.summary ?? `지식 ${routed.edge.to}`}
          </button>
        </dd>
      </dl>

      <h4 className="detail__subtitle">메모</h4>
      {routed.edge.note === null || routed.edge.note === '' ? (
        <p className="detail__hint">
          메모가 없습니다. 이 관계가 왜 있는지는 응답에 남아 있지 않아, 두 지식을 직접 읽어 보는
          것 말고는 확인할 길이 없습니다.
        </p>
      ) : (
        <p className="detail__note">{routed.edge.note}</p>
      )}
    </aside>
  )
}
