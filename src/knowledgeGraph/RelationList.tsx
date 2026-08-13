import { EMPTY_MARK } from '../qaStats/format'
import type { GraphLayout } from './layout'
import { relationStyle, type GraphSelection } from './knowledgeGraphTypes'
import { truncate } from './text'

/**
 * 관계 목록.
 *
 * 그림의 대체 표현이다(DESIGN.md: 시각 주석에는 접근 가능한 목록 대안을 둔다). SVG의 곡선을
 * 마우스로 집지 못하는 사람도 여기서 같은 간선을 고르고, 같은 `note`를 읽는다.
 *
 * 관계 종류를 색이 아니라 글자로 적는 자리이기도 하다 — 그래프에서 선 모양을 구분하지 못해도
 * 이 표에는 `CONTRADICTS`가 그대로 쓰여 있다.
 */
export function RelationList({
  layout,
  selection,
  onSelect,
}: {
  layout: GraphLayout
  selection: GraphSelection | null
  onSelect: (next: GraphSelection) => void
}) {
  const summaryOf = (id: string) =>
    layout.nodes.find((positioned) => positioned.node.id === id)?.node.summary ?? null

  return (
    <div className="table-scroll table-scroll--tall">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">관계</th>
            <th scope="col">시작 지식</th>
            <th scope="col">끝 지식</th>
            <th scope="col">메모</th>
          </tr>
        </thead>
        <tbody>
          {layout.edges.map((routed) => {
            const style = relationStyle(routed.edge.relation)
            const selected = selection?.kind === 'edge' && selection.key === routed.key
            return (
              <tr key={routed.key} className={selected ? 'is-selected' : undefined}>
                <td>
                  <button
                    type="button"
                    className="link-button"
                    aria-pressed={selected}
                    onClick={() => onSelect({ kind: 'edge', key: routed.key })}
                  >
                    <span className="mono">{routed.edge.relation}</span> {style.label}
                  </button>
                </td>
                <td>{truncate(summaryOf(routed.edge.from) ?? `지식 ${routed.edge.from}`, 32)}</td>
                <td>
                  {routed.edge.from === routed.edge.to
                    ? '자기 자신'
                    : truncate(summaryOf(routed.edge.to) ?? `지식 ${routed.edge.to}`, 32)}
                </td>
                {/* 메모는 표에서 유일하게 줄바꿈을 허용하는 칸이다. 잘라 버리면 근거가 사라진다. */}
                <td className="relation__note">
                  {routed.edge.note === null || routed.edge.note === '' ? (
                    <span className="muted">{EMPTY_MARK}</span>
                  ) : (
                    routed.edge.note
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
