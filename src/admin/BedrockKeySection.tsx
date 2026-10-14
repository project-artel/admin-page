import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  checkBedrockModels,
  getBedrockSettings,
  putBedrockKey,
  type BedrockCheck,
  type BedrockSettings,
} from './adminApi'
import { ConfirmButton } from './ConfirmButton'
import { useAdminFailure } from './useAdminRequest'

export function BedrockFacts({ settings }: { settings: BedrockSettings }) {
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
      <div>
        <dt>리전</dt>
        <dd className="mono">{settings.region ?? '알 수 없음'}</dd>
      </div>
    </dl>
  )
}

export function BedrockCheckResult({ check }: { check: BedrockCheck }) {
  const reachableCount = check.models.filter((model) => model.reachable).length
  return (
    <div className="adm-check">
      <p className="section__note section__note--block">
        {!check.keyConfigured
          ? '저장된 키가 없어 확인하지 못했습니다. 키를 먼저 설정하세요.'
          : check.models.length === 0
            ? '켜진 Bedrock 모델이 없어 확인할 대상이 없습니다.'
            : `켜진 모델 ${check.models.length}개 중 ${reachableCount}개에 접근할 수 있습니다.`}
        {check.checkedAt !== null && ` (확인 시각 ${new Date(check.checkedAt).toLocaleString('ko-KR')})`}
      </p>
      {check.models.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <caption className="adm-visually-hidden">Bedrock 모델별 접근 결과</caption>
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

/** AWS Bedrock key: same save, delete and check states as the OpenRouter section. */
export function BedrockKeySection({ onSessionLost }: { onSessionLost: () => void }) {
  const [settings, setSettings] = useState<BedrockSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<BedrockCheck | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const { error, setError, fail } = useAdminFailure(onSessionLost)
  const keyFieldId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getBedrockSettings(controller.signal)
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
      const saved = await putBedrockKey(apiKey)
      setSettings(saved)
      setCheck(saved.lastCheck)
      setAnnouncement(apiKey === null ? '저장된 Bedrock 키를 지웠습니다.' : 'Bedrock 키를 저장했습니다. 이제 모델 확인을 눌러 보세요.')
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
      const result = await checkBedrockModels()
      setCheck(result)
      setSettings((current) => (current === null ? current : { ...current, lastCheck: result }))
      setAnnouncement(`켜진 Bedrock 모델 ${result.models.length}개를 확인했습니다.`)
    } catch (cause) {
      fail(cause)
    } finally {
      setChecking(false)
    }
  }

  const hasKey = settings !== null && settings.configured

  return (
    <section aria-labelledby="adm-bedrock-title">
      <div className="section__head">
        <h2 className="section__title" id="adm-bedrock-title">
          AWS Bedrock 키
        </h2>
        <span className="section__note">Bedrock 경로로 가는 모델 호출이 이 키를 씁니다.</span>
      </div>

      {error !== null && (
        <p className="notice notice--critical" role="alert">
          {error}
        </p>
      )}

      {settings === null ? (
        <p className="notice">{loading ? '설정을 불러오는 중입니다…' : '설정을 불러오지 못했습니다.'}</p>
      ) : (
        <BedrockFacts settings={settings} />
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
        상태가 됩니다. 리전은 서버 설정이라 이 페이지에서 바꿀 수 없습니다.
      </span>

      <div className="adm-actions">
        <button
          type="button"
          className="control control--action"
          disabled={checking || !hasKey}
          onClick={() => void runCheck()}
        >
          {checking ? '확인하는 중…' : 'Bedrock 모델 확인'}
        </button>
        {!hasKey && settings !== null && <span className="section__note">키를 먼저 설정하세요.</span>}
      </div>
      {check !== null && <BedrockCheckResult check={check} />}

      <p className="adm-visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}
