import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchQaLabels, fetchQaStats } from './qaStatsApi'

/**
 * `testRunId`·`label`이 `projectId`와 같은 생략 규칙을 지키는지, 그리고 `testRunId`와 `label`이
 * 서로 독립인 필터로 함께 실리는지.
 *
 * 빈 문자열을 그대로 실으면 서버가 그것을 testRunId 또는 label로 읽어 400을 낸다 — null일 때
 * 파라미터 자체를 안 싣는 것이 유일하게 맞는 표현이다. 여기서 깨지면 "전체"를 고른 화면이
 * 조용히 부분집합을 그린다.
 */

const from = new Date('2026-08-01T00:00:00Z')
const to = new Date('2026-09-01T00:00:00Z')

const emptyBody = {
  projectId: null,
  label: null,
  from: from.toISOString(),
  to: to.toISOString(),
  total: {},
  cells: [],
  truncated: false,
  cellLimit: 500,
}

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchQaStats', () => {
  it('testRunId가 null이면 쿼리에 파라미터를 싣지 않는다', async () => {
    const fetchMock = stubFetch(emptyBody)

    await fetchQaStats({ projectId: null, from, to, testRunId: null, label: null })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.has('testRunId')).toBe(false)
  })

  it('testRunId를 주면 그 값을 그대로 쿼리에 싣는다', async () => {
    const fetchMock = stubFetch(emptyBody)

    await fetchQaStats({ projectId: null, from, to, testRunId: '9011', label: null })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('testRunId')).toBe('9011')
  })

  it('label이 null이면 쿼리에 파라미터를 싣지 않는다', async () => {
    const fetchMock = stubFetch(emptyBody)

    await fetchQaStats({ projectId: null, from, to, testRunId: null, label: null })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.has('label')).toBe(false)
  })

  it('label을 주면 그 값을 그대로 쿼리에 싣는다', async () => {
    const fetchMock = stubFetch(emptyBody)

    await fetchQaStats({ projectId: null, from, to, testRunId: null, label: 'content-map-2x2-파일럿' })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('label')).toBe('content-map-2x2-파일럿')
  })

  it('label과 testRunId를 함께 주면 둘 다 쿼리에 싣는다', async () => {
    const fetchMock = stubFetch(emptyBody)

    await fetchQaStats({
      projectId: null,
      from,
      to,
      testRunId: '9013',
      label: 'content-map-2x2-파일럿',
    })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('testRunId')).toBe('9013')
    expect(url.searchParams.get('label')).toBe('content-map-2x2-파일럿')
  })

  it('응답의 label을 그대로 파싱한다', async () => {
    stubFetch({ ...emptyBody, label: 'content-map-2x2-파일럿' })

    const stats = await fetchQaStats({ projectId: null, from, to, testRunId: null, label: null })

    expect(stats.label).toBe('content-map-2x2-파일럿')
  })

  it('응답에 label이 없으면 null로 파싱한다', async () => {
    stubFetch(emptyBody)

    const stats = await fetchQaStats({ projectId: null, from, to, testRunId: null, label: null })

    expect(stats.label).toBeNull()
  })
})

describe('fetchQaLabels', () => {
  it('projectId가 null이면 쿼리에 파라미터를 싣지 않는다', async () => {
    const fetchMock = stubFetch({ projectId: null, labels: [] })

    await fetchQaLabels(null)

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.has('projectId')).toBe(false)
  })

  it('projectId를 주면 그 값을 그대로 쿼리에 싣는다', async () => {
    const fetchMock = stubFetch({ projectId: 'project-1', labels: [] })

    await fetchQaLabels('project-1')

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('projectId')).toBe('project-1')
  })

  it('labels 배열을 그대로 파싱한다', async () => {
    stubFetch({ projectId: null, labels: ['content-map-2x2-파일럿', '1차 실험'] })

    const labels = await fetchQaLabels(null)

    expect(labels).toEqual(['content-map-2x2-파일럿', '1차 실험'])
  })
})
