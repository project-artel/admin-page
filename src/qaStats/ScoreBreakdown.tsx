import { useId, useState } from 'react'
import { Coverage } from './Coverage'
import { ScoreRate } from './ScoreRate'
import { formatCount } from './format'
import {
  breakdown,
  casePassRate,
  falseAlarmRate,
  gradedSteps,
  missRate,
  stepPassRate,
  sumCells,
  unreportedRate,
  UNKNOWN_LABEL,
  type AxisGroup,
} from './pivot'
import { AXES, AXIS_LABELS, type Axis, type QaStatsCell } from './qaStatsTypes'

/**
 * "그래서 QA를 잘했나"를 축 하나로 접어 보는 표.
 *
 * 축별 분해와 따로 두는 이유는 컬럼 수다. 완주율 표에 아홉 칸을 더 붙이면 두 열 격자에서 전부
 * 가로 스크롤 안으로 들어가 비교가 되지 않는다. 대신 축을 고르게 하고 폭을 전부 쓴다.
 *
 * **자기채점과 기대-라벨 채점을 같은 표에 두되 커버리지를 각각 앞에 둔다.** 두 지표의 분모가
 * 다르기 때문이다 — 요약을 못 받은 런과, 요약은 받았지만 라벨이 없어 채점하지 않은 런은 다른
 * 이유로 빠진다. 하나의 "커버리지"로 합치면 그 둘이 섞여 저작의 공백이 설정의 성질로 읽힌다.
 */
export function ScoreBreakdown({ cells }: { cells: QaStatsCell[] }) {
  const [axis, setAxis] = useState<Axis>('model')
  const axisFieldId = useId()

  const groups = breakdown(cells, axis)
  const footer = sumCells(groups)

  return (
    <section aria-labelledby="score-title">
      <div className="section__head">
        <h2 className="section__title" id="score-title">
          판정과 채점
        </h2>
        <span className="section__note">
          합격률은 에이전트의 자기채점. 미탐·오탐은 사람이 단 기대 라벨과 대조한 결과
        </span>
        <span className="topbar__spacer" />
        <span className="field">
          <label className="field__label" htmlFor={axisFieldId}>
            축
          </label>
          <select
            className="control"
            id={axisFieldId}
            value={axis}
            onChange={(event) => setAxis(event.target.value as Axis)}
          >
            {AXES.map((value) => (
              <option key={value} value={value}>
                {AXIS_LABELS[value]}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{AXIS_LABELS[axis]}</th>
              <th scope="col" className="num">
                런
              </th>
              <th scope="col" className="num">
                판정 커버리지
              </th>
              <th scope="col" className="num">
                스텝 합격률
              </th>
              <th scope="col" className="num">
                TC 합격률
              </th>
              <th scope="col" className="num">
                채점 커버리지
              </th>
              {/* 미탐을 오탐보다 앞에 둔다. QA 에이전트에게 더 나쁜 쪽이고, 표는 왼쪽부터 읽힌다. */}
              <th scope="col" className="num">
                미탐률
              </th>
              <th scope="col" className="num">
                오탐률
              </th>
              <th scope="col" className="num">
                미보고율
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <ScoreRow key={group.value ?? '\0unknown'} group={group} />
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  이 기간에 실행된 런이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <ScoreRow group={{ value: '합계', ...footer }} />
            </tfoot>
          )}
        </table>
      </div>

      {/* 표에 없는 규약을 한 줄로 못박는다. 이 셋이 이 표에서 가장 오해받기 쉬운 자리다. */}
      <p className="section__note section__note--block">
        미탐은 <strong>실패해야 하는 스텝을 통과라 보고한 것</strong>이라 못 찾은 버그가 되고, 오탐은
        그 반대다. 두 비율의 분모가 서로 다르다(각각 실패 기대 스텝 수, 통과 기대 스텝 수). 판정이
        오지 않은 스텝은 어느 쪽에도 들지 않고 미보고율이 따로 진다.
      </p>
    </section>
  )
}

function ScoreRow({ group }: { group: AxisGroup }) {
  const graded = gradedSteps(group)

  return (
    <tr>
      <td>
        <span className={group.value === null ? 'axis-value axis-value--unknown' : 'axis-value'}>
          {group.value ?? UNKNOWN_LABEL}
        </span>
      </td>
      <td className="num">{formatCount(group.runs)}</td>
      <td className="num">
        <Coverage known={group.verdictKnown} runs={group.runs} nothing="판정 없음" />
      </td>
      <td className="num">
        <ScoreRate
          rate={stepPassRate(group)}
          detail={`통과 ${group.stepsPassed} / 스텝 ${group.stepsTotal} · 런 ${group.verdictKnown}건`}
        />
      </td>
      <td className="num">
        <ScoreRate
          rate={casePassRate(group)}
          detail={`통과 ${group.casesPassed} / TC ${group.casesTotal} · 런 ${group.verdictKnown}건`}
        />
      </td>
      <td className="num">
        <Coverage known={group.scoredRuns} runs={group.runs} nothing="채점 없음" />
      </td>
      <td className="num">
        <ScoreRate
          rate={missRate(group)}
          polarity="lower-better"
          detail={`미탐 ${group.miss} / 실패 기대 ${group.miss + group.correctFail}`}
        />
      </td>
      <td className="num">
        <ScoreRate
          rate={falseAlarmRate(group)}
          polarity="lower-better"
          detail={`오탐 ${group.falseAlarm} / 통과 기대 ${group.correctPass + group.falseAlarm}`}
        />
      </td>
      <td className="num">
        <ScoreRate
          rate={unreportedRate(group)}
          polarity="lower-better"
          detail={`미보고 ${group.unreported} / 채점 대상 ${graded}`}
        />
      </td>
    </tr>
  )
}
