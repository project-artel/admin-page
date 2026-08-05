import { EMPTY_MARK, formatTimestamp } from './format'
import type { QaTryStatus, QaTrySummary } from './qaStatsTypes'

const STATUS_LABELS: Record<QaTryStatus, string> = {
  STARTING: '시작 중',
  RUNNING: '실행 중',
  COMPLETED: '완주',
  FAILED: '실패',
  CANCELLED: '취소',
}

const STATUS_TONES: Record<QaTryStatus, string> = {
  STARTING: 'active',
  RUNNING: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

/** 점은 보조 표시이고 뜻은 글자가 진다. 색만으로 상태를 말하지 않는다(DESIGN.md). */
function Status({ status }: { status: QaTryStatus }) {
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
 * 최근 런. 집계에서 개별 런으로 돌아가는 길이다 — 어떤 조합이 나쁘게 나왔을 때 그 조합으로 돈
 * 런을 실제로 열어 봐야 이유가 나온다.
 */
export function RecentRuns({ runs }: { runs: QaTrySummary[] }) {
  return (
    <section aria-labelledby="recent-title">
      <div className="section__head">
        <h2 className="section__title" id="recent-title">
          최근 런
        </h2>
        <span className="section__note">최신순 · 실행 설정은 Agent가 확정한 값</span>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">시작</th>
              <th scope="col">상태</th>
              <th scope="col">모델</th>
              <th scope="col">Reasoning</th>
              <th scope="col">프롬프트</th>
              <th scope="col">구조</th>
              {/* 라벨 bump를 잊은 변경을 갈라내는 값이라 라벨과 나란히 둔다. */}
              <th scope="col">지문</th>
              <th scope="col" className="num">
                런 ID
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
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
                <td>
                  <Value value={run.promptVersion} />
                </td>
                <td>
                  <Value value={run.agentArch} />
                </td>
                <td>
                  <Value value={run.agentFingerprint} />
                </td>
                <td className="num mono">{run.id}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  이 프로젝트에 기록된 런이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
