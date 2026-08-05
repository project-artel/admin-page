import { useId, useState } from 'react'
import { completionRate, matrix, UNKNOWN_LABEL } from './pivot'
import { formatCount, formatRate } from './format'
import { AXES, AXIS_LABELS, type Axis, type QaStatsCell } from './qaStatsTypes'

/**
 * 두 축 교차표. "모델을 바꾼 덕인가, 구조를 바꾼 덕인가"는 한 축만 봐서는 갈리지 않는다.
 *
 * 서버를 다시 부르지 않는다 — 런은 4축 조합으로 분할되어 있어 어떤 두 축의 교차든 같은 셀
 * 목록의 부분합이다.
 */
export function CombinationMatrix({ cells }: { cells: QaStatsCell[] }) {
  const [rowAxis, setRowAxis] = useState<Axis>('model')
  const [colAxis, setColAxis] = useState<Axis>('agentArch')
  const rowId = useId()
  const colId = useId()

  /** 같은 축을 양쪽에 놓으면 대각선만 찬 표가 된다. 고르는 순간 반대쪽을 비켜 준다. */
  const pick = (next: Axis, side: 'row' | 'col') => {
    const other = side === 'row' ? colAxis : rowAxis
    const setThis = side === 'row' ? setRowAxis : setColAxis
    const setOther = side === 'row' ? setColAxis : setRowAxis
    setThis(next)
    if (next === other) {
      setOther(side === 'row' ? rowAxis : colAxis)
    }
  }

  const view = matrix(cells, rowAxis, colAxis)

  return (
    <section aria-labelledby="matrix-title">
      <div className="section__head">
        <h2 className="section__title" id="matrix-title">
          축 조합 비교
        </h2>
        <span className="section__note">칸은 런 수와 완주율. 빈 칸은 아직 돌려 보지 않은 조합</span>
        <span className="topbar__spacer" />
        <span className="field">
          <label className="field__label" htmlFor={rowId}>
            행
          </label>
          <select
            className="control"
            id={rowId}
            value={rowAxis}
            onChange={(event) => pick(event.target.value as Axis, 'row')}
          >
            {AXES.map((axis) => (
              <option key={axis} value={axis}>
                {AXIS_LABELS[axis]}
              </option>
            ))}
          </select>
        </span>
        <span className="field">
          <label className="field__label" htmlFor={colId}>
            열
          </label>
          <select
            className="control"
            id={colId}
            value={colAxis}
            onChange={(event) => pick(event.target.value as Axis, 'col')}
          >
            {AXES.map((axis) => (
              <option key={axis} value={axis}>
                {AXIS_LABELS[axis]}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="table-scroll">
        <table className="table matrix">
          <caption className="section__note" style={{ captionSide: 'bottom', textAlign: 'left' }}>
            행 {AXIS_LABELS[rowAxis]} × 열 {AXIS_LABELS[colAxis]}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {AXIS_LABELS[rowAxis]} \ {AXIS_LABELS[colAxis]}
              </th>
              {view.colValues.map((value) => (
                <th scope="col" className="num" key={value ?? ' unknown'}>
                  {value ?? UNKNOWN_LABEL}
                </th>
              ))}
              <th scope="col" className="num">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rowValues.map((rowValue, rowIndex) => (
              <tr key={rowValue ?? ' unknown'}>
                <th scope="row">{rowValue ?? UNKNOWN_LABEL}</th>
                {view.grid[rowIndex].map((cell, colIndex) => (
                  <td
                    className={cell ? 'cell' : 'cell cell--empty'}
                    key={view.colValues[colIndex] ?? ' unknown'}
                  >
                    {cell ? (
                      <>
                        <span className="cell__runs">{formatCount(cell.runs)}</span>
                        <span className="cell__rate">{formatRate(completionRate(cell))}</span>
                      </>
                    ) : (
                      // 0이 아니라 빈 칸이다. "돌려 보고 전부 실패했다"와 "안 돌려 봤다"는 다르다.
                      <span aria-label="실행 없음">·</span>
                    )}
                  </td>
                ))}
                <td className="cell">
                  <span className="cell__runs">{formatCount(view.rowTotals[rowIndex].runs)}</span>
                  <span className="cell__rate">
                    {formatRate(completionRate(view.rowTotals[rowIndex]))}
                  </span>
                </td>
              </tr>
            ))}
            {view.rowValues.length === 0 && (
              <tr>
                <td className="muted">이 기간에 실행된 런이 없습니다.</td>
              </tr>
            )}
          </tbody>
          {view.rowValues.length > 0 && (
            <tfoot>
              <tr>
                <td>합계</td>
                {view.colTotals.map((cell, index) => (
                  <td className="cell" key={view.colValues[index] ?? ' unknown'}>
                    <span className="cell__runs">{formatCount(cell.runs)}</span>
                    <span className="cell__rate">{formatRate(completionRate(cell))}</span>
                  </td>
                ))}
                <td className="cell">
                  <span className="cell__runs">
                    {formatCount(view.rowTotals.reduce((sum, row) => sum + row.runs, 0))}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
