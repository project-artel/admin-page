import { describe, expect, it } from 'vitest'
import type { UsageTotals } from './llmUsageTypes'
import { fillDays, isPartiallyPriced, share, sumTotals, totalTokens } from './usage'

function totals(overrides: Partial<UsageTotals> = {}): UsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    costUsd: null,
    calls: 0,
    pricedCalls: 0,
    ...overrides,
  }
}

describe('totalTokens', () => {
  it('leaves cached input and reasoning out of the sum', () => {
    // 둘 다 입력·출력의 부분집합이다. 더하면 같은 토큰을 두 번 세어 총량이 청구서와 안 맞는다.
    const row = totals({
      inputTokens: 1000,
      outputTokens: 100,
      cachedInputTokens: 800,
      reasoningTokens: 60,
    })

    expect(totalTokens(row)).toBe(1100)
  })
})

describe('share', () => {
  it('reports no share instead of zero when nothing was spent', () => {
    // 0%로 쓰면 "안 썼다"와 "비중을 낼 수 없다"가 같은 글자가 된다.
    expect(share(0, 0)).toBeNull()
    expect(share(0, 100)).toBe(0)
  })
})

describe('isPartiallyPriced', () => {
  it('marks a total that stands on fewer calls than it counts', () => {
    expect(isPartiallyPriced(totals({ calls: 4, pricedCalls: 4 }))).toBe(false)
    expect(isPartiallyPriced(totals({ calls: 4, pricedCalls: 1 }))).toBe(true)
  })
})

describe('sumTotals', () => {
  it('keeps the known spend when one row has no unit price', () => {
    const sum = sumTotals([
      totals({ inputTokens: 100, costUsd: 0.001, calls: 1, pricedCalls: 1 }),
      totals({ inputTokens: 200, costUsd: null, calls: 1, pricedCalls: 0 }),
    ])

    // "모른다" 한 줄이 합계를 통째로 null로 만들면 아는 지출까지 화면에서 사라진다.
    expect(sum.costUsd).toBe(0.001)
    expect(sum.inputTokens).toBe(300)
    expect(sum.calls).toBe(2)
    expect(sum.pricedCalls).toBe(1)
  })

  it('stays unknown when no row has a price', () => {
    const sum = sumTotals([totals({ costUsd: null }), totals({ costUsd: null })])

    // 여기서 0을 내면 "전부 단가 미상"이 "전부 공짜"로 읽힌다.
    expect(sum.costUsd).toBeNull()
  })

  it('is unknown for an empty list', () => {
    expect(sumTotals([]).costUsd).toBeNull()
    expect(sumTotals([]).calls).toBe(0)
  })
})

describe('fillDays', () => {
  it('inserts the days the server left out', () => {
    const filled = fillDays(
      [{ date: '2026-08-03', totals: totals({ inputTokens: 10 }) }],
      new Date(2026, 7, 1),
      new Date(2026, 7, 5),
    )

    // 빈 날을 건너뛰면 막대 간격이 시간 간격과 어긋나 추이가 실제보다 고르게 보인다.
    expect(filled.map((day) => day.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
    ])
    expect(filled[0].totals).toBeNull()
    expect(filled[2].totals?.inputTokens).toBe(10)
  })

  it('treats `to` as exclusive, the way the query does', () => {
    const filled = fillDays([], new Date(2026, 7, 1), new Date(2026, 7, 2))

    expect(filled.map((day) => day.date)).toEqual(['2026-08-01'])
  })
})
