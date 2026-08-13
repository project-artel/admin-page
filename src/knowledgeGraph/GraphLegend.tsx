import { formatCount } from '../qaStats/format'
import type { GraphLayout } from './layout'
import { relationStyle, sourceLabel, sourceShape } from './knowledgeGraphTypes'

/**
 * 범례.
 *
 * 그래프에서 유일하게 "선 모양이 무슨 뜻인지"를 글자로 말하는 자리다. 색을 못 보는 사람에게는
 * 여기가 유일한 열쇠라, 종류마다 선 모양을 그대로 다시 그리고 그 모양을 글자로도 쓴다.
 *
 * 실제로 **그려진** 것만 센다. 안 쓰인 종류까지 늘어놓으면 이 그래프에 모순이 있는지 없는지를
 * 범례에서 읽을 수 없고, 그리지 못한 간선까지 세면 범례의 수와 그림의 선 수가 어긋난다.
 */
export function GraphLegend({ layout }: { layout: GraphLayout }) {
  const relations = countBy(layout.edges, (routed) => routed.edge.relation)
  const sources = countBy(layout.nodes, (positioned) => positioned.node.source ?? '')

  return (
    <div className="legend">
      <section className="legend__group" aria-labelledby="graph-legend-relations">
        <h3 className="legend__title" id="graph-legend-relations">
          관계 {formatCount(layout.edges.length)}개
        </h3>
        {relations.length === 0 ? (
          <p className="legend__empty">이 그래프에는 관계가 없습니다.</p>
        ) : (
          <ul className="legend__list">
            {relations.map(([relation, count]) => {
              const style = relationStyle(relation)
              return (
                <li className="legend__item" key={relation}>
                  <svg
                    className={`legend__sample graph__edge graph__edge--${style.slug}`}
                    viewBox="0 0 48 12"
                    aria-hidden="true"
                  >
                    <path className="graph__edge-line" d="M 2 6 L 46 6" />
                    {style.slug === 'contradicts' && (
                      <text className="graph__edge-mark" x="24" y="6">
                        ✕
                      </text>
                    )}
                  </svg>
                  <span className="legend__label">
                    <span className="mono">{relation}</span> {style.label}
                  </span>
                  {/* 선 모양을 글자로 옮긴 것. 색과 모양을 못 보는 경로에는 이것만 남는다. */}
                  <span className="legend__hint">{style.strokeHint}</span>
                  <span className="legend__count">{formatCount(count)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="legend__group" aria-labelledby="graph-legend-sources">
        <h3 className="legend__title" id="graph-legend-sources">
          지식 {formatCount(layout.nodes.length)}개
        </h3>
        <ul className="legend__list">
          {sources.map(([source, count]) => {
            const shape = sourceShape(source === '' ? null : source)
            return (
              <li className="legend__item" key={source === '' ? '(none)' : source}>
                <svg
                  className={`legend__sample graph__node graph__node--${shape}`}
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  {shape === 'circle' && <circle className="graph__node-body" cx="10" cy="10" r="7" />}
                  {shape === 'square' && (
                    <rect className="graph__node-body" x="3" y="3" width="14" height="14" rx="2" />
                  )}
                  {shape === 'diamond' && (
                    <polygon className="graph__node-body" points="10,2 18,10 10,18 2,10" />
                  )}
                </svg>
                <span className="legend__label">{sourceLabel(source === '' ? null : source)}</span>
                <span className="legend__hint">
                  {shape === 'circle' ? '원' : shape === 'square' ? '사각형' : '마름모'}
                </span>
                <span className="legend__count">{formatCount(count)}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/** 많은 순, 같으면 이름 순. 매번 같은 순서로 나와야 눈이 자리를 기억한다. */
function countBy<T>(items: readonly T[], key: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const value = key(item)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
}
