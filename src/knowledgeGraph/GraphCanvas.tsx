import { useId, useMemo, type KeyboardEvent } from 'react'
import { edgeGeometry, NODE_RADIUS, type GraphLayout, type RoutedEdge } from './layout'
import {
  relationStyle,
  sourceLabel,
  sourceShape,
  RELATION_SLUGS,
  type GraphSelection,
  type KnowledgeGraphNode,
  type NodeShape,
} from './knowledgeGraphTypes'
import { placeLabels, type LabelPlacement } from './labelPlacement'
import { truncate } from './text'

/**
 * 이름표를 전부 붙이는 한계.
 *
 * 노드가 서른을 넘으면 배치가 촘촘해져(이웃 간격이 이름표 폭보다 좁아진다) 글자끼리 겹치고,
 * 그래프도 이름도 못 읽는 그림이 된다. 그 위로는 고른 노드에만 붙이고 나머지는 `<title>`이
 * 맡는다.
 */
const LABEL_LIMIT = 30
/** 라벨 폭 예산. 라틴 문자 기준이라 한글로는 그 절반쯤이다. */
const LABEL_CHARS = 14

/** `.graph__node-label` 크기에서 라틴 문자 한 글자가 그려지는 폭. */
const LABEL_UNIT_WIDTH = 6

/** 라벨 한 줄의 높이. */
const LABEL_LINE_HEIGHT = 13

/**
 * 그래프 그림판.
 *
 * 상태를 갖지 않는다 — 좌표는 `layout.ts`가, 고른 것은 화면이 들고 있고 여기는 그리기만 한다.
 * 그래서 `renderToStaticMarkup`으로 그대로 테스트된다.
 *
 * 색만으로 말하지 않는다(DESIGN.md).
 *   - 관계 종류: 선 모양(실선/파선/점선/쇄선)이 먼저고 색은 거들 뿐이다. `CONTRADICTS`는 굵기와
 *     ✕ 표식까지 더한다.
 *   - 출처: 색이 아니라 도형(원/사각/마름모)으로 가른다.
 *   - 고른 것: 색과 굵기에 더해 `aria-pressed`로도 말한다.
 */
