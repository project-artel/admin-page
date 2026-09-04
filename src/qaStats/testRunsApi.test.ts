import { describe, expect, it } from 'vitest'
import { ALL_PROJECTS } from '../projects/pick'
import { activeProjectId } from './testRunsApi'

/**
 * `test run` 목록 호출을 실제로 막는 규칙.
 *
 * `/api/projects/{projectId}/test-runs`가 프로젝트 경계를 지나므로, 이 함수가 null을 주는
 * 자리에서 `listTestRuns`를 부르면 곧장 400이다. 화면은 이 값이 null일 때 그 호출 자체를 하지
 * 않는다.
 */
describe('activeProjectId', () => {
  it('프로젝트를 아직 안 골랐으면 목록을 부를 프로젝트가 없다', () => {
    expect(activeProjectId(null)).toBeNull()
  })

  it('전 프로젝트 합산을 골랐어도 목록을 부를 프로젝트가 없다', () => {
    expect(activeProjectId(ALL_PROJECTS)).toBeNull()
  })

  it('실제 프로젝트를 골랐으면 그 id를 그대로 쓴다', () => {
    expect(activeProjectId('project-1')).toBe('project-1')
  })
})
