import { formatCount } from '../qaStats/format'
import { RateCell } from './RateCell'
import {
  breakdown,
  citationCoverage,
  citationRate,
  repudiationRate,
  sumCells,
  UNKNOWN_LABEL,
} from './pivot'
import { AXIS_LABELS, type Axis, type KnowledgeStatsCell } from './knowledgeStatsTypes'

/**
 * 축 하나로 접은 표.
 *
 * 미상(null) 행을 지우지 않는다 — 지우면 이 표의 합이 위 레일의 총계와 어긋나고, 화면에는 그
 * 차이를 설명할 자리가 없다. 여기 모이는 것은 "만든 런은 아는데 그 런의 축이 비어 있는" 버전이다
 * (만든 런 자체를 모르는 버전은 집계 질의의 `qa_try` 조인이 이미 떨군다).
 */
export function KnowledgeAxisBreakdown({
  axis,
  cells,
}: {
  axis: Axis
  cells: KnowledgeStatsCell[]
}) {
  const groups = breakdown(cells, axis)
  const footer = sumCells(groups)

  return (
    <section aria-labelledby={`knowledge-axis-${axis}`}>
      <h3 className="panel__title" id={`knowledge-axis-${axis}`}>
        {AXIS_LABELS[axis]}
      </h3>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{AXIS_LABELS[axis]}</th>
              <th scope="col" className="num">
                만든 버전
              </th>
              <th scope="col" className="num">
                후속 런이 지움
              </th>
              <th scope="col" className="num">
                검색 노출
              </th>
              <th scope="col" className="num">
                인용률
              </th>
              <th scope="col" className="num">
                판정 가능
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.value ?? ' unknown'}>
                <td>
                  <span
                    className={
                      group.value === null ? 'axis-value axis-value--unknown' : 'axis-value'
                    }
                  >
                    {group.value ?? UNKNOWN_LABEL}
                  </span>
                </td>
                <td className="num">{formatCount(group.entryVersions)}</td>
                <td className="num">
                  {/* 낮을수록 좋다. 방향을 안 뒤집으면 잘 살아남는 설정이 빨갛게 칠해진다. */}
                  <RateCell
                    rate={repudiationRate(group)}
                    higherIsBetter={false}
                    title={`후속 런이 지움 ${group.repudiatedVersions} / 만든 버전 ${group.entryVersions}`}
                    unknownHint="이 설정이 만든 버전이 없습니다."
                  />
                </td>
                <td className="num">{formatCount(group.retrievalTotal)}</td>
                <td className="num">
                  <RateCell
                    rate={citationRate(group)}
                    title={`인용 ${group.citationTotal} / 판정 가능 ${group.citationKnownTotal}`}
                    unknownHint="인용 여부를 알 수 있는 검색이 없습니다. 0%가 아니라 미상입니다."
                  />
                </td>
                <td className="num">
                  {/* 인용률을 얼마나 믿을 수 있는지. 낮으면 옆 칸 숫자가 표본 몇 건짜리다. */}
                  <RateCell
                    rate={citationCoverage(group)}
                    title={`판정 가능 ${group.citationKnownTotal} / 검색 노출 ${group.retrievalTotal}`}
                    unknownHint="검색 기록이 없습니다."
                  />
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  이 기간에 만들어진 지식이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <tr>
                <td>합계</td>
                <td className="num">{formatCount(footer.entryVersions)}</td>
                <td className="num">
                  <RateCell rate={repudiationRate(footer)} higherIsBetter={false} />
                </td>
                <td className="num">{formatCount(footer.retrievalTotal)}</td>
                <td className="num">
                  <RateCell rate={citationRate(footer)} />
                </td>
                <td className="num">
                  <RateCell rate={citationCoverage(footer)} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
