import { formatCost, formatCount, formatTokens } from '../qaStats/format'
import type { LlmUsageStats } from './llmUsageTypes'
import { isPartiallyPriced, totalTokens } from './usage'

/**
 * 기간 전체 합계.
 *
 * 카드 격자가 아니라 한 줄 레일이다 — DESIGN.md가 반복되는 둥근 카드와 일반적인 KPI 타일을
 * 금지하고, 이 숫자들은 서로 비교되는 값이 아니라 아래 표 전체의 스코프를 알려 주는 머리말이다.
 * QA 화면의 레일과 같은 클래스를 쓴다.
 */
export function TotalsRail({ stats }: { stats: LlmUsageStats }) {
  const total = stats.total
  const tokens = totalTokens(total)
  const partial = isPartiallyPriced(total)

  return (
    <div className="rail">
      <div className="rail__item">
        <span className="rail__label">전체 토큰</span>
        <span className="rail__value" title={formatCount(tokens)}>
          {formatTokens(tokens)}
        </span>
        <span className="rail__hint">
          입력 {formatTokens(total.inputTokens)} · 출력 {formatTokens(total.outputTokens)}
        </span>
      </div>

      <div className="rail__item">
        <span className="rail__label">전체 비용</span>
        <span className="rail__value">{formatCost(total.costUsd)}</span>
        {/* 단가 미상 호출이 섞이면 이 금액은 하한이다. 안 적으면 절반이 미상인 합계가 전체
            지출로 읽힌다. */}
        <span className="rail__hint">
          {total.costUsd === null
            ? '단가를 아는 호출 없음'
            : partial
              ? `단가를 아는 ${formatCount(total.pricedCalls)}/${formatCount(total.calls)}건의 합 · 실제는 이보다 큼`
              : `호출 ${formatCount(total.calls)}건 전부 단가 있음`}
        </span>
      </div>

      <div className="rail__item">
        <span className="rail__label">캐시 입력</span>
        <span className="rail__value" title={formatCount(total.cachedInputTokens)}>
          {formatTokens(total.cachedInputTokens)}
        </span>
        {/* 입력 토큰의 부분집합이라 전체 토큰에 더해지지 않는다. 캐시에서 읽은 몫이 클수록
            같은 토큰 수라도 싸다. */}
        <span className="rail__hint">입력 토큰 중 캐시에서 읽은 몫</span>
      </div>

      <div className="rail__item">
        <span className="rail__label">Reasoning</span>
        <span className="rail__value" title={formatCount(total.reasoningTokens)}>
          {formatTokens(total.reasoningTokens)}
        </span>
        {/* 이쪽은 출력 토큰의 부분집합이다. */}
        <span className="rail__hint">출력 토큰 중 모델이 생각한 몫</span>
      </div>

      <div className="rail__item">
        <span className="rail__label">LLM 호출</span>
        <span className="rail__value">{formatCount(total.calls)}</span>
        <span className="rail__hint">
          {total.calls === 0
            ? '이 기간에 기록된 호출 없음'
            : `호출당 평균 ${formatTokens(Math.round(tokens / total.calls))} 토큰`}
        </span>
      </div>

      <div className="rail__item">
        <span className="rail__label">귀속 불가</span>
        <span className="rail__value">{formatCount(stats.unattributedCalls)}</span>
        {/* 위 어느 합계에도 안 들어간 호출이다. 알리지 않으면 "전체"가 조용히 실제보다 작아진다. */}
        <span className="rail__hint">
          {stats.unattributedCalls === 0
            ? '모든 호출이 프로젝트에 귀속됨'
            : '대상 행이 없어 위 합계에서 빠진 호출'}
        </span>
      </div>
    </div>
  )
}
