import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PARSE_PROMPT = `You are parsing a university course syllabus. Extract every assignment, exam, quiz, project, paper, and graded deadline.

Return ONLY valid JSON — no markdown, no explanation, no backticks:
{
  "assignments": [
    {
      "title": "string",
      "due_date": "YYYY-MM-DD or null if unclear",
      "due_time": "HH:MM or null",
      "type": "homework|exam|project|reading|quiz|other",
      "platform": "gradescope|moodle|in-class|unknown",
      "points": number or null,
      "notes": "string or null",
      "confidence": "high|medium|low"
    }
  ]
}

Rules:
- Include ALL graded items — do not skip anything
- If a due date is ambiguous or relative (e.g. "Week 3"), set due_date null and explain in notes
- Set confidence "low" for any date you are not certain about
- Course name for context: {{COURSE_NAME}}`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify the caller is an authenticated user
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { syllabus_id, user_id, file_path, course_name } = await req.json()

    // Download syllabus from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('syllabi')
      .download(file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download syllabus: ${downloadError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    const base64 = btoa(binary)

    // Call Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: PARSE_PROMPT.replace('{{COURSE_NAME}}', course_name),
            },
          ],
        }],
      }),
    })

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.text || ''

    // Parse JSON response
    const clean = rawText.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    const assignments = parsed.assignments || []

    // Get course ID
    const { data: syllabus } = await supabase
      .from('syllabi')
      .select('course_id')
      .eq('id', syllabus_id)
      .single()

    if (!syllabus) throw new Error('Syllabus record not found')

    // Insert assignments
    if (assignments.length > 0) {
      const rows = assignments.map((a: Record<string, unknown>) => ({
        user_id,
        course_id: syllabus.course_id,
        title: a.title,
        due_date: a.due_date || null,
        due_time: a.due_time || null,
        type: a.type || 'other',
        platform: a.platform || 'unknown',
        points: a.points || null,
        notes: a.notes || null,
        parse_confidence: a.confidence || 'medium',
        source: 'syllabus',
      }))

      await supabase.from('assignments').insert(rows)
    }

    // Update syllabus record
    await supabase.from('syllabi').update({
      parsed_at: new Date().toISOString(),
      raw_claude_response: parsed,
    }).eq('id', syllabus_id)

    // Mark course as parsed
    await supabase.from('courses').update({
      syllabus_parsed: true,
    }).eq('id', syllabus.course_id)

    return new Response(JSON.stringify({ success: true, count: assignments.length }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
