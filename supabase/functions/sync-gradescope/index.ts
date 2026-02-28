import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse as parseHtml } from 'https://esm.sh/node-html-parser@6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!
const GS_BASE = 'https://www.gradescope.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Crypto ────────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return arr
}

async function decryptValue(encHex: string, ivHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', hexToBytes(ENCRYPTION_KEY), { name: 'AES-CBC' }, false, ['decrypt'])
  const dec = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: hexToBytes(ivHex) }, key, hexToBytes(encHex))
  return new TextDecoder().decode(dec)
}

// ── Cookie management ─────────────────────────────────────────────────────────

type CookieJar = Record<string, string>

function mergeCookies(jar: CookieJar, res: Response): void {
  const setCookies: string[] =
    typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie()
      : res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []
  for (const c of setCookies) {
    const [kv] = c.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim()
  }
}

function cookieStr(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

function gsGet(jar: CookieJar, path: string) {
  return fetch(path.startsWith('http') ? path : `${GS_BASE}${path}`, {
    headers: { 'Cookie': cookieStr(jar), 'User-Agent': UA },
  })
}

// ── Gradescope login ──────────────────────────────────────────────────────────

async function gradescopeLogin(email: string, password: string): Promise<{ jar: CookieJar; accountHtml: string }> {
  const jar: CookieJar = {}

  const homeRes = await fetch(GS_BASE, { headers: { 'User-Agent': UA } })
  mergeCookies(jar, homeRes)
  const homeHtml = await homeRes.text()

  const m =
    homeHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
    homeHtml.match(/value="([^"]+)"[^>]*name="authenticity_token"/)
  if (!m) throw new Error('Could not reach Gradescope')

  const loginBody = new URLSearchParams({
    'utf8': '✓',
    'session[email]': email,
    'session[password]': password,
    'session[remember_me]': '0',
    'commit': 'Log In',
    'session[remember_me_sso]': '0',
    'authenticity_token': m[1],
  })

  const loginRes = await fetch(`${GS_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr(jar),
      'Referer': GS_BASE,
      'User-Agent': UA,
    },
    body: loginBody.toString(),
    redirect: 'manual',
  })

  if (loginRes.status !== 302) throw new Error('Gradescope login failed — reconnect in Settings')
  mergeCookies(jar, loginRes)

  const location = loginRes.headers.get('location') || '/account'
  const accountRes = await gsGet(jar, location)
  mergeCookies(jar, accountRes)
  if (!accountRes.ok) throw new Error('Could not access Gradescope account page')
  const accountHtml = await accountRes.text()

  return { jar, accountHtml }
}

// ── Scrape Courses ────────────────────────────────────────────────────────────

interface GSCourse {
  id: string
  shortName: string   // e.g. "COSC 208"
  fullName: string    // e.g. "Introduction to Computer Science"
}

function scrapeGradescopeCourses(html: string): GSCourse[] {
  const root = parseHtml(html)
  const courses: GSCourse[] = []

  for (const link of root.querySelectorAll('a[href^="/courses/"]')) {
    const href = link.getAttribute('href') || ''
    const courseId = href.split('/')[2]
    if (!courseId || !/^\d+$/.test(courseId)) continue

    const shortName = link.querySelector('.courseBox--shortname')?.text?.trim()
    if (!shortName) continue

    const fullName = link.querySelector('.courseBox--name')?.text?.trim() || ''

    if (!courses.find(c => c.id === courseId)) {
      courses.push({ id: courseId, shortName, fullName })
    }
  }

  return courses
}

// ── Scrape Assignments ────────────────────────────────────────────────────────

interface GSAssignment {
  id: string | null
  name: string
  dueDate: string | null   // YYYY-MM-DD
  dueTime: string | null   // HH:MM
  maxPoints: number | null
  status: 'pending' | 'submitted' | 'graded'
  grade: number | null
}

function scrapeGradescopeAssignments(html: string, gsCourseId: string): GSAssignment[] {
  const root = parseHtml(html)
  const assignments: GSAssignment[] = []

  // Try instructor view first (React JSON blob)
  const reactTable = root.querySelector('div[data-react-class="AssignmentsTable"]')
  if (reactTable) {
    try {
      const props = JSON.parse(reactTable.getAttribute('data-react-props') || '{}')
      for (const a of (props.table_data || [])) {
        if (a.type !== 'assignment') continue
        const dueDateStr = a.submission_window?.due_date
        let dueDate: string | null = null
        let dueTime: string | null = null
        if (dueDateStr) {
          const d = new Date(dueDateStr)
          dueDate = d.toISOString().split('T')[0]
          dueTime = d.toTimeString().slice(0, 5)
        }
        assignments.push({
          id: a.url?.split('/').pop() || null,
          name: a.title,
          dueDate,
          dueTime,
          maxPoints: a.total_points ? parseFloat(a.total_points) : null,
          status: 'pending',
          grade: null,
        })
      }
      return assignments
    } catch {
      // fall through to student view
    }
  }

  // Student view: HTML table with tr[role="row"]
  const rows = root.querySelectorAll('tr[role="row"]')
  const dataRows = rows.length > 2 ? rows.slice(1, -1) : rows.slice(1)

  for (const row of dataRows) {
    const nameTh = row.querySelector('th')
    if (!nameTh) continue

    const name = nameTh.text.trim()
    if (!name) continue

    // Assignment ID
    let assignId: string | null = null
    const link = nameTh.querySelector('a[href]')
    const button = nameTh.querySelector('button.js-submitAssignment')
    if (link) {
      const href = link.getAttribute('href') || ''
      const parts = href.split('/')
      const assignIdx = parts.indexOf('assignments')
      assignId = assignIdx >= 0 ? parts[assignIdx + 1] || null : null
    } else if (button) {
      assignId = button.getAttribute('data-assignment-id') || null
    }

    const tds = row.querySelectorAll('td')

    // Grade / status (first td)
    let grade: number | null = null
    let maxPoints: number | null = null
    let status: 'pending' | 'submitted' | 'graded' = 'pending'
    const gradeText = tds[0]?.text?.trim() || ''
    if (gradeText.includes(' / ')) {
      const parts = gradeText.split(' / ')
      grade = parseFloat(parts[0]) || null
      maxPoints = parseFloat(parts[1]) || null
      status = grade !== null ? 'graded' : 'submitted'
    } else if (gradeText && gradeText !== 'No Submission' && gradeText !== '--') {
      status = 'submitted'
    }

    // Due date (second td)
    let dueDate: string | null = null
    let dueTime: string | null = null
    const dueDateEl = tds[1]?.querySelector('.submissionTimeChart--dueDate')
    const datetime = dueDateEl?.getAttribute('datetime')
    if (datetime) {
      const d = new Date(datetime)
      if (!isNaN(d.getTime())) {
        dueDate = d.toISOString().split('T')[0]
        dueTime = d.toTimeString().slice(0, 5)
      }
    }

    assignments.push({ id: assignId, name, dueDate, dueTime, maxPoints, status, grade })
  }

  return assignments
}

// ── Course Matching ───────────────────────────────────────────────────────────

function normalizeCourseCode(name: string): string | null {
  const m = name.match(/([A-Z]{2,5})\s*[-–]?\s*(\d{3}[A-Z]?)/i)
  return m ? `${m[1]}${m[2]}`.toUpperCase() : null
}

function findMatchingDbCourse(
  gsCourse: GSCourse,
  dbCourses: { id: string; name: string; short_name: string | null; gradescope_course_id: string | null }[]
): typeof dbCourses[0] | null {
  const linked = dbCourses.find(c => c.gradescope_course_id === gsCourse.id)
  if (linked) return linked

  const gsCode = normalizeCourseCode(gsCourse.shortName) || normalizeCourseCode(gsCourse.fullName)
  if (!gsCode) return null

  return dbCourses.find(c => {
    const dbCode = normalizeCourseCode(c.name) || normalizeCourseCode(c.short_name || '')
    return dbCode === gsCode
  }) ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) throw new Error('Unauthorized')

    // 1. Get encrypted password
    const { data: userData } = await supabase
      .from('users')
      .select('gradescope_password_encrypted, gradescope_password_iv, gradescope_connected')
      .eq('id', user.id)
      .single()

    if (!userData?.gradescope_password_encrypted) {
      throw new Error('Gradescope not connected — add your password in Settings')
    }

    const password = await decryptValue(
      userData.gradescope_password_encrypted,
      userData.gradescope_password_iv
    )

    // 2. Login fresh and get account page
    const { jar, accountHtml } = await gradescopeLogin(user.email!, password)

    // 3. Scrape student courses
    const gsCourses = scrapeGradescopeCourses(accountHtml)

    // 4. Get our courses from DB
    const { data: dbCourses } = await supabase
      .from('courses')
      .select('id, name, short_name, gradescope_course_id')
      .eq('user_id', user.id)

    let assignmentsSynced = 0
    let coursesSynced = 0

    // 5. For each Gradescope course, match + sync assignments
    for (const gsCourse of gsCourses) {
      const dbCourse = findMatchingDbCourse(gsCourse, dbCourses || [])
      if (!dbCourse) continue

      // Link gradescope_course_id if not yet set
      if (!dbCourse.gradescope_course_id) {
        await supabase.from('courses').update({ gradescope_course_id: gsCourse.id }).eq('id', dbCourse.id)
      }

      // 6. Fetch assignments page for this course
      const courseRes = await gsGet(jar, `/courses/${gsCourse.id}`)
      if (!courseRes.ok) continue
      const courseHtml = await courseRes.text()
      mergeCookies(jar, courseRes)

      const gsAssignments = scrapeGradescopeAssignments(courseHtml, gsCourse.id)

      // 7. Upsert each assignment
      for (const a of gsAssignments) {
        if (!a.name) continue
        const externalUrl = a.id
          ? `${GS_BASE}/courses/${gsCourse.id}/assignments/${a.id}`
          : `${GS_BASE}/courses/${gsCourse.id}`

        const { data: existing } = await supabase
          .from('assignments')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('course_id', dbCourse.id)
          .eq('title', a.name)
          .eq('source', 'gradescope')
          .maybeSingle()

        if (existing) {
          const updates: Record<string, unknown> = {
            due_date: a.dueDate,
            due_time: a.dueTime,
            external_url: externalUrl,
            points: a.maxPoints,
          }
          if (a.status === 'graded' || (a.status === 'submitted' && existing.status === 'pending')) {
            updates.status = a.status
          }
          await supabase.from('assignments').update(updates).eq('id', existing.id)
        } else {
          await supabase.from('assignments').insert({
            user_id: user.id,
            course_id: dbCourse.id,
            title: a.name,
            due_date: a.dueDate,
            due_time: a.dueTime,
            type: 'homework',
            platform: 'gradescope',
            points: a.maxPoints,
            source: 'gradescope',
            status: a.status,
            parse_confidence: 'high',
            external_url: externalUrl,
          })
        }
        assignmentsSynced++
      }
      coursesSynced++
    }

    return new Response(
      JSON.stringify({ courses_synced: coursesSynced, assignments_synced: assignmentsSynced }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('sync-gradescope error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
