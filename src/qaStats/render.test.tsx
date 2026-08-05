import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AxisBreakdown } from './AxisBreakdown'
import { CombinationMatrix } from './CombinationMatrix'
import { RecentRuns } from './RecentRuns'
import { TotalsRail } from './TotalsRail'
import type { QaStatsCell, QaStatsTotals, QaTrySummary } from './qaStatsTypes'

/**
 * 표가 실제로 그려지는지, 그리고 "모른다"가 0으로 새지 않는지.
 *
 * 값이 없는 경우는 화면에서 가장 조용히 틀리는 자리다 — 비용 null이 `$0.00`으로 나가면 그
 * 설정이 공짜로 보이고, 아무도 그 숫자를 의심하지 않는다.
 */

const cells: QaStatsCell[] = [
  {
    model: 'sonnet-5',
    reasoningEffort: 'high',
    promptVersion: 'v3',
    agentArch: 'v2-tool-loop',
    runs: 4,
    completed: 3,
    failed: 1,
    cancelled: 0,
    active: 0,
    inputTokens: 12_000,
    outputTokens: 3_000,
    cachedInputTokens: 0,
    reasoningTokens: 500,
    costUsd: 0.0421,
    llmCalls: 12,
    avgCompletedDurationMs: 45_000,
  },
  {
    model: null,
    reasoningEffort: null,
    promptVersion: null,
    agentArch: null,
    runs: 1,
    completed: 0,
    failed: 0,
    cancelled: 1,
    active: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    costUsd: null,
    llmCalls: 0,
    avgCompletedDurationMs: null,
  },
]

const totals: QaStatsTotals = {
  runs: 5,
  completed: 3,
  failed: 1,
  cancelled: 1,
  active: 0,
  inputTokens: 12_000,
  outputTokens: 3_000,
  cachedInputTokens: 0,
  reasoningTokens: 500,
  costUsd: 0.0421,
  llmCalls: 12,
  avgCompletedDurationMs: 45_000,
}

describe('dashboard rendering', () => {
  it('축 표가 미상 행을 라벨과 함께 보여 준다', () => {
    const html = renderToStaticMarkup(<AxisBreakdown axis="model" cells={cells} />)
    expect(html).toContain('sonnet-5')
    expect(html).toContain('미상')
  })

  it('단가 미상 셀을 $0.00으로 쓰지 않는다', () => {
    const unpriced = [{ ...cells[0], costUsd: null }]
    const html = renderToStaticMarkup(<AxisBreakdown axis="model" cells={unpriced} />)
    expect(html).not.toContain('$0.00')
    expect(html).toContain('—')
  })

  it('총계 레일이 비용 미상을 그렇게 말한다', () => {
    const html = renderToStaticMarkup(<TotalsRail total={{ ...totals, costUsd: null }} />)
    expect(html).toContain('단가를 아는 호출 없음')
  })

  it('매트릭스가 두 축 교차표를 그린다', () => {
    const html = renderToStaticMarkup(<CombinationMatrix cells={cells} />)
    expect(html).toContain('v2-tool-loop')
    expect(html).toContain('sonnet-5')
  })

  it('최근 런 표가 상태를 색이 아니라 글자로 말한다', () => {
    const runs: QaTrySummary[] = [
      {
        id: '42',
        status: 'FAILED',
        startedAt: '2026-08-04T10:00:00Z',
        completedAt: '2026-08-04T10:01:00Z',
        model: 'sonnet-5',
        reasoningEffort: 'high',
        promptVersion: 'v3',
        agentArch: 'v2-tool-loop',
        agentFingerprint: 'a3f1c9d2e8b0',
      },
    ]
    const html = renderToStaticMarkup(<RecentRuns runs={runs} />)
    expect(html).toContain('실패')
    expect(html).toContain('a3f1c9d2e8b0')
  })

  it('빈 기간에도 표가 무너지지 않는다', () => {
    const html = renderToStaticMarkup(<AxisBreakdown axis="agentArch" cells={[]} />)
    expect(html).toContain('이 기간에 실행된 런이 없습니다')
  })
})
