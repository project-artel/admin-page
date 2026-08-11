import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GraphCanvas } from './GraphCanvas'
import { GraphDetail } from './GraphDetail'
import { GraphLegend } from './GraphLegend'
import { RelationList } from './RelationList'
import { computeGraphLayout } from './layout'
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraphTypes'

/**
 * 그림이 실제로 그려지는지, 그리고 색을 못 보는 경로에도 뜻이 남는지.
 *
 * 이 화면에서 가장 조용히 틀리는 자리는 "색으로만 말한 것"이다 — 모순 관계가 빨간 선으로만
 * 표시되면 색각 이상에게는 다른 관계와 같은 선이고, 그 사실을 아무도 화면에서 알아채지 못한다.
 */

function node(id: string, overrides: Partial<KnowledgeGraphNode> = {}): KnowledgeGraphNode {
  return {
    id,
    tag: 'MISC',
    source: 'QA',
    summary: `지식 ${id}`,
    version: 2,
    createdByQaTryId: '36',
    createdAt: '2026-08-11T06:00:00Z',
    ...overrides,
  }
}

function edge(
  from: string,
  to: string,
  relation = 'LEADS_TO',
  note: string | null = null,
): KnowledgeGraphEdge {
  return { from, to, relation, note }
}

const nodes = [node('1'), node('2', { source: 'DOCS', createdByQaTryId: null })]
const edges = [edge('1', '2', 'CONTRADICTS', '상점 버튼이 마을이 아니라 광장에 있다')]
const layout = computeGraphLayout(nodes, edges)

