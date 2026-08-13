import type { KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraphTypes'

/**
 * 그래프 배치.
 *
 * ## 왜 결정적 force-directed인가
 *
 * 관계 그래프에는 계층도 순서도 없다. 트리나 격자로 놓으면 없는 위계를 만들어 내고, 서로 이어진
 * 지식이 화면 반대편에 떨어진다. 그래서 이웃을 당기고 나머지를 미는 force 배치를 쓴다.
 *
 * 다만 흔한 force 시뮬레이션과 두 가지가 다르다.
 *
 * 1. **난수를 쓰지 않는다.** 시작 좌표는 노드 id 순서의 황금각 나선이다. 새로고침할 때마다
 *    같은 그래프가 다른 그림으로 나오면 사람이 어제 본 모양을 기억할 수 없고, 테스트도 좌표를
 *    비교할 수 없다. 응답의 노드 순서가 바뀌어도 같은 그림이 나온다.
 * 2. **애니메이션하지 않는다.** 반복을 유한하게 돌려 최종 좌표만 내고 한 번 그린다. 매 프레임
 *    도는 시뮬레이션은 노드가 수백 개면 그대로 프레임을 잡아먹고, 여기서 필요한 것은 움직이는
 *    그림이 아니라 읽을 수 있는 지도다.
 *
 * 정지 조건은 둘 중 먼저 오는 쪽이다.
 *   - 반복 상한: 노드 수에 반비례해서 정한다(아래 `iterationsFor`). 반발력이 O(n²)이라
 *     상한을 고정하면 큰 그래프에서 비용이 그대로 제곱으로 늘어난다.
 *   - 수렴: 한 번의 반복에서 가장 크게 움직인 노드가 `STOP_EPSILON`보다 덜 움직이면 멈춘다.
 *     온도가 선형으로 식으므로 이 조건이 없어도 끝나지만, 대개 상한 훨씬 전에 안정된다.
 */

export interface GraphPoint {
  x: number
  y: number
}

export interface PositionedNode extends GraphPoint {
  node: KnowledgeGraphNode
}

/** 자기 자신을 가리키는 간선은 직선으로 그릴 수 없어 고리가 된다. */
export type EdgeShape = 'line' | 'loop'

export interface RoutedEdge {
  /** React key이자 선택 식별자. 같은 두 노드 사이에 같은 relation이 여럿이어도 겹치지 않는다. */
  key: string
  edge: KnowledgeGraphEdge
  shape: EdgeShape
  /**
   * 두 노드를 잇는 선을 옆으로 밀어내는 양(px, 부호 있음).
   *
   * 같은 쌍에 걸린 간선이 하나뿐이면 0(직선)이고, 여럿이면 서로 다른 값을 받는다. 방향이 반대인
   * 쌍(A→B와 B→A)도 같은 그룹으로 묶여 갈라진다 — 겹쳐 그리면 둘 중 하나만 보이고, 보이지 않는
   * 쪽의 `note`는 화면에서 영영 읽을 수 없다.
   */
  curvature: number
  /** 같은 노드에 걸린 자기 참조 고리의 순번. 고리 반지름을 키워 겹침을 푼다. */
  loopIndex: number
}

export interface GraphLayout {
  width: number
  height: number
  nodes: PositionedNode[]
  edges: RoutedEdge[]
  positions: Map<string, GraphPoint>
  /**
   * 양 끝 중 하나가 응답에 없어 그리지 못한 간선 수.
   *
   * 계약대로면 0이다. `truncated` 응답은 잘린 노드에 걸린 간선도 함께 빼기 때문이다. 그래도
   * 세는 이유는, 0이 아닌 순간 화면이 조용히 관계를 삼키고 있다는 뜻이라서다.
   */
  droppedEdges: number
}

export interface LayoutOptions {
  width?: number
  height?: number
}

/** 노드 반지름. 간선 끝을 이만큼 잘라야 화살촉이 노드 위가 아니라 둘레에 놓인다. */
export const NODE_RADIUS = 9

const DEFAULT_WIDTH = 1000
const DEFAULT_HEIGHT = 640
const PADDING = 44
const STOP_EPSILON = 0.05
/** 같은 쌍에 걸린 간선들을 갈라 놓는 간격(px). */
const CURVE_STEP = 30
/** 힘 계산이 만든 자연스러운 크기보다 더 부풀리지는 않는다. 두 노드가 대각선 양 끝에 박히면 */
/* 관계는 하나인데 화면은 가득 차 보인다. */
const MAX_FIT_SCALE = 1.5
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function iterationsFor(count: number): number {
  return Math.max(60, Math.min(300, Math.round(30_000 / Math.max(count, 1))))
}

/** id가 숫자면 숫자로 견준다. 문자열 비교만 하면 `10`이 `2`보다 앞에 온다. */
function compareIds(a: string, b: string): number {
  const left = Number(a)
  const right = Number(b)
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right
  if (a === b) return 0
  return a < b ? -1 : 1
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeGraphLayout(
  nodes: readonly KnowledgeGraphNode[],
  edges: readonly KnowledgeGraphEdge[],
  options: LayoutOptions = {},
): GraphLayout {
  const width = options.width ?? DEFAULT_WIDTH
  const height = options.height ?? DEFAULT_HEIGHT

  // id 중복은 계약에 없지만 오면 뒤엣것을 버린다. 같은 id가 둘이면 간선이 어느 쪽에 붙는지
  // 정할 수 없고, React key도 부딪힌다.
  const seen = new Set<string>()
  const ordered: KnowledgeGraphNode[] = []
  for (const node of [...nodes].sort((a, b) => compareIds(a.id, b.id))) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    ordered.push(node)
  }

  const positions = new Map<string, GraphPoint>()
  const count = ordered.length

  if (count === 0) {
    return { width, height, nodes: [], edges: [], positions, droppedEdges: edges.length }
  }

  const index = new Map<string, number>()
  ordered.forEach((node, i) => index.set(node.id, i))

  const x = new Float64Array(count)
  const y = new Float64Array(count)
  const centerX = width / 2
  const centerY = height / 2
  const seedRadius = Math.min(width, height) / 2 - PADDING

  // 황금각 나선. 같은 개수면 언제나 같은 배치이고, 처음부터 고르게 퍼져 있어 반복 횟수가 적게
  // 든다. 한 점에서 시작하면 초반 반복 전부가 뭉친 덩어리를 푸는 데 쓰인다.
  for (let i = 0; i < count; i += 1) {
    const radius = seedRadius * Math.sqrt((i + 0.5) / count)
    const angle = i * GOLDEN_ANGLE
    x[i] = centerX + radius * Math.cos(angle)
    y[i] = centerY + radius * Math.sin(angle)
  }

  // 당김은 이웃 쌍에만 건다. 자기 참조는 방향이 없어 힘이 되지 않고, 같은 쌍의 복수 관계를
  // 여러 번 당기면 관계를 많이 단 쌍만 서로 달라붙는다.
  const pairs: Array<[number, number]> = []
  const pairSeen = new Set<string>()
  let droppedEdges = 0

  for (const edge of edges) {
    const from = index.get(edge.from)
    const to = index.get(edge.to)
    if (from === undefined || to === undefined) {
      droppedEdges += 1
      continue
    }
    if (from === to) continue
    const key = from < to ? `${from}|${to}` : `${to}|${from}`
    if (pairSeen.has(key)) continue
    pairSeen.add(key)
    pairs.push([from, to])
  }

  const area = (width - PADDING * 2) * (height - PADDING * 2)
  const k = Math.sqrt(area / count) * 0.75
  const iterations = iterationsFor(count)
  const dispX = new Float64Array(count)
  const dispY = new Float64Array(count)
  let temperature = Math.min(width, height) / 8
  const cooling = temperature / (iterations + 1)

  for (let step = 0; step < iterations; step += 1) {
    dispX.fill(0)
    dispY.fill(0)

    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let dx = x[i] - x[j]
        let dy = y[i] - y[j]
        let distance = Math.hypot(dx, dy)
        if (distance < 1e-6) {
          // 완전히 겹친 두 점에는 밀어낼 방향이 없다. 난수 대신 인덱스에서 방향을 만든다.
          dx = Math.cos(i * GOLDEN_ANGLE) * 0.01
          dy = Math.sin(i * GOLDEN_ANGLE) * 0.01
          distance = 0.01
        }
        const force = (k * k) / distance
        const fx = (dx / distance) * force
        const fy = (dy / distance) * force
        dispX[i] += fx
        dispY[i] += fy
        dispX[j] -= fx
        dispY[j] -= fy
      }
    }

    for (const [i, j] of pairs) {
      const dx = x[i] - x[j]
      const dy = y[i] - y[j]
      const distance = Math.max(Math.hypot(dx, dy), 1e-6)
      const force = (distance * distance) / k
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      dispX[i] -= fx
      dispY[i] -= fy
      dispX[j] += fx
      dispY[j] += fy
    }

    // 중앙으로 당기는 약한 힘. 이것이 없으면 서로 이어지지 않은 덩어리들이 반발력만 받아
    // 끝없이 밀려나고, 화면 가장자리에 눌린 채로 끝난다.
    for (let i = 0; i < count; i += 1) {
      dispX[i] += (centerX - x[i]) * 0.02
      dispY[i] += (centerY - y[i]) * 0.02
    }

    let maxMove = 0
    for (let i = 0; i < count; i += 1) {
      const move = Math.hypot(dispX[i], dispY[i])
      if (move > 1e-9) {
        const limited = Math.min(move, temperature)
        x[i] += (dispX[i] / move) * limited
        y[i] += (dispY[i] / move) * limited
        maxMove = Math.max(maxMove, limited)
      }
    }

    temperature = Math.max(temperature - cooling, 0)
    if (maxMove < STOP_EPSILON) break
  }

  fitIntoBox(x, y, count, width, height)

  const laidOut: PositionedNode[] = ordered.map((node, i) => {
    const point = { x: round(x[i]), y: round(y[i]) }
    positions.set(node.id, point)
    return { node, ...point }
  })

  return {
    width,
    height,
    nodes: laidOut,
    edges: routeEdges(edges, positions),
    positions,
    droppedEdges,
  }
}

