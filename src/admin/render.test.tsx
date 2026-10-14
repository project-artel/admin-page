import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { invalidationMessage, replaceLlmModel, type AdminLlmModel, type BedrockSettings } from './adminApi'
import { BedrockCheckResult, BedrockFacts } from './BedrockKeySection'
import { ModelRow } from './LlmModelsSection'
import { TemporaryPasswordNotice } from './TemporaryPasswordNotice'

describe('TemporaryPasswordNotice', () => {
  it('shows the password with a copy button and the not-shown-again warning', () => {
    const html = renderToStaticMarkup(
      <TemporaryPasswordNotice heading="a@b.co" password="Abc123xyz" onDismiss={() => undefined} />,
    )
    expect(html).toContain('Abc123xyz')
    expect(html).toContain('다시 표시되지 않습니다')
    expect(html).toContain('복사')
  })
})

describe('ModelRow', () => {
  const model: AdminLlmModel = {
    id: 'bedrock/us.openai.gpt-6.1-sol',
    label: 'GPT-6.1 Sol (AWS Bedrock)',
    provider: 'openai',
    route: 'bedrock',
    enabled: false,
    supportsVision: true,
    maxInputTokens: 922000,
    updatedAt: null,
  }

  it('shows the route badge, limits and an unchecked switch', () => {
    const html = renderToStaticMarkup(<ModelRow model={model} pending={false} onToggle={() => undefined} />)
    expect(html).toContain('AWS Bedrock')
    expect(html).toContain('922,000')
    expect(html).toContain('role="switch"')
    expect(html).not.toContain('checked')
    expect(html).not.toContain('disabled')
  })

  it('disables the switch while a change is in flight', () => {
    const html = renderToStaticMarkup(<ModelRow model={model} pending onToggle={() => undefined} />)
    expect(html).toContain('disabled')
  })

  it('reports the new state when the switch changes', () => {
    const onToggle = vi.fn()
    const tree = ModelRow({ model, pending: false, onToggle }) as ReactElement<{ children: ReactElement[] }>
    const label = tree.props.children[2] as ReactElement<{ children: ReactElement<{ onChange: (e: unknown) => void }>[] }>
    label.props.children[0].props.onChange({ target: { checked: true } })
    expect(onToggle).toHaveBeenCalledWith(true)
  })
})

describe('replaceLlmModel', () => {
  it('replaces only the row with the same id', () => {
    const rows: AdminLlmModel[] = ['a', 'b'].map((id) => ({
      id,
      label: id,
      provider: 'x',
      route: 'openrouter',
      enabled: false,
      supportsVision: false,
      maxInputTokens: null,
      updatedAt: null,
    }))
    const next = replaceLlmModel(rows, { ...rows[0], enabled: true })
    expect(next.map((row) => row.enabled)).toEqual([true, false])
    expect(rows[0].enabled).toBe(false)
  })
})

describe('Bedrock key section parts', () => {
  const settings: BedrockSettings = {
    configured: true,
    maskedKey: '…abcd',
    updatedAt: null,
    region: 'us-west-2',
    lastCheck: null,
  }

  it('shows the masked key and the region', () => {
    const html = renderToStaticMarkup(<BedrockFacts settings={settings} />)
    expect(html).toContain('…abcd')
    expect(html).toContain('us-west-2')
  })

  it('shows 없음 when no key is stored', () => {
    const html = renderToStaticMarkup(<BedrockFacts settings={{ ...settings, configured: false, maskedKey: null }} />)
    expect(html).toContain('없음')
  })

  it('lists reachable models and the error text of the others', () => {
    const html = renderToStaticMarkup(
      <BedrockCheckResult
        check={{
          checkedAt: null,
          keyConfigured: true,
          models: [
            { id: 'bedrock/a', reachable: true, error: null },
            { id: 'bedrock/b', reachable: false, error: 'not available for this account' },
          ],
        }}
      />,
    )
    expect(html).toContain('2개 중 1개')
    expect(html).toContain('접근 가능')
    expect(html).toContain('not available for this account')
  })

  it('says so when no key is stored for the check', () => {
    const html = renderToStaticMarkup(<BedrockCheckResult check={{ checkedAt: null, keyConfigured: false, models: [] }} />)
    expect(html).toContain('키를 먼저 설정')
    expect(html).not.toContain('<table')
  })
})

describe('invalidationMessage', () => {
  it('reports success and the failure reason', () => {
    expect(invalidationMessage({ agentServerInvalidated: true, error: null })).toBe('agent-server가 캐시를 비웠습니다.')
    expect(invalidationMessage({ agentServerInvalidated: false, error: 'timeout' })).toContain('timeout')
  })
})
