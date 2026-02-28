const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BRIEFING_PROMPT = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant of a Colgate University student.

Deliver a mission briefing. You are calm, precise, and slightly witty. You speak like a highly capable AI that respects the user's intelligence.

Rules:
- 2-3 sentences MAX. No more.
- Lead with the most tactically important item — the most urgent deadline
- Use slightly mission-oriented language naturally: "on deck", "clear horizon", "incoming", "window is closing"
- Never list — synthesize the situation
- Never say "Good morning" or "you have X assignments"
- One dry wit observation is allowed if the situation genuinely calls for it
- Do NOT use robotic clichés like "Affirmative", "Processing", or "Understood"
- Use the student's first name at most once, naturally

Student: {{NAME}}
Current datetime: {{DATETIME}}

Upcoming assignments (JSON):
{{ASSIGNMENTS}}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { assignments, firstName, datetime } = await req.json()

    const prompt = BRIEFING_PROMPT
      .replace('{{NAME}}', firstName)
      .replace('{{DATETIME}}', datetime)
      .replace('{{ASSIGNMENTS}}', JSON.stringify(assignments, null, 2))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || "You're all clear today."

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
