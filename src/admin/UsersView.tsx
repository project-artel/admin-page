import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { ThemeToggle } from '../qaStats/QaStatsDashboard'
import {
  PLATFORM_ROLES,
  createAdminUser,
  listAdminUsers,
  parseRole,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
  type PlatformRole,
} from './adminApi'
import { ConfirmButton } from './ConfirmButton'
import { TemporaryPasswordNotice } from './TemporaryPasswordNotice'
import { useAdminFailure } from './useAdminRequest'
import './admin.css'

const ROLE_LABEL: Record<PlatformRole, string> = {
  USER: '사용자',
  DEVELOPER: '개발자',
  ADMIN: '관리자',
}

interface IssuedPassword {
  heading: string
  password: string
}

/**
 * 사용자 목록과 계정 관리. `ADMIN`만 이 화면에 들어오고, 서버도 같은 조건으로 거절한다 — 화면의
 * 게이트는 보여 주는 것을 고를 뿐 인가가 아니다.
 *
 * 자기 자신의 행은 등급 변경과 비활성화를 막는다. 마지막 관리자가 스스로를 내리면 이 화면에
 * 다시 들어올 방법이 없다.
 */
export function UsersView({
  onSessionLost,
  nav,
  currentUserId,
}: {
  onSessionLost: () => void
  nav?: ReactNode
  currentUserId: string
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [issued, setIssued] = useState<IssuedPassword | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const { error, setError, fail } = useAdminFailure(onSessionLost)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    listAdminUsers(controller.signal)
      .then((list) => {
        setUsers(list)
        setError(null)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) fail(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadToken, fail, setError])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  async function runForUser(userId: string, action: () => Promise<unknown>) {
    setBusyUserId(userId)
    setError(null)
    try {
      await action()
      reload()
    } catch (cause) {
      fail(cause)
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__brand">ARTEL Admin · 사용자</h1>
        {nav}
        <span className="topbar__spacer" />
        <button type="button" className="control control--action" disabled={loading} onClick={reload}>
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
        <ThemeToggle />
      </header>

      <main className="main">
        {issued !== null && (
          <TemporaryPasswordNotice
            heading={issued.heading}
            password={issued.password}
            onDismiss={() => setIssued(null)}
          />
        )}

        <CreateUserForm
          onSessionLost={onSessionLost}
          onCreated={(heading, password) => {
            setIssued({ heading, password })
            reload()
          }}
        />

        {error !== null && (
          <p className="notice notice--critical" role="alert">
            {error}
          </p>
        )}

        <section aria-labelledby="adm-users-title">
          <div className="section__head">
            <h2 className="section__title" id="adm-users-title">
              계정
            </h2>
            <span className="section__note">{users === null ? '' : `${users.length}명`}</span>
          </div>

          {users === null ? (
            <p className="notice">{loading ? '사용자를 불러오는 중입니다…' : '사용자 목록을 불러오지 못했습니다.'}</p>
          ) : users.length === 0 ? (
            <p className="notice">아직 계정이 없습니다. 위에서 사용자를 만드세요.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <caption className="adm-visually-hidden">ARTEL 계정 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">이메일</th>
                    <th scope="col">이름</th>
                    <th scope="col">등급</th>
                    <th scope="col">상태</th>
                    <th scope="col">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId
                    const busy = busyUserId === user.id
                    return (
                      <tr key={user.id}>
                        <td className="mono">{accountLabel(user)}</td>
                        <td>
                          {user.displayName}
                          {isSelf && <span className="muted"> (나)</span>}
                        </td>
                        <td>
                          <select
                            className="control"
                            aria-label={`${accountLabel(user)} 등급`}
                            value={user.platformRole}
                            disabled={isSelf || busy}
                            onChange={(event) =>
                              runForUser(user.id, () =>
                                updateAdminUser(user.id, { platformRole: parseRole(event.target.value) }),
                              )
                            }
                          >
                            {PLATFORM_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABEL[role]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <UserStatus user={user} />
                        </td>
                        <td>
                          <span className="adm-actions">
                            <ConfirmButton
                              label="비밀번호 초기화"
                              confirmLabel="초기화"
                              disabled={busy}
                              onConfirm={() =>
                                runForUser(user.id, async () => {
                                  const result = await resetAdminUserPassword(user.id)
                                  setIssued({ heading: accountLabel(user), password: result.temporaryPassword })
                                })
                              }
                            />
                            {user.disabled ? (
                              <button
                                type="button"
                                className="control"
                                disabled={busy}
                                onClick={() => runForUser(user.id, () => updateAdminUser(user.id, { disabled: false }))}
                              >
                                활성화
                              </button>
                            ) : (
                              <ConfirmButton
                                label="비활성화"
                                confirmLabel="비활성화"
                                disabled={isSelf || busy}
                                onConfirm={() => runForUser(user.id, () => updateAdminUser(user.id, { disabled: true }))}
                              />
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <span className="section__note section__note--block" aria-live="polite">
            {busyUserId !== null ? '변경을 저장하는 중입니다…' : ''}
          </span>
        </section>
      </main>
    </div>
  )
}

/** The address a person is known by here: the sign-in email, else the contact email, else GitHub. */
function accountLabel(user: AdminUser): string {
  return user.loginEmail ?? user.email ?? (user.oauthProviders.length > 0 ? `GitHub (${user.displayName})` : user.id)
}

/** Text and a dot together, so status never depends on color alone. */
function UserStatus({ user }: { user: AdminUser }) {
  if (user.disabled) {
    return (
      <span className="status">
        <span className="status__dot status__dot--failed" aria-hidden="true" />
        비활성
      </span>
    )
  }
  if (user.mustChangePassword) {
    return (
      <span className="status">
        <span className="status__dot status__dot--active" aria-hidden="true" />
        비밀번호 변경 대기
      </span>
    )
  }
  return (
    <span className="status">
      <span className="status__dot status__dot--completed" aria-hidden="true" />
      활성
    </span>
  )
}

function CreateUserForm({
  onCreated,
  onSessionLost,
}: {
  onCreated: (heading: string, password: string) => void
  onSessionLost: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<PlatformRole>('USER')
  const [submitting, setSubmitting] = useState(false)
  const { error, setError, fail } = useAdminFailure(onSessionLost)
  const emailId = useId()
  const nameId = useId()
  const roleId = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createAdminUser({ email: email.trim(), name: name.trim(), platformRole: role })
      onCreated(email.trim(), result.temporaryPassword)
      setEmail('')
      setName('')
      setRole('USER')
    } catch (cause) {
      fail(cause)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="adm-create-title">
      <div className="section__head">
        <h2 className="section__title" id="adm-create-title">
          사용자 만들기
        </h2>
        <span className="section__note">임시 비밀번호가 한 번만 표시됩니다.</span>
      </div>
      <form className="adm-form" onSubmit={submit}>
        <span className="adm-field">
          <label className="field__label" htmlFor={emailId}>
            이메일
          </label>
          <input
            id={emailId}
            className="control adm-input"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </span>
        <span className="adm-field">
          <label className="field__label" htmlFor={nameId}>
            이름
          </label>
          <input
            id={nameId}
            className="control adm-input"
            type="text"
            autoComplete="off"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </span>
        <span className="adm-field">
          <label className="field__label" htmlFor={roleId}>
            등급
          </label>
          <select
            id={roleId}
            className="control adm-input"
            value={role}
            onChange={(event) => setRole(parseRole(event.target.value))}
          >
            {PLATFORM_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value]}
              </option>
            ))}
          </select>
        </span>
        <button
          type="submit"
          className="control control--action"
          disabled={submitting || email.trim() === '' || name.trim() === ''}
        >
          {submitting ? '만드는 중…' : '사용자 만들기'}
        </button>
      </form>
      {error !== null && (
        <p className="notice notice--critical" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
