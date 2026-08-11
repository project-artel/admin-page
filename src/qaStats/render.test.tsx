import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AxisBreakdown } from './AxisBreakdown'
import { CombinationMatrix } from './CombinationMatrix'
import { RecentRuns } from './RecentRuns'
import { ScoreBreakdown } from './ScoreBreakdown'
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
    verdictKnown: 3,
    stepsTotal: 30,
    stepsPassed: 24,
    casesTotal: 8,
    casesPassed: 6,
    scoredRuns: 2,
    correctPass: 14,
    falseAlarm: 2,
    miss: 3,
    correctFail: 1,
    unreported: 4,
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
    // 취소된 런 하나. 요약도 채점도 없다 — 판정을 **모르는** 것이지 0점이 아니다.
    verdictKnown: 0,
    stepsTotal: 0,
    stepsPassed: 0,
    casesTotal: 0,
    casesPassed: 0,
    scoredRuns: 0,
    correctPass: 0,
    falseAlarm: 0,
    miss: 0,
    correctFail: 0,
    unreported: 0,
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
  verdictKnown: 3,
  stepsTotal: 30,
  stepsPassed: 24,
  casesTotal: 8,
  casesPassed: 6,
  scoredRuns: 2,
  correctPass: 14,
  falseAlarm: 2,
  miss: 3,
  correctFail: 1,
  unreported: 4,
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

describe('score rendering', () => {
  it('미탐과 오탐을 한 숫자로 접지 않는다', () => {
    const html = renderToStaticMarkup(<ScoreBreakdown cells={cells} />)
    expect(html).toContain('미탐률')
    expect(html).toContain('오탐률')
    // 분모가 서로 다르다는 사실이 title에 남아야 한다. 비율만 보면 두 수를 같은 척도로 읽는다.
    expect(html).toContain('실패 기대')
    expect(html).toContain('통과 기대')
  })

  it('채점된 런이 없는 축 값을 "점수 0"으로 그리지 않는다', () => {
    const html = renderToStaticMarkup(<ScoreBreakdown cells={[cells[1]]} />)
    expect(html).toContain('판정 없음')
    expect(html).toContain('채점 없음')
    // 0.0%는 옆 칸의 —와 함께 읽히면 "전부 놓쳤다"로 읽힌다.
    expect(html).not.toContain('0.0%')
  })

  it('합격률 옆에 그 비율이 얹힌 런 수가 함께 나온다', () => {
    const html = renderToStaticMarkup(<ScoreBreakdown cells={cells} />)
    // 셀은 런 5건인데 판정은 3건, 채점은 2건 위에 얹혀 있다.
    expect(html).toContain('3/4')
    expect(html).toContain('2/4')
  })

  it('총계 레일이 채점된 런이 없음을 글자로 말한다', () => {
    const html = renderToStaticMarkup(
      <TotalsRail total={{ ...totals, scoredRuns: 0, miss: 0, falseAlarm: 0, unreported: 0 }} />,
    )
    expect(html).toContain('기대 라벨로 채점된 런 없음')
  })

  it('매트릭스가 지표마다 그 지표의 표본 수를 함께 쓴다', () => {
    const html = renderToStaticMarkup(<CombinationMatrix cells={cells} />)
    // 기본 지표는 완주율이라 표본 줄이 없다 — 분모가 곧 런 수다.
    expect(html).toContain('완주율')
    expect(html).toContain('미탐률')
    expect(html).toContain('스텝 합격률')
  })

  it('빈 기간에도 점수 표가 무너지지 않는다', () => {
    const html = renderToStaticMarkup(<ScoreBreakdown cells={[]} />)
    expect(html).toContain('이 기간에 실행된 런이 없습니다')
  })
})
