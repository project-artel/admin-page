import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { KnowledgeAxisBreakdown } from './AxisBreakdown'
import { KnowledgeTotalsRail } from './TotalsRail'
import type { KnowledgeStatsCell, KnowledgeStatsTotals } from './knowledgeStatsTypes'

/**
 * 표가 그려지는지, 그리고 "모른다"가 0%로 새지 않는지.
 *
 * 인용률이 그 자리다 — 인용 보고 기능이 없던 기간을 0%로 그리면 지식창고가 통째로 사장된 것처럼
 * 보이고, 그 화면을 보고 지식 기능을 접는 결정이 나올 수 있다.
 */

const cells: KnowledgeStatsCell[] = [
  {
    model: 'sonnet-5',
    reasoningEffort: 'high',
    promptVersion: 'v3',
    agentArch: 'v2-tool-loop',
    entryVersions: 10,
    currentVersions: 7,
    deletedVersions: 3,
    repudiatedVersions: 2,
    retrievalTotal: 40,
    citationTotal: 6,
    citationKnownTotal: 20,
  },
  {
    model: null,
    reasoningEffort: null,
    promptVersion: null,
    agentArch: null,
    entryVersions: 3,
    currentVersions: 3,
    deletedVersions: 0,
    repudiatedVersions: 0,
    retrievalTotal: 5,
    citationTotal: 0,
    citationKnownTotal: 0,
  },
]

const totals: KnowledgeStatsTotals = {
  entryVersions: 13,
  currentVersions: 10,
  deletedVersions: 3,
  repudiatedVersions: 2,
  retrievalTotal: 45,
  citationTotal: 6,
  citationKnownTotal: 20,
}

describe('knowledge dashboard rendering', () => {
  it('축 표가 미상 행을 라벨과 함께 보여 준다', () => {
    const html = renderToStaticMarkup(<KnowledgeAxisBreakdown axis="model" cells={cells} />)
    expect(html).toContain('sonnet-5')
    expect(html).toContain('미상')
  })

  it('인용 판정이 불가능한 행을 0%로 쓰지 않는다', () => {
    // 같은 행의 다른 칸(후속 런이 지움 0/3, 판정 가능 0/5)은 0.0%가 맞다 — 분모가 있고 분자가
    // 0인 것과, 분모 자체가 없는 것은 다른 사실이다. 인용률 칸만 미상이어야 한다.
    const unknownOnly = [{ ...cells[1] }]
    const html = renderToStaticMarkup(<KnowledgeAxisBreakdown axis="model" cells={unknownOnly} />)
    expect(html).toContain('인용 여부를 알 수 있는 검색이 없습니다')
    expect(html).not.toContain('인용 0 / 판정 가능 0')
  })

  it('총계 레일이 인용률 옆에 판정 커버리지를 함께 말한다', () => {
    const html = renderToStaticMarkup(<KnowledgeTotalsRail total={totals} />)
    // 인용 6 / 판정 가능 20 = 30.0%
    expect(html).toContain('30.0%')
    expect(html).toContain('판정 가능')
  })

  it('판정 가능한 검색이 없으면 레일이 그 이유를 말한다', () => {
    const html = renderToStaticMarkup(
      <KnowledgeTotalsRail total={{ ...totals, citationTotal: 0, citationKnownTotal: 0 }} />,
    )
    expect(html).toContain('인용 판정이 가능한 검색 없음')
  })

  it('후속 런이 지운 비율을 폐기라고 단정하지 않는다', () => {
    const html = renderToStaticMarkup(<KnowledgeTotalsRail total={totals} />)
    expect(html).toContain('수리와 폐기가 섞임')
  })

  it('빈 기간에도 표가 무너지지 않는다', () => {
    const html = renderToStaticMarkup(<KnowledgeAxisBreakdown axis="agentArch" cells={[]} />)
    expect(html).toContain('이 기간에 만들어진 지식이 없습니다')
  })
})
