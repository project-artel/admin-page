import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { ThemeToggle } from '../qaStats/QaStatsDashboard'
import {
  checkLlmModels,
  getLlmSettings,
  putLlmKey,
  type LlmCheckError,
  type LlmKeyCheck,
  type LlmKeySource,
  type LlmSettings,
} from './adminApi'
import { ConfirmButton } from './ConfirmButton'
import { useAdminFailure } from './useAdminRequest'
import './admin.css'

const SOURCE_LABEL: Record<LlmKeySource, string> = {
  admin: '이 페이지에서 저장한 값',
  environment: '환경 변수 OPENROUTER_API_KEY',
  none: '설정되지 않음',
}

const CHECK_ERROR_MESSAGE: Record<LlmCheckError, string> = {
  no_key: '설정된 키가 없어 확인하지 못했습니다. 키를 먼저 설정하세요.',
  invalid_key: 'OpenRouter가 이 키를 받아 주지 않았습니다. 키를 다시 확인하세요.',
  upstream_unavailable: 'OpenRouter에 연결하지 못했습니다. 잠시 후 다시 확인하세요.',
}

/**
 * OpenRouter 키 설정. 서버는 저장된 키를 어떤 응답에도 싣지 않고 끝부분만 가린 값을 준다. 이
 * 화면도 입력 칸에 저장된 키를 채우지 않는다 — 칸은 항상 비어 있고, 저장하면 곧바로 비운다.
 */
