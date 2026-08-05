/** 값이 없다는 표시. "모른다"와 "0"이 같은 글자를 쓰지 않도록 이 하나만 쓴다. */
export const EMPTY_MARK = '—'

const counts = new Intl.NumberFormat('ko-KR')
const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
const percents = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const timestamps = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'short',
  timeStyle: 'medium',
})

export function formatCount(value: number): string {
  return counts.format(value)
}

/** 토큰은 자릿수보다 규모가 중요해 축약한다. 정확한 값이 필요하면 `title`로 붙인다. */
export function formatTokens(value: number): string {
  return value < 10_000 ? counts.format(value) : compact.format(value)
}

export function formatRate(rate: number | null): string {
  return rate === null ? EMPTY_MARK : percents.format(rate)
}

/**
 * 비용. null은 "단가 미상"이라 `$0.00`으로 쓰지 않는다.
 *
 * 소수 넷째 자리까지 보이는 이유는 런 한 번이 센트 미만인 경우가 흔해서다. 둘째 자리에서
 * 끊으면 대부분의 셀이 `$0.00`이 되어 비교가 되지 않는다.
 */
export function formatCost(value: number | null): string {
  if (value === null) return EMPTY_MARK
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return EMPTY_MARK
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}초`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}분 ${Math.round(seconds - minutes * 60)}초`
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? EMPTY_MARK : timestamps.format(date)
}

/** `<input type="date">`가 읽는 형식. 로컬 달력 기준이라 UTC로 자르면 하루가 밀린다. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
