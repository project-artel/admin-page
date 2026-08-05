/** 비교 축. `GET /api/qa-stats`의 셀이 이 넷으로 런을 분할한다. */
export const AXES = ['model', 'reasoningEffort', 'promptVersion', 'agentArch'] as const

export type Axis = (typeof AXES)[number]

export const AXIS_LABELS: Record<Axis, string> = {
  model: '모델',
  reasoningEffort: 'Reasoning',
  promptVersion: '프롬프트',
  agentArch: '에이전트 구조',
}

/**
 * 축 조합 하나의 집계.
 *
 * 축 값이 null이면 "미상"이다 — ARTEL-239 이전에 끝난 런과, 세션 응답에 `run_config`를 싣지 않는
 * 구버전 Agent가 여기 들어온다. 화면에서 버리면 축별 합이 총계와 어긋난다.
 */
export interface QaStatsCell {
  model: string | null
  reasoningEffort: string | null
  promptVersion: string | null
  agentArch: string | null
  runs: number
  /** 끝까지 돈 런. QA 통과가 아니다 — `qa_try.status`는 런 생명주기다. */
  completed: number
  failed: number
  /** 운영자가 멈춘 런. 실패와 섞지 않는다. */
  cancelled: number
  /** 아직 도는 런. 완주율 분모에서 빠진다. */
  active: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  /** null은 "공짜"가 아니라 "단가 미상"이다. */
  costUsd: number | null
  llmCalls: number
  avgCompletedDurationMs: number | null
}

/** 축이 없는 전체 합계. 자르기 전 전체에서 나오므로 셀의 합보다 클 수 있다. */
export type QaStatsTotals = Omit<
  QaStatsCell,
  'model' | 'reasoningEffort' | 'promptVersion' | 'agentArch'
>

export interface QaStats {
  projectId: string
  from: string
  to: string
  total: QaStatsTotals
  cells: QaStatsCell[]
  /** 조합 수가 상한을 넘어 `cells`가 잘렸는지. 서면 표의 합이 총계보다 작다. */
  truncated: boolean
  cellLimit: number
}

export const QA_TRY_STATUSES = [
  'STARTING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const

export type QaTryStatus = (typeof QA_TRY_STATUSES)[number]

/** 최근 런 한 줄. 축 값이 어디서 왔는지 되짚는 경로다. */
export interface QaTrySummary {
  id: string
  status: QaTryStatus
  startedAt: string
  completedAt: string | null
  model: string | null
  reasoningEffort: string | null
  promptVersion: string | null
  agentArch: string | null
  agentFingerprint: string | null
}
