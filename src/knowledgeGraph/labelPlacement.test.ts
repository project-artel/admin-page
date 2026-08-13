import { describe, expect, it } from 'vitest'
import { placeLabels } from './labelPlacement'
import type { PositionedNode } from './layout'
import { displayWidth, truncate } from './text'

/**
 * 라벨이 읽히는지를 지키는 파일이고, 이게 깨졌을 때 아무 알람도 울리지 않았다.
 *
 * 요약은 한글 문장인데 자르기가 글자 수를 셌다. 한글은 폭이 두 배라 "14자"가 28단위로 그려져
 * 옆 라벨 위에 앉았다. 예외도 경고도 없이 그림만 못 읽게 된다.
 */

const KOREAN = '타이틀 화면(TitleScene)에는 게임 시작(MapSceneButton), 이어하기, 종료 세 버튼이 있다.'

function node(id: string, x: number, y: number): PositionedNode {
  return {
    x,
    y,
    node: {
      id,
      tag: 'MISC',
      source: 'QA',
      summary: `요약 ${id}`,
      version: 1,
      createdByQaTryId: null,
      createdAt: null,
    },
  }
}

const OPTIONS = {
  unitWidth: 6,
  lineHeight: 13,
  widthLimit: 14,
  keep: new Set<string>(),
  degree: () => 0,
}

describe('displayWidth', () => {
  it('한글을 라틴 문자 두 배로 센다', () => {
    expect(displayWidth('abcd')).toBe(4)
    expect(displayWidth('가나')).toBe(4)
  })
})

describe('truncate', () => {
  it('글자 수가 아니라 폭으로 자른다', () => {
    const cut = truncate(KOREAN, 14)
    expect(displayWidth(cut)).toBeLessThanOrEqual(14)
    expect(cut.endsWith('…')).toBe(true)
  })

  it('예산 안에 드는 문자열은 그대로 둔다', () => {
    expect(truncate('지식', 14)).toBe('지식')
  })
})

describe('placeLabels', () => {
  it('아래가 막히면 위로 옮긴다', () => {
    const placed = placeLabels([node('1', 0, 0), node('2', 8, 0)], () => '가나다라', OPTIONS)
    expect(placed.size).toBe(2)
    expect(placed.get('2')!.y).toBeLessThan(0)
  })

  it('두 자리가 다 막힌 라벨은 버린다', () => {
    // 덮어 그리면 둘 다 못 읽는다. 버려도 노드는 클릭되고 전문은 상세에 있다.
    const placed = placeLabels(
      [node('1', 0, 0), node('2', 8, 0), node('3', 16, 0)],
      () => '가나다라',
      OPTIONS,
    )
    expect(placed.size).toBe(2)
    expect(placed.has('3')).toBe(false)
  })

  it('관계가 많은 노드가 이름을 지킨다', () => {
    const placed = placeLabels(
      [node('1', 0, 0), node('2', 8, 0), node('3', 16, 0)],
      () => '가나다라',
      { ...OPTIONS, degree: (id) => (id === '3' ? 9 : 0) },
    )
    expect(placed.has('3')).toBe(true)
  })

  it('선택된 노드는 겹쳐도 반드시 그린다', () => {
    const placed = placeLabels([node('1', 0, 0), node('2', 2, 0)], () => '가나다라', {
      ...OPTIONS,
      keep: new Set(['2']),
    })
    expect(placed.has('2')).toBe(true)
  })

  it('빈 그래프에서 무너지지 않는다', () => {
    expect(placeLabels([], () => 'x', OPTIONS).size).toBe(0)
  })
})
