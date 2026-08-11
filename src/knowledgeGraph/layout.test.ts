import { describe, expect, it } from 'vitest'
import { computeGraphLayout, edgeGeometry, NODE_RADIUS } from './layout'
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraphTypes'

/**
 * 배치가 지켜야 하는 것은 "예쁘다"가 아니라 셋이다.
 *   1. 끝난다 — 노드가 수백 개여도 유한한 반복 안에서.
 *   2. 같은 데이터면 같은 그림이다 — 난수도, 응답 순서 의존도 없다.
 *   3. 겹쳐서 사라지는 간선이 없다 — 자기 참조, 복수 관계, 역방향 쌍 전부.
 */

function node(id: string, overrides: Partial<KnowledgeGraphNode> = {}): KnowledgeGraphNode {
  return {
    id,
    tag: 'MISC',
    source: 'QA',
    summary: `지식 ${id}`,
    version: 1,
    createdByQaTryId: '36',
    createdAt: '2026-08-11T06:00:00Z',
    ...overrides,
  }
}

function edge(from: string, to: string, relation = 'LEADS_TO', note: string | null = null) {
  return { from, to, relation, note } satisfies KnowledgeGraphEdge
}

describe('computeGraphLayout', () => {
  it('빈 그래프도 좌표 없이 정상으로 끝난다', () => {
    const layout = computeGraphLayout([], [])
    expect(layout.nodes).toEqual([])
    expect(layout.edges).toEqual([])
    expect(layout.positions.size).toBe(0)
  })

  it('간선이 하나도 없어도 노드를 흩어 놓는다', () => {
    // "지식이 없다"와 "지식은 있는데 관계가 없다"는 다른 상태다. 뒤엣것은 점이 보여야 한다.
    const layout = computeGraphLayout([node('1'), node('2'), node('3')], [])
    expect(layout.nodes).toHaveLength(3)
    const unique = new Set(layout.nodes.map((positioned) => `${positioned.x},${positioned.y}`))
    expect(unique.size).toBe(3)
  })

  it('노드가 하나뿐이어도 화면 밖으로 나가지 않는다', () => {
    const layout = computeGraphLayout([node('1')], [])
    const only = layout.nodes[0]
    expect(only.x).toBeGreaterThan(0)
    expect(only.x).toBeLessThan(layout.width)
    expect(only.y).toBeGreaterThan(0)
    expect(only.y).toBeLessThan(layout.height)
  })

  it('모든 좌표가 유한하고 상자 안에 있다', () => {
    const nodes = Array.from({ length: 40 }, (_, i) => node(String(i + 1)))
    const edges = nodes.slice(1).map((target, i) => edge(nodes[i].id, target.id))
    const layout = computeGraphLayout(nodes, edges)

    for (const positioned of layout.nodes) {
      expect(Number.isFinite(positioned.x)).toBe(true)
      expect(Number.isFinite(positioned.y)).toBe(true)
      expect(positioned.x).toBeGreaterThanOrEqual(0)
      expect(positioned.x).toBeLessThanOrEqual(layout.width)
      expect(positioned.y).toBeGreaterThanOrEqual(0)
      expect(positioned.y).toBeLessThanOrEqual(layout.height)
    }
  })

  it('응답 순서가 뒤집혀도 같은 지식은 같은 자리에 온다', () => {
    const nodes = [node('1'), node('2'), node('3'), node('10')]
    const edges = [edge('1', '2'), edge('2', '10')]
    const straight = computeGraphLayout(nodes, edges)
    const shuffled = computeGraphLayout([...nodes].reverse(), edges)

    for (const [id, point] of straight.positions) {
      expect(shuffled.positions.get(id)).toEqual(point)
    }
  })

  it('노드가 200개여도 유한한 반복 안에서 끝난다', () => {
    const nodes = Array.from({ length: 200 }, (_, i) => node(String(i + 1)))
    // 성긴 그래프. 실제 지식창고도 완전 그래프가 되지 않는다.
    const edges = nodes.slice(1).map((target, i) => edge(nodes[i % 17].id, target.id))
    const started = Date.now()
    const layout = computeGraphLayout(nodes, edges)

    expect(layout.nodes).toHaveLength(200)
    expect(layout.edges).toHaveLength(199)
    // 넉넉한 상한이다. 여기 걸리면 반복 상한이 노드 수와 함께 터졌다는 뜻이다.
    expect(Date.now() - started).toBeLessThan(5_000)
  })

  it('같은 id가 두 번 오면 뒤엣것을 버린다', () => {
    const layout = computeGraphLayout([node('1'), node('1'), node('2')], [])
    expect(layout.nodes).toHaveLength(2)
  })
})

