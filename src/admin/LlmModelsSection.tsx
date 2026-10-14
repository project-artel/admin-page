import { useEffect, useState } from 'react'
import { listLlmModels, replaceLlmModel, setLlmModelEnabled, type AdminLlmModel } from './adminApi'
import { useAdminFailure } from './useAdminRequest'

const ROUTE_LABEL = { openrouter: 'OpenRouter', bedrock: 'AWS Bedrock', claude: 'Claude API' } as const

export function ModelRow({
  model,
  pending,
  onToggle,
}: {
  model: AdminLlmModel
  pending: boolean
  onToggle: (enabled: boolean) => void
}) {
  const meta = [
    model.provider,
    model.supportsVision ? '이미지 입력' : null,
    model.maxInputTokens !== null ? `최대 입력 ${model.maxInputTokens.toLocaleString('en-US')} 토큰` : null,
  ].filter((part): part is string => part !== null && part !== '')
  return (
    <li className="adm-model">
      <div className="adm-model__name">
        <div className="adm-model__label">{model.label}</div>
        <div className="adm-model__meta mono">{model.id}</div>
        <div className="adm-model__meta">{meta.join(' · ')}</div>
      </div>
      <span className="adm-badge">{ROUTE_LABEL[model.route]}</span>
      <label className="adm-switch">
        <input
          type="checkbox"
          role="switch"
          checked={model.enabled}
          disabled={pending}
          aria-label={`${model.label} 사용`}
          onChange={(event) => onToggle(event.target.checked)}
        />
        {model.enabled ? '켜짐' : '꺼짐'}
      </label>
    </li>
  )
}

/** The model catalog with one switch per row. Only `enabled` can be changed here. */
export function LlmModelsSection({ onSessionLost }: { onSessionLost: () => void }) {
  const [models, setModels] = useState<AdminLlmModel[] | null>(null)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const { error, setError, fail } = useAdminFailure(onSessionLost)

  useEffect(() => {
    const controller = new AbortController()
    listLlmModels(controller.signal)
      .then(setModels)
      .catch((cause) => {
        if (!controller.signal.aborted) fail(cause)
      })
    return () => controller.abort()
  }, [fail])

  async function change(id: string, enabled: boolean) {
    if (models === null || pendingIds.has(id)) return
    setPendingIds((current) => new Set(current).add(id))
    setError(null)
    try {
      const updated = await setLlmModelEnabled(id, enabled)
      // Only this row changes, so a switch flipped meanwhile on another row is kept.
      setModels((current) => (current === null ? current : replaceLlmModel(current, updated)))
    } catch (cause) {
      fail(cause)
    } finally {
      setPendingIds((current) => {
        const rest = new Set(current)
        rest.delete(id)
        return rest
      })
    }
  }

  return (
    <section aria-labelledby="adm-models-title">
      <div className="section__head">
        <h2 className="section__title" id="adm-models-title">
          모델
        </h2>
        <span className="section__note">
          꺼진 모델은 모델 선택 목록에서 숨겨지고, 새 실행에서는 거절됩니다.
        </span>
      </div>
      {error !== null && (
        <p className="notice notice--critical" role="alert">
          {error}
        </p>
      )}
      {models === null ? (
        <p className="notice">{error === null ? '모델을 불러오는 중입니다…' : '모델을 불러오지 못했습니다.'}</p>
      ) : (
        <ul className="adm-models">
          {models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              pending={pendingIds.has(model.id)}
              onToggle={(enabled) => void change(model.id, enabled)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