describe('GraphCanvas', () => {
  it('노드와 간선을 그린다', () => {
    const html = renderToStaticMarkup(
      <GraphCanvas layout={layout} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('graph__node')
    expect(html).toContain('graph__edge--contradicts')
    // 모순 간선에는 색 말고 표식이 하나 더 있다.
    expect(html).toContain('graph__edge-mark')
  })

  it('노드를 키보드로 고를 수 있다', () => {
    const html = renderToStaticMarkup(
      <GraphCanvas layout={layout} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('role="button"')
  })

  it('고른 노드를 색이 아니라 aria로도 말한다', () => {
    const html = renderToStaticMarkup(
      <GraphCanvas layout={layout} selection={{ kind: 'node', id: '1' }} onSelect={() => {}} />,
    )
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('graph__node--selected')
  })

  it('간선이 없어도 노드는 그린다', () => {
    const only = computeGraphLayout(nodes, [])
    const html = renderToStaticMarkup(
      <GraphCanvas layout={only} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('graph__node')
    expect(html).not.toContain('graph__edge-line')
  })

  it('빈 그래프에도 무너지지 않는다', () => {
    const empty = computeGraphLayout([], [])
    const html = renderToStaticMarkup(
      <GraphCanvas layout={empty} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('<svg')
  })

  it('자기 참조 간선도 그린다', () => {
    const self = computeGraphLayout([node('1')], [edge('1', '1', 'REFINES')])
    const html = renderToStaticMarkup(
      <GraphCanvas layout={self} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('graph__edge--refines')
    expect(html).not.toContain('NaN')
  })

  it('모르는 relation을 기타 모양으로 그린다', () => {
    const unknown = computeGraphLayout(nodes, [edge('1', '2', 'BRAND_NEW_RELATION')])
    const html = renderToStaticMarkup(
      <GraphCanvas layout={unknown} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('graph__edge--other')
  })
})

describe('GraphLegend', () => {
  it('선 모양의 뜻을 글자로도 쓴다', () => {
    const html = renderToStaticMarkup(<GraphLegend layout={layout} />)
    expect(html).toContain('CONTRADICTS')
    expect(html).toContain('모순')
    // 색과 모양을 못 보는 경로에는 이 글자만 남는다.
    expect(html).toContain('굵은 점선')
  })

  it('모르는 relation을 서버가 준 이름 그대로 싣는다', () => {
    const html = renderToStaticMarkup(
      <GraphLegend layout={computeGraphLayout(nodes, [edge('1', '2', 'BRAND_NEW_RELATION')])} />,
    )
    expect(html).toContain('BRAND_NEW_RELATION')
  })

  it('출처를 도형 이름으로도 말한다', () => {
    // 모르는 출처가 섞인 그래프. 서버가 출처를 하나 더 만들어도 범례가 그것을 말해야 한다.
    const mixed = [...nodes, node('3', { source: 'IMPORTED' })]
    const html = renderToStaticMarkup(<GraphLegend layout={computeGraphLayout(mixed, edges)} />)
    expect(html).toContain('QA 런 관측')
    expect(html).toContain('문서 추출')
    expect(html).toContain('IMPORTED')
    expect(html).toContain('마름모')
  })

  it('관계가 없는 그래프에서는 그 사실을 쓴다', () => {
    const html = renderToStaticMarkup(<GraphLegend layout={computeGraphLayout(nodes, [])} />)
    expect(html).toContain('이 그래프에는 관계가 없습니다')
  })
})

describe('GraphDetail', () => {
  it('고르기 전에는 무엇을 고르면 되는지 말한다', () => {
    const html = renderToStaticMarkup(
      <GraphDetail layout={layout} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('노드를 고르면')
  })

  it('노드의 요약·태그·출처·버전·만든 런을 보여 준다', () => {
    const html = renderToStaticMarkup(
      <GraphDetail layout={layout} selection={{ kind: 'node', id: '1' }} onSelect={() => {}} />,
    )
    expect(html).toContain('지식 1')
    expect(html).toContain('MISC')
    expect(html).toContain('QA 런 관측')
    expect(html).toContain('v2')
    expect(html).toContain('QA #36')
  })

  it('만든 런이 없는 지식을 0번 런으로 만들지 않는다', () => {
    const html = renderToStaticMarkup(
      <GraphDetail layout={layout} selection={{ kind: 'node', id: '2' }} onSelect={() => {}} />,
    )
    expect(html).toContain('런에서 만들어지지 않음')
    expect(html).not.toContain('QA #')
  })

  it('간선을 고르면 메모를 보여 준다', () => {
    const html = renderToStaticMarkup(
      <GraphDetail
        layout={layout}
        selection={{ kind: 'edge', key: layout.edges[0].key }}
        onSelect={() => {}}
      />,
    )
    expect(html).toContain('상점 버튼이 마을이 아니라 광장에 있다')
    expect(html).toContain('CONTRADICTS')
  })

  it('메모가 없으면 없다고 쓴다', () => {
    const bare = computeGraphLayout(nodes, [edge('1', '2', 'LEADS_TO', null)])
    const html = renderToStaticMarkup(
      <GraphDetail
        layout={bare}
        selection={{ kind: 'edge', key: bare.edges[0].key }}
        onSelect={() => {}}
      />,
    )
    expect(html).toContain('메모가 없습니다')
  })

  it('관계가 하나도 없는 지식을 그렇게 말한다', () => {
    const lonely = computeGraphLayout([node('1')], [])
    const html = renderToStaticMarkup(
      <GraphDetail layout={lonely} selection={{ kind: 'node', id: '1' }} onSelect={() => {}} />,
    )
    expect(html).toContain('어떤 지식과도 이어져 있지 않습니다')
  })
})

describe('RelationList', () => {
  it('그림을 집지 않고도 같은 간선을 고를 수 있다', () => {
    const html = renderToStaticMarkup(
      <RelationList layout={layout} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('<button')
    expect(html).toContain('CONTRADICTS')
    expect(html).toContain('상점 버튼이 마을이 아니라 광장에 있다')
  })

  it('자기 참조 간선을 자기 자신으로 쓴다', () => {
    const self = computeGraphLayout([node('1')], [edge('1', '1', 'REFINES')])
    const html = renderToStaticMarkup(
      <RelationList layout={self} selection={null} onSelect={() => {}} />,
    )
    expect(html).toContain('자기 자신')
  })
})
