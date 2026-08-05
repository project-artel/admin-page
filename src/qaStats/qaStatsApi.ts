import {
  apiFetch,
  asNullableNumber,
  asNullableString,
  asNumber,
  asRecord,
  asString,
  readJson,
} from '../api/orchestration'
import {
  QA_TRY_STATUSES,
  type QaStats,
  type QaStatsCell,
  type QaStatsTotals,
  type QaTryStatus,
  type QaTrySummary,
} from './qaStatsTypes'

export interface QaStatsQuery {
  projectId: string
  from: Date
  to: Date
}

/**
 * 4축 조합 셀과 전체 합계를 한 번에 받는다.
 *
 * 축을 서버에 되묻지 않는 이유는 런이 4-튜플로 분할되기 때문이다 — 단일 축 분해도 두 축
 * 매트릭스도 이 셀의 부분합이라, 사용자가 축을 바꿔도 왕복이 생기지 않는다.
 */
export async function fetchQaStats(
  { projectId, from, to }: QaStatsQuery,
  signal?: AbortSignal,
): Promise<QaStats> {
  const params = new URLSearchParams({
    projectId,
    from: from.toISOString(),
    to: to.toISOString(),
  })
  const response = await apiFetch(`/api/qa-stats?${params}`, { signal })
  const body = asRecord(await readJson(response))

  return {
    projectId: asString(body.projectId, 'projectId'),
    from: asString(body.from, 'from'),
    to: asString(body.to, 'to'),
    total: parseTotals(asRecord(body.total)),
    cells: (Array.isArray(body.cells) ? body.cells : []).map((cell) =>
      parseCell(asRecord(cell)),
    ),
    truncated: body.truncated === true,
    cellLimit: asNumber(body.cellLimit, 0),
  }
}

function parseTotals(raw: Record<string, unknown>): QaStatsTotals {
  return {
    runs: asNumber(raw.runs, 0),
    completed: asNumber(raw.completed, 0),
    failed: asNumber(raw.failed, 0),
    cancelled: asNumber(raw.cancelled, 0),
    active: asNumber(raw.active, 0),
    inputTokens: asNumber(raw.inputTokens, 0),
    outputTokens: asNumber(raw.outputTokens, 0),
    cachedInputTokens: asNumber(raw.cachedInputTokens, 0),
    reasoningTokens: asNumber(raw.reasoningTokens, 0),
    // 0으로 떨어뜨리지 않는다. "단가 미상"이 "공짜"로 읽히면 비용 비교가 조용히 틀린다.
    costUsd: asNullableNumber(raw.costUsd),
    llmCalls: asNumber(raw.llmCalls, 0),
    avgCompletedDurationMs: asNullableNumber(raw.avgCompletedDurationMs),
  }
}

function parseCell(raw: Record<string, unknown>): QaStatsCell {
  return {
    model: asNullableString(raw.model),
    reasoningEffort: asNullableString(raw.reasoningEffort),
    promptVersion: asNullableString(raw.promptVersion),
    agentArch: asNullableString(raw.agentArch),
    ...parseTotals(raw),
  }
}

/**
 * 최근 런. 집계가 아니라 개별 런으로 돌아가는 길이다.
 *
 * `reasoningEffort`는 `QaTryResponse`에 없어 `runConfig` 스냅샷에서 읽는다. 승격 컬럼이지만
 * 응답 필드로는 노출되지 않았다.
 */
export async function fetchRecentQaTries(
  projectId: string,
  size: number,
  signal?: AbortSignal,
): Promise<QaTrySummary[]> {
  const params = new URLSearchParams({ projectId, size: String(size) })
  const response = await apiFetch(`/api/qa-tries?${params}`, { signal })
  const body = await readJson(response)
  const items = Array.isArray(body) ? body : []

  return items.map((item) => {
    const run = asRecord(item)
    const runConfig =
      typeof run.runConfig === 'object' && run.runConfig !== null
        ? (run.runConfig as Record<string, unknown>)
        : {}
    const reasoning =
      typeof runConfig.reasoning === 'object' && runConfig.reasoning !== null
        ? (runConfig.reasoning as Record<string, unknown>)
        : {}

    return {
      id: asString(run.id, 'qaTry.id'),
      status: parseStatus(run.status),
      startedAt: asString(run.startedAt, 'qaTry.startedAt'),
      completedAt: asNullableString(run.completedAt),
      model: asNullableString(run.model),
      reasoningEffort: asNullableString(reasoning.effort),
      promptVersion: asNullableString(run.promptVersion),
      agentArch: asNullableString(run.agentArch),
      agentFingerprint: asNullableString(run.agentFingerprint),
    }
  })
}

/** 모르는 상태값은 목록 전체를 깨뜨리지 않고 `STARTING`으로 낮춘다. */
function parseStatus(value: unknown): QaTryStatus {
  return QA_TRY_STATUSES.find((status) => status === value) ?? 'STARTING'
}
