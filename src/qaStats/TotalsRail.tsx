import { CompletionRate } from './CompletionRate'
import { ScoreRate } from './ScoreRate'
import { formatCost, formatCount, formatDuration, formatRate, formatTokens } from './format'
import { scoreCoverage, stepPassRate, verdictCoverage } from './pivot'
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
        <span className="rail__label">스텝 합격률</span>
        <span className="rail__value">
          <ScoreRate
            rate={stepPassRate(total)}
            detail={`통과 ${total.stepsPassed} / 스텝 ${total.stepsTotal}`}
          />
        </span>
        {/* 이 비율의 분모를 같은 칸에 둔다. 판정을 못 받은 런이 빠진 값이라, 커버리지 없이는
            "깔끔하게 끝난 런"에만 조건부라는 사실이 화면에서 사라진다. */}
        <span className="rail__hint">
          판정 커버리지 {formatRate(verdictCoverage(total))} · 런 {formatCount(total.verdictKnown)}/
          {formatCount(total.runs)}
        </span>
      </div>
      <div className="rail__item">
        <span className="rail__label">미탐 / 오탐</span>
        {/* 두 방향을 한 숫자로 접지 않는다. 미탐(실패해야 할 것을 통과라 함)이 훨씬 나쁘고,
            스칼라 하나로 접으면 두 종류의 나쁜 설정이 같은 점수로 보인다. */}
        <span className="rail__value" title={`미탐 ${total.miss}건 · 오탐 ${total.falseAlarm}건`}>
          {formatCount(total.miss)} / {formatCount(total.falseAlarm)}
        </span>
        <span className="rail__hint">
          {total.scoredRuns === 0
            ? '기대 라벨로 채점된 런 없음'
            : `채점 커버리지 ${formatRate(scoreCoverage(total))} · 미보고 ${formatCount(total.unreported)}`}
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