/**
 * 최종 좌표를 그릴 상자에 맞춘다.
 *
 * 가로세로를 따로 늘리지 않는다 — 비율이 깨지면 같은 길이의 관계가 방향에 따라 다른 길이로
 * 보이고, 그래프에서 길이는 "얼마나 먼가"로 읽힌다.
 */
function fitIntoBox(
  x: Float64Array,
  y: Float64Array,
  count: number,
  width: number,
  height: number,
): void {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (let i = 0; i < count; i += 1) {
    minX = Math.min(minX, x[i])
    maxX = Math.max(maxX, x[i])
    minY = Math.min(minY, y[i])
    maxY = Math.max(maxY, y[i])
  }

  const spanX = maxX - minX
  const spanY = maxY - minY
  const targetWidth = width - PADDING * 2
  const targetHeight = height - PADDING * 2
  const scale = Math.min(
    spanX > 1e-6 ? targetWidth / spanX : Infinity,
    spanY > 1e-6 ? targetHeight / spanY : Infinity,
    MAX_FIT_SCALE,
  )

  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  for (let i = 0; i < count; i += 1) {
    x[i] = width / 2 + (x[i] - midX) * scale
    y[i] = height / 2 + (y[i] - midY) * scale
  }
}

/**
 * 간선에 그릴 모양을 정한다.
 *
 * 세 가지가 전부 가능하고 셋 다 순진하게 그리면 하나로 겹친다.
 *   - 자기 참조(A→A)
 *   - 같은 쌍의 복수 관계(A→B가 `REFINES`이면서 `CONTRADICTS`)
 *   - 방향이 반대인 쌍(A→B와 B→A)
 * 뒤의 둘을 한 그룹으로 묶어 좌우로 갈라 놓는다. 그룹 안 순서는 입력 순서라 결정적이다.
 */
