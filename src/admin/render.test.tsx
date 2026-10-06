import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
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
