import { formatCount, formatRate } from '../qaStats/format'
import { citationCoverage, citationRate, repudiationRate } from './pivot'
import type { KnowledgeStatsTotals } from './knowledgeStatsTypes'

/**
 * 기간 전체 합계.
 *
 * qaStats와 같은 한 줄 레일이다 — DESIGN.md가 반복되는 둥근 카드와 일반적인 KPI 타일을 금지하고,
 * 이 숫자들은 서로 비교되는 값이 아니라 아래 표 전체의 스코프를 알려 주는 머리말이다.
 */
export function KnowledgeTotalsRail({ total }: { total: KnowledgeStatsTotals }) {
  const cited = citationRate(total)
  const coverage = citationCoverage(total)
  const repudiated = repudiationRate(total)

  return (
    <div className="rail">
      <div className="rail__item">
        <span className="rail__label">만든 버전</span>
        <span className="rail__value">{formatCount(total.entryVersions)}</span>
        {/* 항목 수가 아니다. 한 항목을 두 번 고치면 세 버전이다. */}
        <span className="rail__hint">항목이 아니라 content 버전</span>
      </div>

      <div className="rail__item">
        <span className="rail__label">최신으로 남음</span>
        <span className="rail__value">{formatCount(total.currentVersions)}</span>
        <span className="rail__hint">삭제 {formatCount(total.deletedVersions)}</span>
      </div>

      <div className="rail__item">
        <span className="rail__label">후속 런이 지움</span>
        <span className="rail__value">
          {repudiated === null ? '—' : formatRate(repudiated)}
        </span>
        {/* 이 화면에서 제일 오해받기 쉬운 숫자. 수리와 폐기가 아직 안 갈린다. */}
        <span className="rail__hint">
          {formatCount(total.repudiatedVersions)}건 · 수리와 폐기가 섞임
        </span>
      </div>

      <div className="rail__item">
        <span className="rail__label">검색 노출</span>
        <span className="rail__value">{formatCount(total.retrievalTotal)}</span>
        <span className="rail__hint">이 버전들이 컨텍스트에 들어간 횟수</span>
      </div>

      <div className="rail__item">
        <span className="rail__label">인용률</span>
        <span className="rail__value">{cited === null ? '—' : formatRate(cited)}</span>
        {/* 커버리지 없이는 인용률을 읽을 수 없다. 5% 커버리지의 100%는 스무 번 중 한 번이다. */}
        <span className="rail__hint">
          {coverage === null
            ? '검색 기록 없음'
            : cited === null
              ? '인용 판정이 가능한 검색 없음'
              : `판정 가능 ${formatRate(coverage)} (${formatCount(total.citationKnownTotal)}건)`}
        </span>
      </div>
    </div>
  )
}
