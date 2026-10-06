import { useState } from 'react'

/**
 * Shows a temporary password once. The server never returns it again, so the
 * notice stays until the administrator confirms they stored it; closing it by
 * accident would leave the account with a password nobody knows.
 *
 * The state color is paired with a text label and a mark, never color alone
 * (DESIGN.md).
 */
export function TemporaryPasswordNotice({
  heading,
  password,
  onDismiss,
}: {
  /** Names whose password this is, for example the account email. */
  heading: string
  password: string
  onDismiss: () => void
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopyState('copied')
    } catch {
      // Clipboard access needs a secure context; the password stays selectable below.
      setCopyState('failed')
    }
  }

  return (
    <section className="adm-secret" role="alert" aria-labelledby="adm-secret-title">
      <h3 className="adm-secret__title" id="adm-secret-title">
        <span aria-hidden="true">! </span>
        임시 비밀번호 · {heading}
      </h3>
      <p className="adm-secret__warning">
        이 비밀번호는 다시 표시되지 않습니다. 지금 복사해서 해당 사용자에게 전달하세요. 사용자는 처음
        로그인할 때 비밀번호를 바꿔야 합니다.
      </p>
      <div className="adm-secret__row">
        <code className="adm-secret__value" aria-label="임시 비밀번호">
          {password}
        </code>
        <button type="button" className="control control--action" onClick={copy}>
          복사
        </button>
        <button type="button" className="control" onClick={onDismiss}>
          전달했습니다
        </button>
      </div>
      <p className="adm-secret__status" aria-live="polite">
        {copyState === 'copied' && '클립보드에 복사했습니다.'}
        {copyState === 'failed' && '복사하지 못했습니다. 위 값을 직접 선택해서 복사하세요.'}
      </p>
    </section>
  )
}
