import {
  apiFetch,
  asNullableNumber,
  asNullableString,
  asNumber,
  asRecord,
  asString,
  readJson,
} from '../api/orchestration'
import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraphTypes'

/**
 * 프로젝트 하나의 지식 그래프를 통째로 받는다.
 *
 * 기간을 받지 않는다 — 관계는 만들어진 시각이 아니라 지금 서 있는 모양이 전부라서, 기간으로
 * 자르면 한쪽 끝이 잘린 간선만 남는다. 대신 `nodeLimit`으로 크기를 자른다.
 */
export async function fetchKnowledgeGraph(
  projectId: string,
  nodeLimit: number,
  signal?: AbortSignal,
): Promise<KnowledgeGraph> {
  const params = new URLSearchParams({ nodeLimit: String(nodeLimit) })
  const response = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/knowledge-graph?${params}`,
    { signal },
  )
  return parseKnowledgeGraph(await readJson(response))
}

/**
 * 응답 → 도메인. 네트워크와 떼어 두어야 파싱 규칙을 그대로 테스트할 수 있다.
 *
 * `id`만 필수다. 나머지는 없으면 null로 떨어뜨린다 — 요약이 빠진 노드 하나 때문에 그래프 전체가
 * 사라지는 편보다, 그 노드를 "요약 없음"으로 그리는 편이 낫다.
 */
export function parseKnowledgeGraph(body: unknown): KnowledgeGraph {
  const raw = asRecord(body)

  return {
    projectId: asString(raw.projectId, 'projectId'),
    nodes: (Array.isArray(raw.nodes) ? raw.nodes : []).map((node) => parseNode(asRecord(node))),
    edges: (Array.isArray(raw.edges) ? raw.edges : []).map((edge) => parseEdge(asRecord(edge))),
    truncated: raw.truncated === true,
    nodeLimit: asNumber(raw.nodeLimit, 0),
  }
}

function parseNode(raw: Record<string, unknown>): KnowledgeGraphNode {
  return {
    id: asString(raw.id, 'node.id'),
    tag: asNullableString(raw.tag),
    // 아는 값으로 접지 않는다. `DOCS`/`QA` 밖의 값이 오면 그 문자열 그대로 화면에 나가야
    // 사람이 새 출처가 생겼다는 사실을 본다.
    source: asNullableString(raw.source),
    summary: asNullableString(raw.summary),
    // 0은 실재하는 버전이 아니다. 없으면 "모른다"로 두고 화면이 `—`를 쓴다.
    version: asNullableNumber(raw.version),
    createdByQaTryId: asNullableString(raw.createdByQaTryId),
    createdAt: asNullableString(raw.createdAt),
  }
}

function parseEdge(raw: Record<string, unknown>): KnowledgeGraphEdge {
  return {
    from: asString(raw.from, 'edge.from'),
    to: asString(raw.to, 'edge.to'),
    // 모르는 relation을 여기서 걸러 내지 않는다. 종류는 늘어나기로 되어 있고, 거른 간선은
    // 화면에서 "관계 없음"과 구분되지 않는다.
    relation: asString(raw.relation, 'edge.relation'),
    note: asNullableString(raw.note),
  }
}
