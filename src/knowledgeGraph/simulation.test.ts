import { describe, expect, it } from 'vitest'
import type { PositionedNode, RoutedEdge } from './layout'
import { createSimulation, hold, positions, REST_ALPHA, step, wake } from './simulation'

/**
 * 이완이 지키는 세 가지, 그리고 깨졌을 때 무슨 일이 나는지.
 *
 *   멈춘다   — 끝나지 않는 루프는 아무도 안 보는 탭에서 코어를 태운다.
 *   남는다   — 놓은 자리에 안 남으면 드래그가 아무것도 바꾸지 못한 셈이 된다.
 *   벌어진다 — 겹쳐 쌓인 노드는 아무것도 아닌 그림이다.
 */

function node(id: string, x: number, y: number): PositionedNode {
  return {
    x,
    y,
    node: {
      id,
      tag: 'MISC',
      source: 'QA',
      summary: id,
      version: 1,
      createdByQaTryId: null,
      createdAt: null,
    },
  }
}

function edge(from: string, to: string): RoutedEdge {
  return {
    key: `${from}-${to}`,
    edge: { from, to, relation: 'LEADS_TO', note: 'n' },
    shape: from === to ? 'loop' : 'line',
  } as RoutedEdge
}

function settle(simulation: ReturnType<typeof createSimulation>): number {
  let ticks = 0
  while (step(simulation, null)) {
    ticks += 1
    if (ticks > 4000) throw new Error('never settled')
  }
  return ticks
}

describe('graph simulation', () => {
  it('깨우기 전에는 아무것도 하지 않는다', () => {
    const simulation = createSimulation([node('1', 0, 0), node('2', 100, 0)], [])
    expect(step(simulation, null)).toBe(false)
  })

  it('유한한 틱 안에 멈춘다', () => {
    const simulation = createSimulation([node('1', 0, 0), node('2', 100, 0)], [edge('1', '2')])
    wake(simulation)
    expect(settle(simulation)).toBeGreaterThan(0)
    expect(simulation.alpha).toBeLessThan(REST_ALPHA)
  })

  it('놓은 노드는 놓은 자리 근처에 남는다', () => {
    // 되돌아가면 사용자가 바꾼 모양이 취소된다. 씨앗은 출발점이지 돌아갈 곳이 아니다.
    const simulation = createSimulation([node('1', 0, 0), node('2', 200, 0)], [])
    hold(simulation, '1', 400, 400)
    wake(simulation)
    settle(simulation)

    const at = positions(simulation).get('1')!
    expect(Math.hypot(at.x, at.y)).toBeGreaterThan(200)
  })

  it('쥐고 있는 노드는 포인터 자리에 정확히 있는다', () => {
    const simulation = createSimulation([node('1', 0, 0), node('2', 20, 0)], [edge('1', '2')])
    hold(simulation, '1', 300, 120)
    wake(simulation)
    for (let i = 0; i < 40; i += 1) step(simulation, '1')
    expect(positions(simulation).get('1')).toEqual({ x: 300, y: 120 })
  })

  it('같은 점에 겹친 두 노드를 떼어 놓는다', () => {
    const simulation = createSimulation([node('1', 50, 50), node('2', 50, 50)], [])
    wake(simulation)
    settle(simulation)
    const a = positions(simulation).get('1')!
    const b = positions(simulation).get('2')!
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0)
  })

  it('자기 간선은 길이가 0이라 링크에서 뺀다', () => {
    expect(createSimulation([node('1', 10, 10)], [edge('1', '1')]).links).toHaveLength(0)
  })

  it('없는 노드를 가리키는 간선을 건너뛴다', () => {
    expect(createSimulation([node('1', 0, 0)], [edge('1', 'missing')]).links).toHaveLength(0)
  })

  it('빈 그래프에서 무너지지 않는다', () => {
    const simulation = createSimulation([], [])
    wake(simulation)
    expect(() => settle(simulation)).not.toThrow()
  })
})
