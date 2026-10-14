import { useState } from 'react'
import { invalidateLlmCache, invalidationMessage, type CacheInvalidation } from './adminApi'
import { useAdminFailure } from './useAdminRequest'

/**
 * Drops the keys and catalog that agent-server cached. Saving a key or toggling
 * a model already does this; the button is for when that automatic call failed.
 */
export function CacheInvalidationSection({ onSessionLost }: { onSessionLost: () => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CacheInvalidation | null>(null)
  const { error, setError, fail } = useAdminFailure(onSessionLost)

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await invalidateLlmCache())
    } catch (cause) {
      fail(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="adm-cache-title">
      <div className="section__head">
        <h2 className="section__title" id="adm-cache-title">
          캐시된 키
        </h2>
        <span className="section__note">
          키를 저장하거나 모델을 켜고 끌 때 agent-server 캐시는 자동으로 비워집니다. 그 자동 호출이
          실패했을 때만 아래 버튼을 누르세요.
        </span>
      </div>
      <div className="adm-actions">
        <button type="button" className="control" disabled={busy} onClick={() => void run()}>
          {busy ? '비우는 중…' : '캐시된 키 비우기'}
        </button>
      </div>
      {error !== null && (
        <p className="notice notice--critical" role="alert">
          {error}
        </p>
      )}
      {result !== null && (
        <p
          className={`notice${result.agentServerInvalidated ? '' : ' notice--critical'}`}
          role={result.agentServerInvalidated ? 'status' : 'alert'}
        >
          {invalidationMessage(result)}
        </p>
      )}
    </section>
  )
}
