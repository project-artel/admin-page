import { describe, expect, it } from 'vitest'
import { breakdown, completionRate, matrix, sumCells } from './pivot'
import type { QaStatsCell } from './qaStatsTypes'

/**
 * 이 파일이 지키는 것은 산술이다.
 *
 * 화면이 서버를 다시 부르지 않고 축을 바꿀 수 있는 이유는 런이 4축 조합으로 분할되어 있어서
 * 어떤 분해든 같은 셀 목록의 부분합이라는 데 있다. 그 부분합이 틀리면 숫자는 여전히 그럴듯해
 * 보이고, 화면만 봐서는 잡히지 않는다.
 */

function cell(overrides: Partial<QaStatsCell>): QaStatsCell {
  return {
    model: 'sonnet-5',
    reasoningEffort: 'high',
    promptVersion: 'v3',
    agentArch: 'v2-tool-loop',
    runs: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    active: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    costUsd: null,
    llmCalls: 0,
    avgCompletedDurationMs: null,
    ...overrides,
  }
}

describe('completionRate', () => {
  it('진행 중과 취소를 분모에서 뺀다', () => {
    // 방금 시작한 런과 운영자가 멈춘 런은 설정의 성질이 아니다.
    const rate = completionRate(cell({ runs: 10, completed: 3, failed: 1, cancelled: 4, active: 2 }))
    expect(rate).toBeCloseTo(0.75)
  })

  it('판정된 런이 없으면 0%가 아니라 null이다', () => {
    // 0%로 쓰면 "전부 실패"와 같은 글자가 된다.
    expect(completionRate(cell({ runs: 2, active: 2 }))).toBeNull()
  })
})

describe('sumCells', () => {
  it('단가를 아는 셀이 없으면 비용은 null로 남는다', () => {
    const summed = sumCells([cell({ runs: 1, costUsd: null }), cell({ runs: 1, costUsd: null })])
    // 0으로 접으면 "공짜"가 된다.
    expect(summed.costUsd).toBeNull()
  })

  it('일부만 단가를 알면 아는 것만 더한다', () => {
    const summed = sumCells([cell({ costUsd: 0.5 }), cell({ costUsd: null }), cell({ costUsd: 0.25 })])
    expect(summed.costUsd).toBeCloseTo(0.75)
  })

  it('평균 소요는 완주 런 수로 가중한다', () => {
    // 1건짜리 셀이 100건짜리 셀과 같은 무게를 가지면 안 된다.
    const summed = sumCells([
      cell({ completed: 1, avgCompletedDurationMs: 100_000 }),
      cell({ completed: 9, avgCompletedDurationMs: 10_000 }),
    ])
    expect(summed.avgCompletedDurationMs).toBeCloseTo(19_000)
  })

  it('완주한 런이 없으면 평균 소요는 null이다', () => {
    expect(sumCells([cell({ runs: 3, failed: 3 })]).avgCompletedDurationMs).toBeNull()
  })
})

describe('breakdown', () => {
  const cells = [
    cell({ model: 'sonnet-5', agentArch: 'v1', runs: 5, completed: 4, failed: 1 }),
    cell({ model: 'sonnet-5', agentArch: 'v2', runs: 3, completed: 1, failed: 2 }),
    cell({ model: 'gpt-4o', agentArch: 'v1', runs: 2, completed: 2 }),
    cell({ model: null, agentArch: null, runs: 1, completed: 1 }),
  ]

  it('축별 합이 전체 런 수와 같다', () => {
    // 어느 축으로 접든 같은 런을 다르게 묶었을 뿐이다. 어긋나면 셀이 분할이 아니라는 뜻이다.
    const byModel = breakdown(cells, 'model').reduce((sum, group) => sum + group.runs, 0)
    const byArch = breakdown(cells, 'agentArch').reduce((sum, group) => sum + group.runs, 0)
    expect(byModel).toBe(11)
    expect(byArch).toBe(11)
  })

  it('미상 그룹을 버리지 않고 끝에 둔다', () => {
    const groups = breakdown(cells, 'model')
    expect(groups.map((group) => group.value)).toEqual(['sonnet-5', 'gpt-4o', null])
    expect(groups.at(-1)?.runs).toBe(1)
  })

  it('같은 축 값의 셀을 하나로 접는다', () => {
    const sonnet = breakdown(cells, 'model').find((group) => group.value === 'sonnet-5')
    expect(sonnet?.runs).toBe(8)
    expect(sonnet?.completed).toBe(5)
    expect(completionRate(sonnet!)).toBeCloseTo(5 / 8)
  })
})

describe('matrix', () => {
  const cells = [
    cell({ model: 'sonnet-5', agentArch: 'v1', runs: 5, completed: 5 }),
    cell({ model: 'sonnet-5', agentArch: 'v2', runs: 3, completed: 1, failed: 2 }),
    cell({ model: 'gpt-4o', agentArch: 'v1', runs: 2, completed: 2 }),
  ]

  it('돌려 보지 않은 조합은 0이 아니라 빈 칸이다', () => {
    const view = matrix(cells, 'model', 'agentArch')
    const gptRow = view.rowValues.indexOf('gpt-4o')
    const v2Col = view.colValues.indexOf('v2')
    // 0건으로 그리면 실험 공백이 "전부 실패"로 읽힌다.
    expect(view.grid[gptRow][v2Col]).toBeNull()
  })

  it('행·열 합계가 서로, 그리고 전체와 맞는다', () => {
    const view = matrix(cells, 'model', 'agentArch')
    const rowSum = view.rowTotals.reduce((sum, row) => sum + row.runs, 0)
    const colSum = view.colTotals.reduce((sum, col) => sum + col.runs, 0)
    expect(rowSum).toBe(10)
    expect(colSum).toBe(10)
  })

  it('축 값 순서가 단일 축 분해와 같다', () => {
    // 두 표를 나란히 읽는 사람이 행 순서를 다시 익히지 않아야 한다.
    const view = matrix(cells, 'model', 'agentArch')
    expect(view.rowValues).toEqual(breakdown(cells, 'model').map((group) => group.value))
  })
})
