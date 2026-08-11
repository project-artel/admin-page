import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraphTypes'
import { computeGraphLayout, edgeGeometry, type GraphLayout, type GraphPoint } from './layout'
import { createSimulation, hold, positions, step, wake, type Simulation } from './simulation'

/*
 * 그래프를 손으로 밀 수 있게 하는 부분.
 *
 * 판단이 들어간 것은 전부 다른 곳에 순수 함수로 있다 — 씨앗 배치, 힘, 라벨 배치. 여기는 그럴 수
 * 없는 부분만 남긴다: 렌더 사이에 살아 있는 가변 시뮬레이션, 프레임 루프, 그리고 그것을 멈추는 것.
 *
 * 루프는 쓸 에너지가 있는 동안만 존재한다. 안정되면 rAF를 잡지 않으므로, 가만히 둔 탭이 코어를
 * 태우지 않는다.
 */

export type DragHandlers = {
  /** 포인터가 쥐고 있는 노드. 커서 모양과 강조에 쓴다. */
  dragging: string | null
  onDragStart: (nodeId: string, x: number, y: number) => void
  onDragMove: (x: number, y: number) => void
  onDragEnd: () => void
}

export function useGraphDrag(
  nodes: readonly KnowledgeGraphNode[],
  edges: readonly KnowledgeGraphEdge[],
): { layout: GraphLayout; drag: DragHandlers } {
  // 씨앗. 결정적이라 힘이 항상 같은 자리에서 출발하고, 그래서 같은 창고가 방문마다 다른 그림이
  // 되지 않는다. 최종 위치는 힘이 정한다.
  const seed = useMemo(() => computeGraphLayout(nodes, edges), [nodes, edges])

  const simulation = useRef<Simulation | null>(null)
  const frame = useRef<number | null>(null)
  const dragged = useRef<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  // 좌표는 그것이 계산된 씨앗과 함께 보관한다. 그래프가 바뀌면 옛 좌표는 뜻을 잃는데, 효과에서
  // 지우는 대신 여기서 비교하면 낡은 값이 애초에 읽히지 않는다 — 렌더가 한 번 덜 돌고, 지워진
  // 그래프의 좌표로 그림을 그리는 창이 아예 없다.
  const [moved, setMoved] = useState<{ seed: GraphLayout; at: Map<string, GraphPoint> } | null>(
    null,
  )
  const live = moved !== null && moved.seed === seed ? moved.at : null

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  useEffect(() => stop, [stop])

  /**
   * 안정되거나 포인터가 놓을 때까지 돈다.
   *
   * 루프 함수를 지역에 두는 이유는 자기 자신을 예약해야 해서다. `useCallback`이 자기 이름을
   * 부르면 선언 전에 읽는 것이 된다.
   */
  const start = useCallback(
    (current: Simulation) => {
      if (frame.current !== null) return

      const run = () => {
        const running = step(current, dragged.current)
        setMoved({ seed, at: positions(current) })

        if (running || dragged.current !== null) {
          frame.current = requestAnimationFrame(run)
          return
        }
        // 안정됨. 좌표는 버리지 않는다 — 힘이 남긴 자리가 곧 지금의 그림이다. 여기서 버리면
        // 씨앗으로 되돌아가 사용자의 드래그가 취소된다.
        frame.current = null
      }

      frame.current = requestAnimationFrame(run)
    },
    [seed],
  )

  // 그래프가 도착하면 한 번 이완시킨다. 처음 보이는 것이 씨앗이 아니라 힘이 합의한 모양이 되도록.
  useEffect(() => {
    const current = createSimulation(seed.nodes, seed.edges)
    simulation.current = current
    wake(current)
    start(current)
  }, [seed, start])

  const onDragStart = useCallback(
    (nodeId: string, x: number, y: number) => {
      const current = simulation.current
      if (current === null) return
      dragged.current = nodeId
      setDragging(nodeId)
      hold(current, nodeId, x, y)
      wake(current)
      start(current)
    },
    [start],
  )

  const onDragMove = useCallback(
    (x: number, y: number) => {
      const current = simulation.current
      const id = dragged.current
      if (current === null || id === null) return
      hold(current, id, x, y)
      // 움직일 때마다 깨우는 이유: 천천히 끄는 동안 에너지가 말라 이웃이 얼어붙지 않게.
      wake(current)
      start(current)
    },
    [start],
  )

  const onDragEnd = useCallback(() => {
    dragged.current = null
    setDragging(null)
    const current = simulation.current
    if (current === null) return
    // 에너지를 남긴 채 놓아, 툭 끊기지 않고 정돈되며 멈추게 한다.
    wake(current)
    start(current)
  }, [start])

  /**
   * 라이브 좌표로 다시 그린 배치.
   *
   * 간선은 옮기는 것이 아니라 다시 계산한다. 경로에 자기 고리와 곡률이 들어 있어 끝점 두 개를
   * 평행이동해서는 살아남지 않고, 그대로 두면 끌린 노드가 자기 관계선에서 빠져나온다.
   *
   * 캔버스 크기는 씨앗의 것을 그대로 쓴다. 드래그가 화면 크기를 바꾸면 그림 전체가 커서 밑에서
   * 미끄러져 노드가 포인터를 영영 따라잡지 못한다.
   */
  const layout = useMemo<GraphLayout>(() => {
    if (live === null) return seed
    const points = new Map<string, GraphPoint>(live)
    return {
      ...seed,
      positions: points,
      nodes: seed.nodes.map((positioned) => {
        const at = points.get(positioned.node.id)
        return at === undefined ? positioned : { ...positioned, x: at.x, y: at.y }
      }),
      edges: seed.edges.filter((routed) => edgeGeometry(routed, points) !== null),
    }
  }, [live, seed])

  return { layout, drag: { dragging, onDragStart, onDragMove, onDragEnd } }
}