export function GraphCanvas({
  layout,
  selection,
  onSelect,
}: {
  layout: GraphLayout
  selection: GraphSelection | null
  onSelect: (next: GraphSelection | null) => void
}) {
  // 한 페이지에 그래프가 둘 이상 올라와도 화살촉 정의가 부딪히지 않게 접두사를 붙인다.
  const markerPrefix = useId().replace(/:/g, '')
  const showLabels = layout.nodes.length <= LABEL_LIMIT

  // 라벨은 자르기만으로 부족하다. 자기 예산에 맞는 라벨도 옆 노드 라벨 위에 앉을 수 있어서,
  // 실제로 요약이 서로 겹쳐 아무것도 안 읽히는 상태가 됐다. 그래서 라벨도 배치한다 —
  // 아래가 막히면 위로, 둘 다 막히면 버린다. 버려도 노드는 그대로 클릭되고 전문은 상세에 있다.
  const labels = useMemo(() => {
    if (!showLabels) return new Map<string, LabelPlacement>()
    const degree = new Map<string, number>()
    for (const routed of layout.edges) {
      degree.set(routed.edge.from, (degree.get(routed.edge.from) ?? 0) + 1)
      degree.set(routed.edge.to, (degree.get(routed.edge.to) ?? 0) + 1)
    }
    const keep = new Set<string>()
    if (selection?.kind === 'node') keep.add(selection.id)
    return placeLabels(
      layout.nodes,
      (positioned) => truncate(positioned.node.summary ?? '요약 없음', LABEL_CHARS),
      {
        unitWidth: LABEL_UNIT_WIDTH,
        lineHeight: LABEL_LINE_HEIGHT,
        widthLimit: LABEL_CHARS,
        keep,
        degree: (id) => degree.get(id) ?? 0,
      },
    )
  }, [layout.edges, layout.nodes, selection, showLabels])

  return (
    <div className="graph__frame">
      <svg
        className="graph"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`지식 ${layout.nodes.length}개와 관계 ${layout.edges.length}개의 그래프`}
      >
        <defs>
          {RELATION_SLUGS.map((slug) => (
            <marker
              key={slug}
              id={`${markerPrefix}-${slug}`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              // 선 굵기에 따라 화살촉까지 커지면 CONTRADICTS만 화살표가 두 배가 된다.
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path className={`graph__arrow graph__arrow--${slug}`} d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          ))}
        </defs>

        <g>
          {layout.edges.map((routed) => (
            <EdgeMark
              key={routed.key}
              routed={routed}
              layout={layout}
              markerPrefix={markerPrefix}
              selected={selection?.kind === 'edge' && selection.key === routed.key}
              onSelect={onSelect}
            />
          ))}
        </g>

        <g>
          {layout.nodes.map((positioned) => (
            <NodeMark
              key={positioned.node.id}
              node={positioned.node}
              x={positioned.x}
              y={positioned.y}
              label={labels.get(positioned.node.id) ?? null}
              selected={selection?.kind === 'node' && selection.id === positioned.node.id}
              onSelect={onSelect}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

function EdgeMark({
  routed,
  layout,
  markerPrefix,
  selected,
  onSelect,
}: {
  routed: RoutedEdge
  layout: GraphLayout
  markerPrefix: string
  selected: boolean
  onSelect: (next: GraphSelection) => void
}) {
  const geometry = edgeGeometry(routed, layout.positions)
  if (geometry === null) return null

  const style = relationStyle(routed.edge.relation)
  const className = `graph__edge graph__edge--${style.slug}${selected ? ' graph__edge--selected' : ''}`

  return (
    <g className={className} onClick={() => onSelect({ kind: 'edge', key: routed.key })}>
      <title>
        {`${routed.edge.from} → ${routed.edge.to} · ${routed.edge.relation} (${style.label})`}
      </title>
      {/* 1px 선은 마우스로 집기 어렵다. 보이지 않는 굵은 선을 겹쳐 클릭 영역을 만든다. */}
      <path className="graph__edge-hit" d={geometry.d} />
      <path
        className="graph__edge-line"
        d={geometry.d}
        markerEnd={`url(#${markerPrefix}-${style.slug})`}
      />
      {style.slug === 'contradicts' && (
        // 색각 이상에서도 남는 표식. 뜻은 범례와 상세 패널의 글자가 진다.
        <text className="graph__edge-mark" x={geometry.midX} y={geometry.midY} aria-hidden="true">
          ✕
        </text>
      )}
    </g>
  )
}

function NodeMark({
  node,
  x,
  y,
  label,
  selected,
  onSelect,
}: {
  node: KnowledgeGraphNode
  x: number
  y: number
  label: LabelPlacement | null
  selected: boolean
  onSelect: (next: GraphSelection) => void
}) {
  const shape = sourceShape(node.source)
  const summary = node.summary ?? '요약 없음'
  const select = () => onSelect({ kind: 'node', id: node.id })
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    select()
  }

  return (
    <g
      className={`graph__node graph__node--${shape}${selected ? ' graph__node--selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${summary} · ${sourceLabel(node.source)}`}
      onClick={select}
      onKeyDown={onKeyDown}
    >
      <title>{summary}</title>
      {selected && <circle className="graph__node-halo" cx={x} cy={y} r={NODE_RADIUS + 5} />}
      <NodeShapeMark shape={shape} x={x} y={y} />
      {label !== null && (
        // y 오프셋은 배치가 정한다 — 아래에 자리가 없던 라벨은 노드 위에 그려진다.
        <text className="graph__node-label" x={x} y={y + label.y} textAnchor="middle">
          {label.text}
        </text>
      )}
    </g>
  )
}

function NodeShapeMark({ shape, x, y }: { shape: NodeShape; x: number; y: number }) {
  if (shape === 'square') {
    const side = NODE_RADIUS * 1.8
    return (
      <rect
        className="graph__node-body"
        x={x - side / 2}
        y={y - side / 2}
        width={side}
        height={side}
        rx={2}
      />
    )
  }

  if (shape === 'diamond') {
    const reach = NODE_RADIUS * 1.2
    return (
      <polygon
        className="graph__node-body"
        points={`${x},${y - reach} ${x + reach},${y} ${x},${y + reach} ${x - reach},${y}`}
      />
    )
  }

  return <circle className="graph__node-body" cx={x} cy={y} r={NODE_RADIUS} />
}