describe('간선 라우팅', () => {
  it('자기 참조 간선을 고리로 그린다', () => {
    const layout = computeGraphLayout([node('1')], [edge('1', '1', 'REFINES')])
    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0].shape).toBe('loop')

    const geometry = edgeGeometry(layout.edges[0], layout.positions)
    expect(geometry).not.toBeNull()
    expect(geometry?.d).not.toContain('NaN')
  })

  it('같은 노드의 자기 참조가 여럿이면 고리 크기가 달라진다', () => {
    const layout = computeGraphLayout(
      [node('1')],
      [edge('1', '1', 'REFINES'), edge('1', '1', 'CONTRADICTS')],
    )
    expect(layout.edges.map((routed) => routed.loopIndex)).toEqual([0, 1])
    const first = edgeGeometry(layout.edges[0], layout.positions)
    const second = edgeGeometry(layout.edges[1], layout.positions)
    expect(first?.d).not.toBe(second?.d)
  })

  it('같은 쌍의 여러 관계를 서로 다르게 휘어 놓는다', () => {
    const layout = computeGraphLayout(
      [node('1'), node('2')],
      [edge('1', '2', 'REFINES'), edge('1', '2', 'CONTRADICTS')],
    )
    const curvatures = layout.edges.map((routed) => routed.curvature)
    expect(new Set(curvatures).size).toBe(2)
    expect(curvatures.every((value) => value !== 0)).toBe(true)
  })

  it('방향이 반대인 쌍은 서로 다른 쪽으로 휘어야 한다', () => {
    /*
     * 경로 문자열이 다른 것만으로는 모자란다. 같은 곡선을 반대로 훑기만 해도 문자열은 달라지고,
     * 화면에서는 한 선 위에 다른 선이 정확히 포개진다 — 그러면 둘 중 하나의 `note`는 영영 읽을
     * 수 없다. 가운데가 실제로 갈라졌는지를 본다.
     */
    const layout = computeGraphLayout([node('1'), node('2')], [edge('1', '2'), edge('2', '1')])
    const [first, second] = layout.edges.map((routed) => edgeGeometry(routed, layout.positions)!)
    expect(Math.hypot(first.midX - second.midX, first.midY - second.midY)).toBeGreaterThan(10)
  })

  it('같은 방향의 복수 관계도 서로 다른 쪽으로 휜다', () => {
    const layout = computeGraphLayout(
      [node('1'), node('2')],
      [edge('1', '2', 'REFINES'), edge('1', '2', 'CONTRADICTS')],
    )
    const [first, second] = layout.edges.map((routed) => edgeGeometry(routed, layout.positions)!)
    expect(Math.hypot(first.midX - second.midX, first.midY - second.midY)).toBeGreaterThan(10)
  })

  it('그림 위쪽에 붙은 노드의 자기 참조 고리가 잘리지 않는다', () => {
    // 고리는 기본이 위쪽인데, 상단에 붙은 노드에서는 위로 갈 자리가 없다.
    const nodes = Array.from({ length: 12 }, (_, i) => node(String(i + 1)))
    const selfEdges = nodes.flatMap((target) => [
      edge(target.id, target.id, 'REFINES'),
      edge(target.id, target.id, 'CONTRADICTS'),
      edge(target.id, target.id, 'DEPENDS_ON'),
    ])
    const layout = computeGraphLayout(nodes, selfEdges)

    for (const routed of layout.edges) {
      const geometry = edgeGeometry(routed, layout.positions)!
      const ys = [...geometry.d.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((match) => Number(match[1]))
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...ys)).toBeLessThanOrEqual(layout.height)
    }
  })

  it('간선이 하나뿐인 쌍은 직선이다', () => {
    const layout = computeGraphLayout([node('1'), node('2')], [edge('1', '2')])
    expect(layout.edges[0].curvature).toBe(0)
  })

  it('모르는 relation도 그대로 그린다', () => {
    const layout = computeGraphLayout([node('1'), node('2')], [edge('1', '2', 'SUPERSEDES_KIND_OF')])
    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0].edge.relation).toBe('SUPERSEDES_KIND_OF')
    expect(edgeGeometry(layout.edges[0], layout.positions)?.d).toMatch(/^M /)
  })

  it('양 끝 중 한쪽이 없는 간선은 버리고 센다', () => {
    // truncated 응답에서 나올 수 있는 모양이다. 조용히 사라지면 화면이 거짓말을 한다.
    const layout = computeGraphLayout([node('1')], [edge('1', '99'), edge('98', '1')])
    expect(layout.edges).toHaveLength(0)
    expect(layout.droppedEdges).toBe(2)
  })

  it('노드가 없으면 간선 전부가 버려진 것으로 센다', () => {
    const layout = computeGraphLayout([], [edge('1', '2')])
    expect(layout.droppedEdges).toBe(1)
  })

  it('응답에 온 순서대로 간선을 내보낸다', () => {
    const layout = computeGraphLayout(
      [node('1'), node('2'), node('3')],
      [edge('2', '3', 'REFINES'), edge('1', '2', 'LEADS_TO'), edge('3', '1', 'REPLACES')],
    )
    expect(layout.edges.map((routed) => routed.edge.relation)).toEqual([
      'REFINES',
      'LEADS_TO',
      'REPLACES',
    ])
  })
})

describe('edgeGeometry', () => {
  it('선 끝을 노드 반지름만큼 잘라 화살촉 자리를 낸다', () => {
    const layout = computeGraphLayout([node('1'), node('2')], [edge('1', '2')])
    const from = layout.positions.get('1')!
    const to = layout.positions.get('2')!
    const geometry = edgeGeometry(layout.edges[0], layout.positions)!
    const [, startX, startY] = /^M ([-\d.]+) ([-\d.]+)/.exec(geometry.d)!

    const gap = Math.hypot(Number(startX) - from.x, Number(startY) - from.y)
    expect(gap).toBeGreaterThanOrEqual(NODE_RADIUS)
    // 잘라 낸 길이가 두 노드 사이 거리보다 크면 선이 뒤집힌다.
    expect(gap).toBeLessThan(Math.hypot(to.x - from.x, to.y - from.y))
  })

  it('좌표를 모르는 간선에는 도형이 없다', () => {
    const layout = computeGraphLayout([node('1'), node('2')], [edge('1', '2')])
    expect(edgeGeometry(layout.edges[0], new Map())).toBeNull()
  })
})
