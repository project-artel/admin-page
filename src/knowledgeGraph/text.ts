import { EMPTY_MARK } from '../qaStats/format'

/** 요약을 한 줄에 앉힌다. 자른 자리는 `…`가 말한다 — 잘렸다는 사실이 사라지면 안 된다. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** 값이 없을 때 화면에 쓰는 글자. qaStats와 같은 표시를 쓴다. */
export function orEmptyMark(value: string | null): string {
  return value === null || value === '' ? EMPTY_MARK : value
}
