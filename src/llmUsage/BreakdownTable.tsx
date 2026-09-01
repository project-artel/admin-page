import { formatCost, formatCount, formatRate, formatTokens } from '../qaStats/format'
import type { UsageTotals } from './llmUsageTypes'
import { byTokensDesc, isPartiallyPriced, share, sumTotals, totalTokens } from './usage'

/** 표 한 줄. 축이 무엇이든 이름 하나와 합계 한 벌이다. */
export interface BreakdownRow {
  key: string
  /** 첫 칸에 그릴 이름. 모델 축처럼 두 조각이면 부제를 함께 준다. */
  label: string
  sublabel?: string
  totals: UsageTotals
}

/**
 * 축 하나로 접은 표.
 *
 * 세 축(service, model, project)이 같은 컴포넌트를 쓰는 이유는 서버가 세 축에 **같은 합계
 * 한 벌**을 싣기 때문이다. 축마다 표를 따로 쓰면 열이 조금씩 달라지고, 나란히 놓았을 때 어느
 * 열이 같은 뜻인지 읽는 사람이 매번 확인해야 한다.
 *
 * 비중 막대는 토큰 기준이다 — 금액 기준으로 그리면 단가 미상 줄의 막대가 전부 0이 되어, 실제로
 * 가장 많이 쓴 축이 빈칸으로 보인다.
 */
export function BreakdownTable({
  title,
  axisLabel,
  rows,
  note,
  emptyMessage,
}: {
  title: string
  axisLabel: string
  rows: BreakdownRow[]
  note?: string
  emptyMessage: string
}) {
  const sorted = byTokensDesc(rows, (row) => row.totals)
  const footer = sumTotals(sorted.map((row) => row.totals))
  const tokenTotal = totalTokens(footer)
  const titleId = `usage-${axisLabel}`

  return (
    <section aria-labelledby={titleId}>
      <div className="section__head">
        <h3 className="panel__title" id={titleId}>
          {title}
        </h3>
        {note !== undefined && <span className="section__note">{note}</span>}
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{axisLabel}</th>
              <th scope="col" className="num">
                토큰
              </th>
              <th scope="col">비중</th>
              <th scope="col" className="num">
                입력
              </th>
              <th scope="col" className="num">
                출력
              </th>
              <th scope="col" className="num">
                비용
              </th>
              <th scope="col" className="num">
                호출
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const tokens = totalTokens(row.totals)
              return (
                <tr key={row.key}>
                  <td>
                    <span className="axis-value">{row.label}</span>
                    {row.sublabel !== undefined && (
                      <span className="usage-sublabel mono">{row.sublabel}</span>
                    )}
                  </td>
                  <td className="num" title={formatCount(tokens)}>
                    {formatTokens(tokens)}
                  </td>
                  <td>
                    <ShareBar value={share(tokens, tokenTotal)} />
                  </td>
                  <td className="num" title={formatCount(row.totals.inputTokens)}>
                    {formatTokens(row.totals.inputTokens)}
                  </td>
                  <td className="num" title={formatCount(row.totals.outputTokens)}>
                    {formatTokens(row.totals.outputTokens)}
                  </td>
                  <td className="num">
                    <Cost totals={row.totals} />
                  </td>
                  <td className="num">{formatCount(row.totals.calls)}</td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <td>합계</td>
                <td className="num" title={formatCount(tokenTotal)}>
                  {formatTokens(tokenTotal)}
                </td>
                <td />
                <td className="num" title={formatCount(footer.inputTokens)}>
                  {formatTokens(footer.inputTokens)}
                </td>
                <td className="num" title={formatCount(footer.outputTokens)}>
                  {formatTokens(footer.outputTokens)}
                </td>
                <td className="num">
                  <Cost totals={footer} />
                </td>
                <td className="num">{formatCount(footer.calls)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}

/** 막대는 보조 표시이고 뜻은 숫자가 진다. 색과 길이만으로 값을 말하지 않는다(DESIGN.md). */
function ShareBar({ value }: { value: number | null }) {
  return (
    <span className="rate">
      <span className="rate__track" aria-hidden="true">
        <span className="rate__fill" style={{ width: `${(value ?? 0) * 100}%` }} />
      </span>
      <span className="mono">{formatRate(value)}</span>
    </span>
  )
}

/**
 * 금액과, 그것이 몇 건 위에 얹힌 값인지.
 *
 * 단가 미상이 섞이면 `+` 를 붙인다 — 하한이라는 뜻이고, `title`에 몇 건인지 적는다. 이 표시가
 * 없으면 절반이 미상인 합계가 전체 지출로 읽힌다.
 */
function Cost({ totals }: { totals: UsageTotals }) {
  const text = formatCost(totals.costUsd)
  if (totals.costUsd === null || !isPartiallyPriced(totals)) return <>{text}</>

  return (
    <span
      title={`단가를 아는 ${totals.pricedCalls}건의 합. 나머지 ${
        totals.calls - totals.pricedCalls
      }건은 provider가 단가를 주지 않아 빠졌다.`}
    >
      {text}
      <span className="usage-partial">+</span>
    </span>
  )
}