export function SettingsView({
  onSessionLost,
  nav,
}: {
  onSessionLost: () => void
  nav?: ReactNode
}) {
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<LlmKeyCheck | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const { error, setError, fail } = useAdminFailure(onSessionLost)
  const keyFieldId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getLlmSettings(controller.signal)
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

  async function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const apiKey = keyInput.trim()
    if (apiKey === '' || saving) return
    setSaving(true)
    setError(null)
    try {
      const saved = await putLlmKey(apiKey)
      setSettings(saved)
      setCheck(saved.lastCheck)
      setAnnouncement('키를 저장했습니다. 이제 모델 확인을 눌러 보세요.')
    } catch (cause) {
      fail(cause)
    } finally {
      // The plain key leaves memory whether or not the save worked.
      setKeyInput('')
      setSaving(false)
    }
  }

  async function clearKey() {
    setSaving(true)
    setError(null)
    try {
      const cleared = await putLlmKey(null)
      setSettings(cleared)
      setCheck(cleared.lastCheck)
      setAnnouncement('저장된 키를 지웠습니다.')
    } catch (cause) {
      fail(cause)
    } finally {
      setSaving(false)
    }
  }

  async function runCheck() {
    setChecking(true)
    setError(null)
    try {
      const result = await checkLlmModels()
      setCheck(result)
      setAnnouncement(
        result.error !== null
          ? CHECK_ERROR_MESSAGE[result.error]
          : `모델 ${result.requiredModels.length}개 중 ${result.reachableModels.length}개에 접근할 수 있습니다.`,
      )
      // Keep the page's own picture of the key in step with what the check saw.
      setSettings((current) => (current === null ? current : { ...current, lastCheck: result }))
    } catch (cause) {
      fail(cause)
    } finally {
      setChecking(false)
    }
  }

  const hasKey = settings !== null && settings.configured
  const hasStoredKey = settings !== null && settings.adminKeyStored
  const cannotSave = settings !== null && !settings.secretsKeyConfigured

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · 설정</h1>
        {nav}
        <span className="topbar__spacer" />
        <ThemeToggle />
      </header>

      <main className="main">
        {error !== null && (
          <p className="notice notice--critical" role="alert">
            {error}
          </p>
        )}

        <section aria-labelledby="adm-key-title">
          <div className="section__head">
            <h2 className="section__title" id="adm-key-title">
              OpenRouter 키
            </h2>
            <span className="section__note">모든 모델 호출이 이 키 하나를 씁니다.</span>
          </div>

          {settings === null ? (
            <p className="notice">{loading ? '설정을 불러오는 중입니다…' : '설정을 불러오지 못했습니다.'}</p>
          ) : (
            <>
            {cannotSave && (
              <p className="notice notice--critical" role="alert">
                <strong>! 이 페이지에서는 키를 저장할 수 없습니다.</strong> 서버에 ARTEL_SECRETS_KEY가 없습니다.
                서버 환경 변수 OPENROUTER_API_KEY 또는 ARTEL_SECRETS_KEY를 설정하세요.
              </p>
            )}
            {settings.adminKeyUnreadable && (
              <p className="notice notice--critical" role="alert">
                <strong>! 저장된 키를 복호화할 수 없습니다.</strong> ARTEL_SECRETS_KEY가 바뀌었을 수 있습니다.
                아래에서 키를 다시 저장하세요.
              </p>
            )}
            <dl className="adm-facts">
              <div>
                <dt>현재 키</dt>
                <dd className="mono">{settings.maskedKey ?? '없음'}</dd>
              </div>
              <div>
                <dt>출처</dt>
                <dd>{SOURCE_LABEL[settings.source]}</dd>
              </div>
              {settings.adminKeyUpdatedAt !== null && (
                <div>
                  <dt>저장 시각</dt>
                  <dd>{new Date(settings.adminKeyUpdatedAt).toLocaleString('ko-KR')}</dd>
                </div>
              )}
            </dl>
            </>
          )}

          <form className="adm-form" onSubmit={saveKey}>
            <span className="adm-field adm-field--wide">
              <label className="field__label" htmlFor={keyFieldId}>
                새 키
              </label>
              {/* `new-password` keeps browsers from autofilling or offering to save the key. */}
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
            <button
              type="submit"
              className="control control--action"
              disabled={saving || cannotSave || keyInput.trim() === ''}
            >
              {saving ? '저장하는 중…' : '키 저장'}
            </button>
            {hasStoredKey && (
              <ConfirmButton
                label="저장한 키 지우기"
                confirmLabel="지우기"
                disabled={saving}
                onConfirm={clearKey}
              />
            )}
          </form>
          <span className="section__note section__note--block" id={`${keyFieldId}-hint`}>
            저장한 키는 다시 표시되지 않고 끝부분만 가려서 보입니다. 이 페이지의 값이 환경 변수보다
            먼저 쓰이며, 지우면 환경 변수 값으로 돌아갑니다.
          </span>
        </section>

        <section aria-labelledby="adm-check-title">
          <div className="section__head">
            <h2 className="section__title" id="adm-check-title">
              모델 접근 확인
            </h2>
            <span className="section__note">필요한 모델마다 이 키로 닿는지 OpenRouter에 묻습니다.</span>
          </div>
          <button
            type="button"
            className="control control--action"
            disabled={checking || !hasKey}
            onClick={runCheck}
          >
            {checking ? '확인하는 중…' : '모델 확인'}
          </button>
          {!hasKey && settings !== null && (
            <span className="section__note section__note--block">키를 먼저 설정하세요.</span>
          )}
          {check !== null && <CheckResult check={check} />}
        </section>

        <p className="adm-visually-hidden" aria-live="polite">
          {announcement}
        </p>
      </main>
    </div>
  )
}

function CheckResult({ check }: { check: LlmKeyCheck }) {
  const reachable = new Set(check.reachableModels)
  return (
    <div className="adm-check">
      <p className="section__note section__note--block">
        {check.error !== null
          ? CHECK_ERROR_MESSAGE[check.error]
          : `모델 ${check.requiredModels.length}개 중 ${check.reachableModels.length}개에 접근할 수 있습니다.`}
        {check.checkedAt !== null && ` (확인 시각 ${new Date(check.checkedAt).toLocaleString('ko-KR')})`}
      </p>
      {check.requiredModels.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <caption className="adm-visually-hidden">필요한 모델별 접근 결과</caption>
            <thead>
              <tr>
                <th scope="col">모델</th>
                <th scope="col">접근</th>
              </tr>
            </thead>
            <tbody>
              {check.requiredModels.map((model) => {
                const ok = reachable.has(model)
                return (
                  <tr key={model}>
                    <td className="mono">{model}</td>
                    <td>
                      <span className="status">
                        <span
                          className={`status__dot ${ok ? 'status__dot--completed' : 'status__dot--failed'}`}
                          aria-hidden="true"
                        />
                        {check.error !== null ? '확인 못 함' : ok ? '접근 가능' : '접근 불가'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
