import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/orchestration'
import { parseKnowledgeGraph } from './knowledgeGraphApi'
import { relationStyle, sourceLabel, sourceShape } from './knowledgeGraphTypes'

/**
 * 파싱이 지켜야 하는 것은 "계약대로 온 응답을 읽는다"가 아니라 그 반대다 — 계약에서 조금 벗어난
 * 응답이 왔을 때 화면이 통째로 사라지지 않는 것.
 */

const response = {
  projectId: '1',
  nodes: [
    {
      id: '1',
      tag: 'MISC',
      source: 'QA',
      summary: '지식 카운터',
      version: 1,
      createdByQaTryId: '36',
      createdAt: '2026-08-11T06:00:00Z',
    },
  ],
  edges: [{ from: '1', to: '2', relation: 'LEADS_TO', note: '마을 상단바의 상점 버튼' }],
  truncated: false,
  nodeLimit: 200,
}

describe('parseKnowledgeGraph', () => {
  it('계약대로 온 응답을 읽는다', () => {
    const graph = parseKnowledgeGraph(response)
    expect(graph.projectId).toBe('1')
    expect(graph.nodes[0].summary).toBe('지식 카운터')
    expect(graph.edges[0].note).toBe('마을 상단바의 상점 버튼')
    expect(graph.truncated).toBe(false)
    expect(graph.nodeLimit).toBe(200)
  })

  it('노드가 0개인 응답을 오류로 만들지 않는다', () => {
    const graph = parseKnowledgeGraph({ ...response, nodes: [], edges: [] })
    expect(graph.nodes).toEqual([])
    expect(graph.edges).toEqual([])
  })

  it('nodes/edges가 배열이 아니면 빈 목록으로 읽는다', () => {
    const graph = parseKnowledgeGraph({ projectId: '1' })
    expect(graph.nodes).toEqual([])
    expect(graph.edges).toEqual([])
    expect(graph.truncated).toBe(false)
  })

  it('모르는 relation을 버리지 않는다', () => {
    // 종류는 늘어나기로 되어 있다. 거른 간선은 화면에서 "관계 없음"과 구분되지 않는다.
    const graph = parseKnowledgeGraph({
      ...response,
      edges: [{ from: '1', to: '2', relation: 'CONFLICTS_WITH_LATER', note: null }],
    })
    expect(graph.edges[0].relation).toBe('CONFLICTS_WITH_LATER')
  })

  it('빠진 선택 필드를 0이 아니라 null로 둔다', () => {
    const graph = parseKnowledgeGraph({
      ...response,
      nodes: [{ id: '7', summary: '문서에서 뽑은 지식', source: 'DOCS' }],
    })
    const node = graph.nodes[0]
    // 문서 지식에는 만든 런이 없다. 여기서 0이나 빈 문자열로 떨어지면 화면이 없는 런을 가리킨다.
    expect(node.createdByQaTryId).toBeNull()
    expect(node.version).toBeNull()
    expect(node.tag).toBeNull()
    expect(node.createdAt).toBeNull()
  })

  it('id가 없는 노드는 그래프를 세울 수 없으므로 거절한다', () => {
    // 간선이 id로 붙는다. id 없는 노드를 통과시키면 그 노드에 붙은 관계가 조용히 사라진다.
    expect(() => parseKnowledgeGraph({ ...response, nodes: [{ summary: '이름표 없음' }] })).toThrow(
      ApiError,
    )
  })

  it('truncated는 참인 경우에만 참이다', () => {
    expect(parseKnowledgeGraph({ ...response, truncated: 'yes' }).truncated).toBe(false)
    expect(parseKnowledgeGraph({ ...response, truncated: true }).truncated).toBe(true)
  })
})

describe('relationStyle', () => {
  it('아는 관계에는 선 모양과 이름이 있다', () => {
    expect(relationStyle('CONTRADICTS').slug).toBe('contradicts')
    expect(relationStyle('CONTRADICTS').strokeHint).toContain('✕')
    expect(relationStyle('REFINES').slug).toBe('refines')
  })

  it('모르는 관계에도 그릴 모양을 준다', () => {
    const style = relationStyle('SOMETHING_NEW')
    expect(style.slug).toBe('other')
    // 이름을 지어내지 않는다. 서버가 준 문자열이 그대로 범례에 실린다.
    expect(style.label).toBe('SOMETHING_NEW')
    expect(style.strokeHint).not.toBe('')
  })
})

describe('sourceShape', () => {
  it('출처를 색이 아니라 도형으로 가른다', () => {
    expect(sourceShape('QA')).toBe('circle')
    expect(sourceShape('DOCS')).toBe('square')
    expect(sourceShape('NEW_SOURCE')).toBe('diamond')
    expect(sourceShape(null)).toBe('diamond')
  })

  it('모르는 출처의 이름을 지어내지 않는다', () => {
    expect(sourceLabel('NEW_SOURCE')).toBe('NEW_SOURCE')
    expect(sourceLabel(null)).toBe('출처 미상')
  })
})
