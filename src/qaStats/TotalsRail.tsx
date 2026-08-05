import { CompletionRate } from './CompletionRate'
import { formatCost, formatCount, formatDuration, formatTokens } from './format'
import type { QaStatsTotals } from './qaStatsTypes'

/**
 * 기간 전체 합계.
 *
 * 카드 격자가 아니라 한 줄 레일이다 — DESIGN.md가 반복되는 둥근 카드와 일반적인 KPI 타일을
 * 금지하고, 이 숫자들은 서로 비교되는 값이 아니라 아래 표 전체의 스코프를 알려 주는 머리말이다.
 */
export function TotalsRail({ total }: { total: QaStatsTotals }) {
  const tokens = total.inputTokens + total.outputTokens

  return (
    <div className="rail">
      <div className="rail__item">
        <span className="rail__label">전체 런</span>
        <span className="rail__value">{formatCount(total.runs)}</span>
        <span className="rail__hint">
          진행 중 {formatCount(total.active)} · 취소 {formatCount(total.cancelled)}
        </span>
      </div>
      <div className="rail__item">
        <span className="rail__label">완주율</span>
        <span className="rail__value">
          <CompletionRate row={total} />
        </span>
        {/* 통과율이 아니다. qa_try.status는 런 생명주기이지 QA 판정이 아니다. */}
        <span className="rail__hint">
          완주 {formatCount(total.completed)} · 실패 {formatCount(total.failed)}
        </span>
      </div>
      <div className="rail__item">
        <span className="rail__label">LLM 토큰</span>
        <span className="rail__value" title={formatCount(tokens)}>
          {formatTokens(tokens)}
        </span>
        <span className="rail__hint">
          입력 {formatTokens(total.inputTokens)} · 출력 {formatTokens(total.outputTokens)}
        </span>
      </div>
      <div className="rail__item">
        <span className="rail__label">LLM 비용</span>
        <span className="rail__value">{formatCost(total.costUsd)}</span>
        <span className="rail__hint">
          {total.costUsd === null
            ? '단가를 아는 호출 없음'
            : `호출 ${formatCount(total.llmCalls)}건`}
        </span>
      </div>
      <div className="rail__item">
        <span className="rail__label">평균 완주 소요</span>
        <span className="rail__value">{formatDuration(total.avgCompletedDurationMs)}</span>
        {/* 실패·취소를 섞으면 즉시 실패가 "빨라졌다"로 읽힌다. */}
        <span className="rail__hint">완주한 런만</span>
      </div>
    </div>
  )
}