function routeEdges(
  edges: readonly KnowledgeGraphEdge[],
  positions: ReadonlyMap<string, GraphPoint>,
): RoutedEdge[] {
  interface Draft {
    edge: KnowledgeGraphEdge
    order: number
  }

  const groups = new Map<string, Draft[]>()

  edges.forEach((edge, order) => {
    if (!positions.has(edge.from) || !positions.has(edge.to)) return
    const key =
      edge.from === edge.to
        ? `self:${edge.from}`
        : compareIds(edge.from, edge.to) <= 0
          ? `${edge.from}|${edge.to}`
          : `${edge.to}|${edge.from}`
    const group = groups.get(key)
    if (group) group.push({ edge, order })
    else groups.set(key, [{ edge, order }])
  })

  const routed: Array<RoutedEdge & { order: number }> = []

  for (const group of groups.values()) {
    group.forEach((draft, slot) => {
      const isSelf = draft.edge.from === draft.edge.to
      routed.push({
        key: `${draft.order}:${draft.edge.from}-${draft.edge.relation}-${draft.edge.to}`,
        edge: draft.edge,
        shape: isSelf ? 'loop' : 'line',
        // 하나뿐이면 직선. 여럿이면 가운데를 기준으로 대칭으로 벌린다.
        curvature: isSelf || group.length === 1 ? 0 : (slot - (group.length - 1) / 2) * CURVE_STEP,
        loopIndex: isSelf ? slot : 0,
        order: draft.order,
      })
    })
  }

  // 응답 순서대로 그린다. 그룹 순서로 내보내면 같은 데이터가 겹침 순서만 달라진 그림이 된다.
  routed.sort((a, b) => a.order - b.order)
  return routed.map(({ order: _order, ...edge }) => edge)
}

