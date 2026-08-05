import { apiFetch, asRecord, asString, readJson } from '../api/orchestration'

export interface ProjectSummary {
  id: string
  name: string
}

/** 프로젝트 선택기 한 페이지. 집계는 프로젝트 단위라 이 선택이 대시보드의 스코프다. */
export async function listProjects(signal?: AbortSignal): Promise<ProjectSummary[]> {
  const response = await apiFetch('/api/projects?page=0&size=100', { signal })
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
