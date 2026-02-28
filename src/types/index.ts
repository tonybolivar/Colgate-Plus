export interface User {
  id: string
  email: string
  full_name: string | null
  grad_year: number | null
  major: string | null
  moodle_token_encrypted: string | null
  moodle_token_iv: string | null
  onboarding_complete: boolean
  gradescope_password_encrypted: string | null
  gradescope_password_iv: string | null
  gradescope_connected: boolean
  created_at: string
}

export interface Course {
  id: string
  user_id: string
  moodle_course_id: number
  name: string
  short_name: string | null
  color: string
  syllabus_parsed: boolean
  last_synced_at: string | null
  gradescope_course_id: string | null
  created_at: string
}

export type AssignmentType = 'homework' | 'exam' | 'project' | 'reading' | 'quiz' | 'other'
export type AssignmentPlatform = 'gradescope' | 'moodle' | 'in-class' | 'unknown'
export type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'excused' | 'archived'
export type AssignmentSource = 'syllabus' | 'moodle' | 'manual' | 'recurring' | 'gradescope'
export type ParseConfidence = 'high' | 'medium' | 'low'

export interface RecurringRule {
  id: string
  user_id: string
  course_id: string
  title: string
  day_of_week: number  // 0=Sun, 1=Mon, ..., 6=Sat
  type: AssignmentType
  platform: AssignmentPlatform
  start_date: string
  end_date: string
  created_at: string
  course?: Course
}

export interface Assignment {
  id: string
  user_id: string
  course_id: string
  title: string
  due_date: string | null
  due_time: string | null
  type: AssignmentType
  platform: AssignmentPlatform
  points: number | null
  status: AssignmentStatus
  source: AssignmentSource
  notes: string | null
  parse_confidence: ParseConfidence | null
  recurring_rule_id: string | null
  external_url: string | null
  created_at: string
  course?: Course
}

export interface Syllabus {
  id: string
  user_id: string
  course_id: string
  file_path: string | null
  moodle_file_url: string | null
  parsed_at: string | null
  raw_claude_response: object | null
  created_at: string
}

export interface PortalLink {
  id: string
  label: string
  url: string
  icon: string | null
  sort_order: number
}

export interface MoodleCourse {
  id: number
  fullname: string
  shortname: string
}

export interface MoodleResource {
  id: number
  course: number
  name: string
  contentfiles: MoodleFile[]
}

export interface MoodleFile {
  filename: string
  fileurl: string
  mimetype: string
  filesize: number
}

export interface MoodleSiteInfo {
  userid: number
  username: string
  fullname: string
  sitename: string
}

export interface ParsedAssignment {
  title: string
  due_date: string | null
  due_time: string | null
  type: AssignmentType
  platform: AssignmentPlatform
  points: number | null
  notes: string | null
  confidence: ParseConfidence
}

export interface SyncProgress {
  total: number
  completed: number
  current_course: string | null
  status: 'idle' | 'syncing' | 'parsing' | 'done' | 'error'
  error: string | null
}
