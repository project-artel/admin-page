import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { entriesFor, matching, nextIndex, type PickerEntry } from './pick'
import type { ProjectSummary } from './projectsApi'
import './picker.css'

interface Props {
  projects: ProjectSummary[] | null
  value: string | null
  onChange: (projectId: string) => void
  /**
   * 프로젝트를 고르지 않는 항목을 목록 맨 위에 둘지. 값은 [ALL_PROJECTS]다.
   *
   * 그 항목을 받는 화면은 집계가 프로젝트 하나를 요구하지 않는 쪽뿐이다. 지식 그래프와 기대 판정
   * 라벨은 프로젝트가 있어야 그릴 것이 정해지므로 이 옵션을 켜지 않는다.
   */
  allowAll?: boolean
  /** [allowAll] 항목에 적을 말. 등급에 따라 "전체"가 덮는 범위가 달라서 화면이 정한다. */
  allLabel?: string
}

/**
 * 프로젝트 선택기. 입력한 글자로 목록을 좁혀 고른다.
 *
 * `select`를 쓰지 않는 이유는 개발자 등급이 전 프로젝트를 받기 때문이다. 이름만 백 개 늘어놓은
 * 목록에서는 원하는 것을 고를 수 없고, `select`에는 좁힐 방법이 없다.
 *
 * **참여 중인 프로젝트를 위로 올리고 표시를 붙인다.** 내 것과 남의 것을 toggle로 가르지 않은 것은
 * 상태가 둘이 되면 남의 프로젝트를 찾다 못 찾았을 때 그것이 없어서인지 toggle 때문인지 알 수 없기
 * 때문이다. 한 목록에 두고 순서와 표시로 가른다.
 *
 * 거르기는 화면에서 한다. 서버가 이름 필터를 받지 않아 목록을 통째로 받아 두기 때문인데, 그래서
 * 프로젝트가 서버의 `size` 상한(100)을 넘으면 넘은 것은 여기 오지 않는다. 그 상태를 감추지 않고
 * 목록 아래에 몇 건 중 몇 건인지 함께 적는다.
 */
export function ProjectPicker({
  projects,
  value,
  onChange,
  allowAll = false,
  allLabel = '전체',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const fieldId = useId()

  const entries = useMemo(
    () => (projects === null ? [] : entriesFor(projects, { allowAll, allLabel })),
    [projects, allowAll, allLabel]
  )

  const selected = entries.find((entry) => entry.id === value) ?? null

  const matches = useMemo(() => matching(entries, query), [entries, query])

  // 목록이 짧아지면 커서가 목록 밖을 가리킬 수 있다.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(matches.length - 1, 0)))
  }, [matches.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function pick(entry: PickerEntry) {
    onChange(entry.id)
    close()
    inputRef.current?.blur()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => nextIndex(current, step, matches.length))
      return
    }
    if (event.key === 'Enter') {
      if (!open) return
      event.preventDefault()
      const project = matches[activeIndex]
      if (project) pick(project)
      return
    }
    if (event.key === 'Escape') {
      if (!open) return
      event.preventDefault()
      close()
    }
  }

  const empty = projects !== null && projects.length === 0
  const placeholder = projects === null ? '불러오는 중…' : empty ? '볼 수 있는 프로젝트 없음' : '이름으로 찾기'

  return (
    <span className="field">
      <label className="field__label" htmlFor={fieldId}>
        프로젝트
      </label>
      <div className="picker" ref={rootRef}>
        <input
          className="control picker__input"
          id={fieldId}
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[activeIndex] ? optionId(listId, activeIndex) : undefined}
          disabled={projects === null || empty}
          placeholder={placeholder}
          value={open ? query : (selected?.name ?? '')}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={onKeyDown}
        />

        {open && (
          <ul className="picker__list" id={listId} role="listbox" aria-label="프로젝트">
            {matches.length === 0 && (
              <li className="picker__empty" role="presentation">
                찾는 이름이 없습니다
              </li>
            )}
            {matches.map((entry, index) => (
              <li
                key={entry.id}
                id={optionId(listId, index)}
                className={
                  'picker__option' + (index === activeIndex ? ' picker__option--active' : '')
                }
                role="option"
                aria-selected={entry.id === value}
                // click 보다 먼저 도는 pointerdown 이 input 의 blur 를 부르면 목록이 닫혀 click 이
                // 목록 밖에서 끝난다. 그래서 여기서 선택한다.
                onPointerDown={(event) => {
                  event.preventDefault()
                  pick(entry)
                }}
                onPointerEnter={() => setActiveIndex(index)}
              >
                <span className="picker__name">{entry.name}</span>
                {entry.mine && <span className="picker__badge">내 프로젝트</span>}
              </li>
            ))}
            {projects !== null && (
              <li className="picker__count" role="presentation" aria-live="polite">
                {entries.length}건 중 {matches.length}건
              </li>
            )}
          </ul>
        )}
      </div>
    </span>
  )
}

function optionId(listId: string, index: number): string {
  return `${listId}-option-${index}`
}
