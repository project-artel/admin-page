import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StepLabelList } from './StepLabelList'
import type { LabelStep } from './expectedLabelsApi'
import { changedLabels, countExpectedFailures, countLabelled, firstExpectedFailure } from './labels'

function step(n: number, expectedPassed: boolean | null, action = `스텝 ${n}`): LabelStep {
  return { step: n, action, caseId: null, expectedPassed }
}

describe('라벨 롤업', () => {
  it('실패 기대 스텝만 센다', () => {
    expect(countExpectedFailures([step(1, true), step(2, false), step(3, null)])).toBe(1)
  })

  it('미지정은 채점 대상에서 빠진다', () => {
    // 분모에 들어가면 라벨을 안 단 스텝이 성적을 희석한다.
    expect(countLabelled([step(1, true), step(2, false), step(3, null)])).toBe(2)
  })

  it('첫 실패 기대 스텝의 번호를 준다', () => {
    expect(firstExpectedFailure([step(1, true), step(2, false), step(3, false)])).toBe(2)
    expect(firstExpectedFailure([step(1, true)])).toBe(0)
  })
})

describe('저장 대상 고르기', () => {
  it('바뀐 스텝만 싣는다', () => {
    const before = [step(1, null), step(2, true), step(3, false)]
    const after = [step(1, false), step(2, true), step(3, false)]

    // 전부 보내면 이 화면이 읽은 뒤 저작 쪽에서 달라진 라벨까지 덮어쓴다.
    expect(changedLabels(before, after).map((s) => s.step)).toEqual([1])
  })

  it('미지정으로 되돌린 것도 변경이다', () => {
    const before = [step(1, true)]
    const after = [step(1, null)]

    // null을 "안 바뀜"으로 보면 라벨을 지울 방법이 화면에서 사라진다.
    expect(changedLabels(before, after)).toHaveLength(1)
    expect(changedLabels(before, after)[0].expectedPassed).toBeNull()
  })
})

describe('스텝 목록 렌더', () => {
  it('세 상태를 모두 그리고 현재 값만 checked다', () => {
    const html = renderToStaticMarkup(
      <StepLabelList steps={[step(1, false)]} onChange={() => {}} />,
    )

    // 체크박스가 아니라 세 선택지를 그대로 드러낸다 — "미지정"이 다른 상태와 같은 모습을
    // 가지면, 라벨 기본값을 통과로 두는 것과 같은 실수를 UI로 옮긴 것이 된다.
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
  })

  it('실패 기대가 0이면 그 시나리오의 한계를 말한다', () => {
    const html = renderToStaticMarkup(
      <StepLabelList steps={[step(1, true), step(2, null)]} onChange={() => {}} />,
    )

    expect(html).toContain('실패 기대 스텝 0개')
    expect(html).toContain('같은 점수로')
  })

  it('실패 기대 뒤에 스텝이 남으면 도달 불가를 알린다', () => {
    const html = renderToStaticMarkup(
      <StepLabelList steps={[step(1, false), step(2, true)]} onChange={() => {}} />,
    )

    // 도달 못 한 스텝은 틀린 것이 아니라 미보고다. 그걸 모르면 저작자가 낮은 커버리지를
    // 시나리오의 모양이 아니라 모델 탓으로 읽는다.
    expect(html).toContain('1번 스텝이 실패 기대')
    expect(html).toContain('미보고')
  })

  it('마지막 스텝이 실패 기대면 도달 불가 안내를 띄우지 않는다', () => {
    const html = renderToStaticMarkup(
      <StepLabelList steps={[step(1, true), step(2, false)]} onChange={() => {}} />,
    )

    expect(html).not.toContain('도달하지')
  })
})
