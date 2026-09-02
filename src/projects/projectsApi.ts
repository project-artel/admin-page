import { apiFetch, asRecord, asString, readJson } from '../api/orchestration'

export interface ProjectSummary {
  id: string
  name: string
  /** 로그인한 사람이 참여 중인 프로젝트인지. 개발자 등급에게만 false가 나온다. */
  mine: boolean
}

/** 한 번에 받아올 최대 개수. 서버의 `size` 상한이 100이라 그 위로는 올릴 수 없다. */
const PAGE_SIZE = 100

/**
 * 프로젝트 선택기 한 페이지. 집계는 프로젝트 단위라 이 선택이 대시보드의 스코프다.
 *
 * `seesAllProjects`면 `scope=ALL`로 전 프로젝트를 받고, 참여 중인 목록을 한 번 더 받아
 * [ProjectSummary.mine]을 채운다. **응답의 `myRole`을 쓰지 않는 이유**는 그 값이
 * `scope=ALL`에서 뜻이 없기 때문이다 — 참여하지 않은 프로젝트도 `MEMBER`로 떨어져서 실제 참여와
 * 구분되지 않는다. 두 번 부르는 값을 치르고 정확한 답을 얻는 쪽을 골랐다.
 *
 * 두 번째 호출이 실패해도 목록은 그대로 낸다. 표시는 거들 뿐이라, 그것 때문에 선택기 전체가
 * 비면 개발자가 아무 프로젝트도 고르지 못한다.
 */
export async function listProjects(
  seesAllProjects: boolean,
  signal?: AbortSignal
): Promise<ProjectSummary[]> {
  if (!seesAllProjects) {
    return (await fetchPage('MINE', signal)).map((project) => ({ ...project, mine: true }))
  }

  const all = await fetchPage('ALL', signal)
  const mineIds = await fetchMineIds(signal)
  return all.map((project) => ({ ...project, mine: mineIds.has(project.id) }))
}

async function fetchMineIds(signal?: AbortSignal): Promise<Set<string>> {
  try {
    return new Set((await fetchPage('MINE', signal)).map((project) => project.id))
  } catch {
    return new Set()
  }
}

async function fetchPage(
  scope: 'MINE' | 'ALL',
  signal?: AbortSignal
): Promise<Array<Omit<ProjectSummary, 'mine'>>> {
  const response = await apiFetch(`/api/projects?page=0&size=${PAGE_SIZE}&scope=${scope}`, {
    signal,
  })
  const body = asRecord(await readJson(response))
  const items = Array.isArray(body.items) ? body.items : []

  return items.map((item) => {
    const project = asRecord(item)
    return {
      id: asString(project.id, 'project.id'),
      name: asString(project.name, 'project.name'),
    }
  })
}
