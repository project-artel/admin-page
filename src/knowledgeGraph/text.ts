import { EMPTY_MARK } from '../qaStats/format'

/**
 * 문자열이 그려지는 폭. 단위는 라틴 문자 한 글자다.
 *
 * 글자 수를 세는 것이 라벨을 겹치게 만든 원인이었다. `summary`는 한글 문장이고 한글 한 글자는
 * 라틴 문자의 약 두 배 폭으로 그려진다. 22자로 잘라 놓고 44단위를 그리니, 세는 값은 모두 같은데
 * 실제로는 이웃 라벨 위에 올라앉았다.
 *
 * 아래 범위가 넓은 글자들이다 — 한글(음절·자모), CJK 한자와 가나, 전각 형태. 나머지는 1이다.
 * 실제 텍스트 측정의 근사이지만, "두 문자 체계 모두에서 대충 맞다"와 "한쪽에서 확실히 틀리다"의
 * 차이이고, 순수 함수로 남아 테스트할 수 있다.
 */
export function displayWidth(text: string): number {
  let width = 0
  for (const character of text) width += isWide(character) ? 2 : 1
  return width
}

function isWide(character: string): boolean {
  const code = character.codePointAt(0)
  if (code === undefined) return false
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa960 && code <= 0xa97f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

/**
 * 요약을 한 줄에 앉힌다. 자른 자리는 `…`가 말한다 — 잘렸다는 사실이 사라지면 안 된다.
 *
 * 예산은 글자 수가 아니라 **폭**이다(위 참조). 말줄임표가 1단위를 쓰고, 그것과 한 글자조차 못
 * 담을 예산이면 말줄임표만 남는다 — "여기 이름이 있으니 상세에서 읽으라"는 뜻이고, 첫 글자만
 * 남겨 오해를 주는 것보다 낫다.
 */
export function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  if (displayWidth(trimmed) <= max) return trimmed

  const budget = max - 1
  let width = 0
  let cut = ''
  for (const character of trimmed) {
    const next = width + (isWide(character) ? 2 : 1)
    if (next > budget) break
    width = next
    cut += character
  }
  return `${cut}…`
}

/** 값이 없을 때 화면에 쓰는 글자. qaStats와 같은 표시를 쓴다. */
export function orEmptyMark(value: string | null): string {
  return value === null || value === '' ? EMPTY_MARK : value
}
