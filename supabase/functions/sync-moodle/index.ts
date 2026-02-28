import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!
const MOODLE_BASE_URL = 'https://moodle.colgate.edu'

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

async function decryptToken(encryptedHex: string, ivHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', hexToBytes(ENCRYPTION_KEY), { name: 'AES-CBC' }, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: hexToBytes(ivHex) }, key, hexToBytes(encryptedHex))
  return new TextDecoder().decode(decrypted)
}

// ── Moodle API ────────────────────────────────────────────────────────────────

function moodleUrl(token: string, wsfunction: string, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ wstoken: token, wsfunction, moodlewsrestformat: 'json', ...extra })
  return `${MOODLE_BASE_URL}/webservice/rest/server.php?${p}`
}

async function moodleGet(url: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (data?.exception) throw new Error(`Moodle: ${data.message}`)
  return data
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) throw new Error('Not authenticated')

    // 1. Get encrypted token
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('moodle_token_encrypted, moodle_token_iv')
      .eq('id', user.id)
      .single()

    if (dbError) throw new Error(`[step1] DB error: ${dbError.message}`)
    if (!userData?.moodle_token_encrypted) throw new Error('[step1] No Moodle token found. Reconnect Moodle in Settings.')

    const token = await decryptToken(userData.moodle_token_encrypted, userData.moodle_token_iv)

    // 2. Get Moodle user ID
    const siteInfo = await moodleGet(moodleUrl(token, 'core_webservice_get_site_info'))
    if (!siteInfo?.userid) throw new Error(`[step2] Moodle siteInfo missing userid. Response: ${JSON.stringify(siteInfo).slice(0, 200)}`)
    const moodleUserId = siteInfo.userid

    // 3. Get enrolled courses
    const courses = await moodleGet(moodleUrl(token, 'core_enrol_get_users_courses', { userid: String(moodleUserId) }))

    // Determine current semester label, e.g. "spring 2026" or "fall 2026"
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const year = now.getFullYear()
    const semester = month >= 8 ? `fall ${year}` : `spring ${year}`

    const moodleCourses: { id: number; fullname: string; shortname: string; enddate?: number }[] = Array.isArray(courses)
      ? courses.filter((c: { fullname: string; enddate?: number }) => {
          const name = c.fullname.toLowerCase()
          // Must be a course for the current semester
          if (!name.startsWith(semester)) return false
          // If enddate is set and already in the past, skip
          if (c.enddate && c.enddate > 0 && c.enddate < Math.floor(Date.now() / 1000)) return false
          return true
        })
      : []

    // 4. Upsert valid courses
    for (const mc of moodleCourses) {
      await supabase.from('courses').upsert({
        user_id: user.id,
        moodle_course_id: mc.id,
        name: mc.fullname,
        short_name: mc.shortname,
      }, { onConflict: 'user_id,moodle_course_id' })
    }

    // Clean up any stored courses NOT in the current semester set
    const currentMoodleIds = moodleCourses.map(c => c.id)
    if (currentMoodleIds.length > 0) {
      await supabase
        .from('courses')
        .delete()
        .eq('user_id', user.id)
        .not('moodle_course_id', 'in', `(${currentMoodleIds.join(',')})`)
    } else {
      // No current-semester courses found — don't wipe everything, just skip cleanup
    }

    // 5. Get DB course IDs (needed for assignment sync)
    const courseIds = moodleCourses.map(c => c.id)
    const { data: dbCourses } = await supabase
      .from('courses')
      .select('id, moodle_course_id, name, syllabus_parsed')
      .eq('user_id', user.id)

    // 6. Scrape Moodle assignments + quizzes directly
    // These have exact due dates (Unix timestamps) — more reliable than syllabus parsing.
    // source='moodle' so they're distinguishable from syllabus-parsed ones.

    // 6a. Assignments (mod_assign)
    if (courseIds.length > 0) {
      try {
        const assignParams = new URLSearchParams({ wstoken: token, wsfunction: 'mod_assign_get_assignments', moodlewsrestformat: 'json' })
        courseIds.forEach((id, i) => assignParams.append(`courseids[${i}]`, String(id)))
        const assignRes = await fetch(`${MOODLE_BASE_URL}/webservice/rest/server.php`, { method: 'POST', body: assignParams })
        const assignData = await assignRes.json()
        const assignCourses: { id: number; assignments: { id: number; cmid: number; name: string; duedate: number; grade: number; nosubmissions: number }[] }[] = assignData?.courses || []

        for (const course of assignCourses) {
          const dbCourse = dbCourses?.find(c => c.moodle_course_id === course.id)
          if (!dbCourse) continue

          for (const a of (course.assignments || [])) {
            if (!a.duedate || a.duedate === 0) continue // no due date set

            const dueDate = new Date(a.duedate * 1000)
            const dueDateStr = dueDate.toISOString().split('T')[0]

            // Check if already exists (by moodle activity name + course)
            const { data: existing } = await supabase
              .from('assignments')
              .select('id')
              .eq('user_id', user.id)
              .eq('course_id', dbCourse.id)
              .eq('title', a.name)
              .eq('source', 'moodle')
              .maybeSingle()

            // Check actual submission status via Moodle API (reliable — uses assignment ID)
            let moodleStatus: 'pending' | 'submitted' | 'graded' = 'pending'
            try {
              const subStatusUrl = moodleUrl(token, 'mod_assign_get_submission_status', { assignid: String(a.id) })
              const subStatus = await moodleGet(subStatusUrl)
              const submission = subStatus?.lastattempt?.submission
              const grading = subStatus?.feedback?.grade
              if (grading?.grade !== null && grading?.grade !== undefined && grading?.grade !== -1) {
                moodleStatus = 'graded'
              } else if (submission?.status === 'submitted') {
                moodleStatus = 'submitted'
              }
            } catch {
              // Non-fatal — leave as pending
            }

            const moodleUrl = a.cmid ? `${MOODLE_BASE_URL}/mod/assign/view.php?id=${a.cmid}` : null

            if (existing) {
              // Always update due date; only update status if Moodle says it's done
              // (never downgrade from submitted/graded to pending)
              const updates: Record<string, unknown> = { due_date: dueDateStr, external_url: moodleUrl }
              if (moodleStatus !== 'pending') updates.status = moodleStatus
              await supabase.from('assignments').update(updates).eq('id', existing.id)
            } else {
              await supabase.from('assignments').insert({
                user_id: user.id,
                course_id: dbCourse.id,
                title: a.name,
                due_date: dueDateStr,
                type: 'homework',
                platform: 'moodle',
                points: a.grade || null,
                source: 'moodle',
                status: moodleStatus,
                parse_confidence: 'high',
                external_url: moodleUrl,
              })
            }
          }
        }
      } catch (err) {
        console.log('sync-moodle: mod_assign fetch failed:', err)
      }
    }

    // 6b. Quizzes (mod_quiz)
    if (courseIds.length > 0) {
      try {
        const quizParams = new URLSearchParams({ wstoken: token, wsfunction: 'mod_quiz_get_quizzes_by_courses', moodlewsrestformat: 'json' })
        courseIds.forEach((id, i) => quizParams.append(`courseids[${i}]`, String(id)))
        const quizRes = await fetch(`${MOODLE_BASE_URL}/webservice/rest/server.php`, { method: 'POST', body: quizParams })
        const quizData = await quizRes.json()
        const quizzes: { id: number; coursemodule: number; course: number; name: string; timeclose: number; grade: number }[] = quizData?.quizzes || []

        for (const q of quizzes) {
          if (!q.timeclose || q.timeclose === 0) continue

          const dbCourse = dbCourses?.find(c => c.moodle_course_id === q.course)
          if (!dbCourse) continue

          const dueDate = new Date(q.timeclose * 1000)
          const dueDateStr = dueDate.toISOString().split('T')[0]
          const dueTimeStr = dueDate.toTimeString().slice(0, 5)

          const { data: existing } = await supabase
            .from('assignments')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', dbCourse.id)
            .eq('title', q.name)
            .eq('source', 'moodle')
            .maybeSingle()

          const quizUrl = q.coursemodule ? `${MOODLE_BASE_URL}/mod/quiz/view.php?id=${q.coursemodule}` : null

          if (existing) {
            await supabase.from('assignments').update({ due_date: dueDateStr, due_time: dueTimeStr, external_url: quizUrl }).eq('id', existing.id)
          } else {
            await supabase.from('assignments').insert({
              user_id: user.id,
              course_id: dbCourse.id,
              title: q.name,
              due_date: dueDateStr,
              due_time: dueTimeStr,
              type: 'quiz',
              platform: 'moodle',
              points: q.grade || null,
              source: 'moodle',
              parse_confidence: 'high',
              external_url: quizUrl,
            })
          }
        }
      } catch (err) {
        console.log('sync-moodle: mod_quiz fetch failed:', err)
      }
    }

    // 6c. Sync grade/submission status from Moodle
    // For each course, fetch grade items. Any item with a real grade → mark assignment as 'graded'.
    // Any item with a submission but no grade yet → mark as 'submitted'.
    // Only updates assignments that are currently 'pending' to avoid overwriting user manual changes.
    for (const mc of moodleCourses) {
      const dbCourse = dbCourses?.find(c => c.moodle_course_id === mc.id)
      if (!dbCourse) continue

      try {
        const gradeUrl = moodleUrl(token, 'gradereport_user_get_grade_items', {
          courseid: String(mc.id),
          userid: String(moodleUserId),
        })
        const gradeData = await moodleGet(gradeUrl)
        const gradeItems: { itemname: string | null; graderaw: number | null; grademin: number; grademax: number }[] =
          gradeData?.usergrades?.[0]?.gradeitems || []

        for (const item of gradeItems) {
          if (!item.itemname) continue
          if (item.graderaw === null || item.graderaw === undefined) continue

          // Find matching assignment by title (moodle-sourced or syllabus-sourced)
          const { data: match } = await supabase
            .from('assignments')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('course_id', dbCourse.id)
            .ilike('title', item.itemname)
            .maybeSingle()

          if (match && match.status === 'pending') {
            await supabase
              .from('assignments')
              .update({ status: 'graded' })
              .eq('id', match.id)
          }
        }
      } catch {
        // Non-fatal: grade sync failed for this course
      }
    }

    // 7. Update last_synced_at
    await supabase.from('courses').update({ last_synced_at: new Date().toISOString() }).eq('user_id', user.id)

    return new Response(
      JSON.stringify({ courses_count: moodleCourses.length }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('sync-moodle error:', message)
    // Return 200 so data?.error is populated on the client (not swallowed by FunctionsHttpError)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
