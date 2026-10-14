import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  checkClaudeModels,
  getClaudeSettings,
  putClaudeKey,
  type ClaudeCheck,
  type ClaudeSettings,
} from './adminApi'
import { ConfirmButton } from './ConfirmButton'
import { useAdminFailure } from './useAdminRequest'

export function ClaudeFacts({ settings }: { settings: ClaudeSettings }) {
  return (
    <dl className="adm-facts">
      <div>
        <dt>현재 키</dt>
        <dd className="mono">{settings.configured ? (settings.maskedKey ?? '저장됨') : '없음'}</dd>
      </div>
      {settings.updatedAt !== null && (
        <div>
          <dt>저장 시각</dt>
          <dd>{new Date(settings.updatedAt).toLocaleString('ko-KR')}</dd>
        </div>
      )}
    </dl>
  )
}

export function ClaudeCheckResult({ check }: { check: ClaudeCheck }) {
  const reachableCount = check.models.filter((model) => model.reachable).length
  return (
    <div className="adm-check">
      {check.keyConfigured && !check.keyValid && (
        <p className="notice notice--critical" role="alert">
          키가 거절되었습니다. Claude API가 이 키를 받아들이지 않았으니 키를 다시 확인해 저장하세요.
        </p>
      )}
      <p className="section__note section__note--block">
        {!check.keyConfigured
          ? '저장된 키가 없어 확인하지 못했습니다. 키를 먼저 설정하세요.'
          : !check.keyValid
            ? '모델은 확인하지 못했습니다.'
            : check.models.length === 0
              ? '켜진 Claude 모델이 없어 확인할 대상이 없습니다. 모델 목록에서 claude/ 모델을 켠 뒤 다시 확인하세요.'
              : `켜진 모델 ${check.models.length}개 중 ${reachableCount}개에 접근할 수 있습니다.`}
        {check.checkedAt !== null && ` (확인 시각 ${new Date(check.checkedAt).toLocaleString('ko-KR')})`}
      </p>
      {check.keyConfigured && check.keyValid && check.models.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <caption className="adm-visually-hidden">Claude 모델별 접근 결과</caption>
            <thead>
              <tr>
                <th scope="col">모델</th>
                <th scope="col">접근</th>
              </tr>
            </thead>
            <tbody>
              {check.models.map((model) => (
                <tr key={model.id}>
                  <td className="mono">{model.id}</td>
                  <td>
                    <span className="status">
                      <span
                        className={`status__dot ${model.reachable ? 'status__dot--completed' : 'status__dot--failed'}`}
                        aria-hidden="true"
                      />
                      {model.reachable ? '접근 가능' : (model.error ?? '접근 불가')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Claude API key: same save, delete and check states as the Bedrock section. */
export function ClaudeApiKeySection({ onSessionLost }: { onSessionLost: () => void }) {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<ClaudeCheck | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const { error, setError, fail } = useAdminFailure(onSessionLost)
  const keyFieldId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getClaudeSettings(controller.signal)
      .then((loaded) => {
        setSettings(loaded)
        setCheck(loaded.lastCheck)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) fail(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [fail])

  async function save(apiKey: string | null) {
    setSaving(true)
    setError(null)
    try {
      const saved = await putClaudeKey(apiKey)
      setSettings(saved)
      setCheck(saved.lastCheck)
      setAnnouncement(apiKey === null ? '저장된 Claude API 키를 지웠습니다.' : 'Claude API 키를 저장했습니다. 이제 Claude 모델 확인을 눌러 보세요.')
    } catch (cause) {
      fail(cause)
    } finally {
      setSaving(false)
    }
  }

  async function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const apiKey = keyInput.trim()
    if (apiKey === '' || saving) return
    try {
      await save(apiKey)
    } finally {
      // The plain key leaves memory whether or not the save worked.
      setKeyInput('')
    }
  }

  async function runCheck() {
    setChecking(true)
    setError(null)
    try {
      const result = await checkClaudeModels()
      setCheck(result)
      setSettings((current) => (current === null ? current : { ...current, lastCheck: result }))
      setAnnouncement(result.keyValid ? `켜진 Claude 모델 ${result.models.length}개를 확인했습니다.` : 'Claude API가 키를 거절했습니다.')
    } catch (cause) {
      fail(cause)
    } finally {
      setChecking(false)
    }
  }

  const hasKey = settings !== null && settings.configured

  return (
    <section aria-labelledby="adm-claude-title">
      <div className="section__head">
        <h2 className="section__title" id="adm-claude-title">
          Claude API 키
        </h2>
        <span className="section__note">claude/ 모델 호출이 이 키로 Claude API에 요청합니다.</span>
      </div>

      {error !== null && (
        <p className="notice notice--critical" role="alert">
          {error}
        </p>
      )}

      {settings === null ? (
        <p className="notice">{loading ? '설정을 불러오는 중입니다…' : '설정을 불러오지 못했습니다.'}</p>
      ) : (
        <ClaudeFacts settings={settings} />
      )}

      <form className="adm-form" onSubmit={saveKey}>
        <span className="adm-field adm-field--wide">
          <label className="field__label" htmlFor={keyFieldId}>
            새 키
          </label>
          <input
            id={keyFieldId}
            className="control adm-input mono"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            aria-describedby={`${keyFieldId}-hint`}
          />
        </span>
        <button type="submit" className="control control--action" disabled={saving || keyInput.trim() === ''}>
          {saving ? '저장하는 중…' : '키 저장'}
        </button>
        {hasKey && (
          <ConfirmButton
            label="저장한 키 지우기"
            confirmLabel="지우기"
            disabled={saving}
            onConfirm={() => void save(null)}
          />
        )}
      </form>
      <span className="section__note section__note--block" id={`${keyFieldId}-hint`}>
        저장한 키는 다시 표시되지 않고 끝부분만 가려서 보입니다. 지우면 새 키를 입력할 때까지 키가 없는
        상태가 됩니다. claude/ 모델은 처음에 모두 꺼져 있으니, 키를 저장하고 확인이 통과한 뒤 모델 목록에서
        켜세요.
      </span>

      <div className="adm-actions">
        <button
          type="button"
          className="control control--action"
          disabled={checking || !hasKey}
          onClick={() => void runCheck()}
        >
          {checking ? '확인하는 중…' : 'Claude 모델 확인'}
        </button>
        {!hasKey && settings !== null && <span className="section__note">키를 먼저 설정하세요.</span>}
      </div>
      {check !== null && <ClaudeCheckResult check={check} />}

      <p className="adm-visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}
