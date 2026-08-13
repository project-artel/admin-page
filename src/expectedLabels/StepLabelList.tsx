import type { LabelStep } from './expectedLabelsApi'
import {
  LABEL_STATES,
  countExpectedFailures,
  countLabelled,
  firstExpectedFailure,
} from './labels'

const TEXT = new Map<boolean | null, string>([
  [null, '미지정'],
  [true, '통과 기대'],
  [false, '실패 기대'],
])

const SHORT = new Map<boolean | null, string>([
  [null, '—'],
  [true, '통과'],
  [false, '실패'],
])

function modifier(value: boolean | null): string {
  return value === null ? 'unset' : value ? 'pass' : 'fail'
}

/**
 * 스텝 목록과 3상태 라벨 컨트롤. 표시만 하고 상태는 들고 있지 않다 — 저장 여부를 아는 쪽이
 * 부모라, 여기서 상태를 나누면 "저장 안 됨"이 두 곳에서 각자 계산된다.
 *
 * **체크박스를 쓰지 않는 이유**: 체크박스는 두 상태뿐이라 "미지정"이 둘 중 하나와 같은 모습을
 * 갖게 된다. 그건 라벨 기본값을 `true`로 두는 것과 같은 실수를 UI로 옮긴 것이다. 세 선택지를
 * 그대로 드러내고 `aria-checked`로도 말한다.
 */
export function StepLabelList({
  steps,
  onChange,
}: {
  steps: LabelStep[]
  onChange: (step: number, value: boolean | null) => void
}) {
  const failures = countExpectedFailures(steps)
  const labelled = countLabelled(steps)
  const firstFailure = firstExpectedFailure(steps)
  const cutoffMatters = firstFailure > 0 && firstFailure < steps.length

  if (steps.length === 0) {
    return <p className="notice">이 시나리오에는 스텝이 없습니다.</p>
  }

  return (
    <div className="labels">
      <ol className="labels__list">
        {steps.map((step) => (
          <li className="labels__row" key={step.step}>
            <span className="labels__no mono">{step.step}</span>
            <span className="labels__action">
              {step.action === '' ? <span className="muted">(빈 스텝)</span> : step.action}
              {step.caseId !== null && <span className="labels__tc mono">TC</span>}
            </span>
            <span
              className="labels__states"
              role="radiogroup"
              aria-label={`${step.step}번 스텝 기대 판정`}
            >
              {LABEL_STATES.map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={step.expectedPassed === value}
                  title={TEXT.get(value)}
                  className={`labels__state labels__state--${modifier(value)}${
                    step.expectedPassed === value ? ' labels__state--on' : ''
                  }`}
                  onClick={() => onChange(step.step, value)}
                >
                  {SHORT.get(value)}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ol>

      <footer className="labels__rollup">
        <span className={`labels__count${failures === 0 ? ' labels__count--none' : ''}`}>
          실패 기대 스텝 {failures}개
        </span>
        <span className="muted">
          채점 대상 {labelled} / 전체 {steps.length}
        </span>
        {failures === 0 && (
          <p className="labels__note">
            실패 기대 스텝이 없어, 이 시나리오는 관대한 에이전트와 꼼꼼한 에이전트를 같은 점수로
            봅니다. 최소 한 스텝을 “실패 기대”로 지정하세요.
          </p>
        )}
        {cutoffMatters && (
          <p className="labels__note">
            {firstFailure}번 스텝이 실패 기대라 실행이 거기서 끝날 수 있습니다. 뒤 스텝은 도달하지
            못할 수 있고, 도달하지 못한 스텝은 틀린 것이 아니라 미보고로 채점됩니다.
          </p>
        )}
      </footer>
    </div>
  )
}
