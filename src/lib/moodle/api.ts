import type { MoodleCourse, MoodleResource, MoodleSiteInfo, MoodleFile } from '../../types'

const BASE_URL = import.meta.env.VITE_MOODLE_BASE_URL || 'https://moodle.colgate.edu'

function moodleRestUrl(token: string, wsfunction: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: 'json',
    ...extra,
  })
  return `${BASE_URL}/webservice/rest/server.php?${params}`
}

export async function getSiteInfo(token: string): Promise<MoodleSiteInfo> {
  const res = await fetch(moodleRestUrl(token, 'core_webservice_get_site_info'))
  const data = await res.json()
  if (data.exception) throw new Error(data.message)
  return data
}

export async function getEnrolledCourses(token: string, userId: number): Promise<MoodleCourse[]> {
  const res = await fetch(moodleRestUrl(token, 'core_enrol_get_users_courses', { userid: String(userId) }))
  const data = await res.json()
  if (data.exception) throw new Error(data.message)
  return Array.isArray(data) ? data : []
}

export async function getCourseResources(token: string, courseIds: number[]): Promise<MoodleResource[]> {
  const params = new URLSearchParams({
    wstoken: token,
    wsfunction: 'mod_resource_get_resources_by_courses',
    moodlewsrestformat: 'json',
  })
  courseIds.forEach((id, i) => params.append(`courseids[${i}]`, String(id)))

  const res = await fetch(`${BASE_URL}/webservice/rest/server.php`, {
    method: 'POST',
    body: params,
  })
  const data = await res.json()
  if (data.exception) throw new Error(data.message)
  return data.resources || []
}

export interface SyllabusFile extends MoodleFile {
  moodle_course_id: number
  resource_name: string
}

export function findSyllabusFiles(resources: MoodleResource[]): SyllabusFile[] {
  return resources.flatMap((r) =>
    (r.contentfiles || [])
      .filter((f) => f.filename.toLowerCase().includes('syllabus'))
      .map((f) => ({ ...f, moodle_course_id: r.course, resource_name: r.name }))
  )
}

export function getMoodleFileUrl(fileUrl: string, token: string): string {
  const url = new URL(fileUrl)
  url.searchParams.set('token', token)
  return url.toString()
}
