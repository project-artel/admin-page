/**
 * 지식창고 그래프의 도메인 타입.
 *
 * 지표 화면(`knowledgeStats`)이 "지식이 쓸모 있나"를 묻는다면 이 화면은 "지식이 서로 어떻게
 * 얽혀 있나"를 묻는다. 그래서 여기에는 집계 셀이 없고 노드와 간선만 있다.
 */

/** 노드 한 개 = 지식 항목 하나의 현재 버전. 삭제된 지식은 응답에 오지 않는다. */
export interface KnowledgeGraphNode {
  id: string
  /** 분류. 서버가 늘릴 수 있어 열거하지 않는다. */
  tag: string | null
  /** `DOCS`(문서 추출) | `QA`(런 중 관측). 모르는 값도 그대로 들고 있는다. */
  source: string | null
  summary: string | null
  version: number | null
  /** QA 관측 지식에만 있다. 문서에서 뽑은 지식은 만든 런이 없다. */
  createdByQaTryId: string | null
  createdAt: string | null
}

/** 간선 한 개 = 두 지식 사이의 관계. 방향이 있다. */
export interface KnowledgeGraphEdge {
  from: string
  to: string
  /** 자유 문자열. 아래 `KNOWN_RELATIONS`는 지금 아는 값일 뿐 전부가 아니다. */
  relation: string
  /** 이 관계가 왜 있는지의 유일한 근거. 없을 수 있고, 없으면 그 사실을 화면이 말해야 한다. */
  note: string | null
}

export interface KnowledgeGraph {
  projectId: string
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  /**
   * 노드가 잘렸다. **잘린 노드에 걸린 간선도 응답에 없다** — 화면에 보이는 관계의 부재가
   * "관계가 없다"가 아니라 "안 받았다"일 수 있다는 뜻이라, 반드시 화면에 드러나야 한다.
   */
  truncated: boolean
  nodeLimit: number
}

/**
 * 화면이 고른 하나.
 *
 * 노드와 간선을 한 상태에 담는다 — 둘이 동시에 선택되면 오른쪽 패널이 무엇의 근거를 보여 주는
 * 중인지가 흐려진다.
 */
export type GraphSelection = { kind: 'node'; id: string } | { kind: 'edge'; key: string }

export const KNOWN_RELATIONS = [
  'LEADS_TO',
  'REFINES',
  'CONTRADICTS',
  'DEPENDS_ON',
  'REPLACES',
] as const

export type KnownRelation = (typeof KNOWN_RELATIONS)[number]

/**
 * 관계 한 종류를 그리는 법.
 *
 * 색은 여기에 없다. `slug`만 내보내고 색·파선 패턴은 전부 `graph.css`가 진다 —
 * DESIGN.md가 TSX에 raw 색을 두지 말라고 하고, 색만으로 뜻을 말하지도 말라고 한다.
 * 그래서 종류마다 **선 모양**이 다르고, 그 모양을 글자로 옮긴 것이 `strokeHint`다.
 */
export interface RelationStyle {
  /** CSS 클래스 접미사. 모르는 relation은 전부 `other`로 떨어진다. */
  slug: string
  /** 사람이 읽는 이름. 서버 식별자는 `code`로 따로 남긴다. */
  label: string
  /** 그래프에 쓰인 선 모양을 글자로 말한 것. 범례와 스크린리더가 이걸 읽는다. */
  strokeHint: string
}

const RELATION_STYLES: Record<KnownRelation, RelationStyle> = {
  LEADS_TO: { slug: 'leads-to', label: '이어짐', strokeHint: '실선' },
  REFINES: { slug: 'refines', label: '구체화', strokeHint: '긴 파선' },
  // 성격이 반대인 유일한 관계라 가장 눈에 띄어야 한다. 색이 아니라 굵기·점선·✕ 표식 셋으로
  // 말한다 — 셋 중 어느 하나는 색각 이상에서도 남는다.
  CONTRADICTS: { slug: 'contradicts', label: '모순', strokeHint: '굵은 점선 + ✕ 표식' },
  DEPENDS_ON: { slug: 'depends-on', label: '의존', strokeHint: '짧은 점선' },
  REPLACES: { slug: 'replaces', label: '대체', strokeHint: '일점쇄선' },
}

export const RELATION_SLUGS = [
  ...KNOWN_RELATIONS.map((relation) => RELATION_STYLES[relation].slug),
  'other',
]

function isKnownRelation(relation: string): relation is KnownRelation {
  return (KNOWN_RELATIONS as readonly string[]).includes(relation)
}

/**
 * 모르는 relation도 반드시 무언가로 그려진다. 여기서 예외를 던지면 서버가 관계 종류를 하나
 * 추가하는 순간 화면 전체가 빈다 — 새 종류는 늘어나기로 되어 있는 값이다.
 */
export function relationStyle(relation: string): RelationStyle {
  if (isKnownRelation(relation)) return RELATION_STYLES[relation]
  return {
    slug: 'other',
    // 이름을 지어내지 않는다. 서버가 준 문자열을 그대로 보여 주는 편이 "기타"보다 낫다.
    label: relation === '' ? '미상' : relation,
    strokeHint: '가는 이점쇄선',
  }
}

export type NodeShape = 'circle' | 'square' | 'diamond'

/** 출처도 색이 아니라 모양으로 가른다. 범례가 같은 모양을 다시 그린다. */
export function sourceShape(source: string | null): NodeShape {
  if (source === 'QA') return 'circle'
  if (source === 'DOCS') return 'square'
  return 'diamond'
}

export function sourceLabel(source: string | null): string {
  if (source === 'QA') return 'QA 런 관측'
  if (source === 'DOCS') return '문서 추출'
  return source === null || source === '' ? '출처 미상' : source
}
