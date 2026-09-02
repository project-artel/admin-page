import { EMPTY_MARK, formatCost, formatCount, formatTimestamp, formatTokens } from '../qaStats/format'
import type { QaRunStatus, QaRunUsage } from './llmUsageTypes'
import { isPartiallyPriced, totalTokens } from './usage'

const STATUS_LABELS: Record<QaRunStatus, string> = {
  STARTING: '시작 중',
  RUNNING: '실행 중',
  COMPLETED: '완주',
  FAILED: '실패',
  CANCELLED: '취소',
}

const STATUS_TONES: Record<QaRunStatus, string> = {
  STARTING: 'active',
  RUNNING: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

/** 점은 보조 표시이고 뜻은 글자가 진다. 색만으로 상태를 말하지 않는다(DESIGN.md). */
function Status({ status }: { status: QaRunStatus }) {
  return (
    <span className="status">
      <span className={`status__dot status__dot--${STATUS_TONES[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}

function Value({ value }: { value: string | null }) {
  return value === null ? (
    <span className="muted">{EMPTY_MARK}</span>
  ) : (
    <span className="mono">{value}</span>
  )
}

/**
 * QA 실행 한 건씩의 토큰과 비용.
 *
 * 위의 축별 표와 기간 기준이 다르다 — 여기는 `qa_try.started_at`, 축별 표는 `llm_usage.called_at`
 * 이다. 런에 귀속시키는 목록이라 그 런이 **시작된** 구간에 들어가야 하고, 자정을 넘겨 도는 런의
 * 호출이 다음 날로 새면 런 하나가 두 날에 걸친다. 그래서 이 표의 합은 위 총계와 다를 수 있고,
 * 제목 옆에 그 사실을 적어 둔다.
 *
 * 호출 0건인 런을 지우지 않는다 — 지우면 "아직 배치가 안 왔다"와 "그런 런이 없다"가 같은 화면이
 * 된다. agent는 사용량을 모아 보내고 실패한 배치를 재시도하지 않으므로 0은 유실일 수도 있다.
 */
export function QaRunCosts({ runs }: { runs: QaRunUsage[] }) {
  return (
    <section aria-labelledby="usage-qa-runs">
      <div className="section__head">
        <h2 className="section__title" id="usage-qa-runs">
          QA 실행별 지출
        </h2>
        <span className="section__note">
          최신순 · 기간 기준은 런 시작 시각이라 위 총계와 합이 다를 수 있음
        </span>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">시작</th>
              <th scope="col">상태</th>
              <th scope="col">모델</th>
              <th scope="col">Reasoning</th>
              <th scope="col" className="num">
                토큰
              </th>
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
            {runs.map((run) => {
              const tokens = totalTokens(run.totals)
              return (
                <tr key={run.qaTryId}>
                  <td className="mono">{formatTimestamp(run.startedAt)}</td>
                  <td>
                    <Status status={run.status} />
                  </td>
                  <td>
                    <Value value={run.model} />
                  </td>
                  <td>
                    <Value value={run.reasoningEffort} />
                  </td>
                  <td className="num" title={formatCount(tokens)}>
                    {formatTokens(tokens)}
                  </td>
                  <td className="num" title={formatCount(run.totals.inputTokens)}>
                    {formatTokens(run.totals.inputTokens)}
                  </td>
                  <td className="num" title={formatCount(run.totals.outputTokens)}>
                    {formatTokens(run.totals.outputTokens)}
                  </td>
                  <td className="num">
                    {formatCost(run.totals.costUsd)}
                    {run.totals.costUsd !== null && isPartiallyPriced(run.totals) && (
                      <span
                        className="usage-partial"
                        title={`단가를 아는 ${run.totals.pricedCalls}건의 합. 나머지는 provider가 단가를 주지 않았다.`}
                      >
                        +
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {run.totals.calls === 0 ? (
                      <span
                        className="muted"
                        title="사용량 배치가 아직 안 왔거나 유실됐다. agent는 재시도하지 않는다."
                      >
                        0
                      </span>
                    ) : (
                      formatCount(run.totals.calls)
                    )}
                  </td>
                </tr>
              )
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  이 기간에 시작된 QA 실행이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