export interface EdgeGeometry {
  /** SVG `path`의 `d`. */
  d: string
  /** 곡선의 가운데. `CONTRADICTS`의 ✕ 표식이 여기 놓인다. */
  midX: number
  midY: number
}

/**
 * 간선 하나의 실제 좌표.
 *
 * 끝을 노드 반지름만큼 잘라 낸다. 자르지 않으면 화살촉이 노드 원 아래로 숨어 방향이 사라진다.
 */
export function edgeGeometry(
  routed: RoutedEdge,
  positions: ReadonlyMap<string, GraphPoint>,
): EdgeGeometry | null {
  const from = positions.get(routed.edge.from)
  const to = positions.get(routed.edge.to)
  if (!from || !to) return null

  if (routed.shape === 'loop') {
    // 노드에 걸리는 고리. 순번마다 커져서 같은 노드의 고리들이 포개지지 않는다. 다만 무한히
    // 키우지는 않는다 — 커질수록 어느 노드의 고리인지가 오히려 흐려진다.
    const radius = 16 + Math.min(routed.loopIndex, 6) * 8
    const reach = radius * 2.4
    // 위쪽이 기본이지만 노드가 상단에 붙어 있으면 고리가 그림 밖으로 잘린다. 잘린 고리는
    // 그리지 않은 것과 같다.
    const direction = from.y - reach >= 0 ? -1 : 1
    const startX = from.x - 4
    const startY = from.y + direction * NODE_RADIUS
    const endX = from.x + 4
    const endY = from.y + direction * (NODE_RADIUS + 2)
    const c1x = from.x - radius
    const c1y = from.y + direction * reach
    const c2x = from.x + radius
    const c2y = from.y + direction * reach
    return {
      d: `M ${round(startX)} ${round(startY)} C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(endX)} ${round(endY)}`,
      // 3차 베지에의 t=0.5.
      midX: round((startX + 3 * c1x + 3 * c2x + endX) / 8),
      midY: round((startY + 3 * c1y + 3 * c2y + endY) / 8),
    }
  }

  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  /*
   * 법선은 간선의 방향을 따라 뒤집힌다. 그래서 A→B에 +15를, B→A에 -15를 주면 두 선이 **같은**
   * 쪽으로 휘어 정확히 포개진다 — 역방향 쌍이 화면에서 사라지는 정확한 경로다. 휘어짐의 부호를
   * 간선 자신이 아니라 쌍의 고정된 방향(id 순서)에 매어 그 뒤집힘을 상쇄한다.
   */
  const oriented = compareIds(routed.edge.from, routed.edge.to) <= 0 ? 1 : -1
  const curvature = routed.curvature * oriented
  // 선의 법선 방향으로 밀어낸 제어점. 이 한 점이 곡선의 휘어짐을 전부 진다.
  const controlX = (from.x + to.x) / 2 + (-dy / length) * curvature
  const controlY = (from.y + to.y) / 2 + (dx / length) * curvature

  const start = shiftToward(from, controlX, controlY, NODE_RADIUS + 2)
  // 도착 쪽을 더 자른다. 화살촉이 차지하는 길이만큼이다.
  const end = shiftToward(to, controlX, controlY, NODE_RADIUS + 9)

  return {
    d: `M ${round(start.x)} ${round(start.y)} Q ${round(controlX)} ${round(controlY)}, ${round(end.x)} ${round(end.y)}`,
    // 2차 베지에의 t=0.5.
    midX: round((start.x + 2 * controlX + end.x) / 4),
    midY: round((start.y + 2 * controlY + end.y) / 4),
  }
}

function shiftToward(point: GraphPoint, towardX: number, towardY: number, by: number): GraphPoint {
  const dx = towardX - point.x
  const dy = towardY - point.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return point
  return { x: point.x + (dx / length) * by, y: point.y + (dy / length) * by }
}
