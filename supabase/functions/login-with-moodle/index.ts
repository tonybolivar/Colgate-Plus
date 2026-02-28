import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createCipheriv, createHmac, randomBytes } from 'node:crypto'

const MOODLE_BASE_URL = 'https://moodle.colgate.edu'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function encryptToken(token: string): { encrypted: string; iv: string } {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex') }
}

// Derives a deterministic Supabase password from the username.
// This is not the user's real password — it's a server-side token used only for Supabase auth.
function getDerivedPassword(username: string): string {
  return createHmac('sha256', Buffer.from(ENCRYPTION_KEY, 'hex'))
    .update(username.toLowerCase())
    .digest('hex')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { username, password } = await req.json()

    // 1. Validate against Moodle
    const params = new URLSearchParams({ username, password, service: 'moodle_mobile_app' })
    const moodleRes = await fetch(`${MOODLE_BASE_URL}/login/token.php`, {
      method: 'POST',
      body: params,
    })
    const moodleData = await moodleRes.json()

    if (moodleData.error || !moodleData.token) {
      return new Response(
        JSON.stringify({ error: 'Invalid Colgate credentials. Check your username and password.' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const email = `${username.toLowerCase()}@colgate.edu`
    const derivedPassword = getDerivedPassword(username)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2. Create Supabase user if not exists
    let userId: string

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: derivedPassword,
      email_confirm: true,
    })

    if (!createError && createData?.user) {
      userId = createData.user.id
    } else if (createError) {
      // User likely already exists — find them
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const existing = listData?.users?.find((u) => u.email === email)
      if (!existing) throw new Error('Failed to find or create user account')
      userId = existing.id
    } else {
      throw new Error('Unexpected error creating user')
    }

    // 3. Encrypt and upsert Moodle token
    const { encrypted, iv } = encryptToken(moodleData.token)
    await supabase.from('users').upsert({
      id: userId,
      email,
      moodle_token_encrypted: encrypted,
      moodle_token_iv: iv,
    }, { onConflict: 'id' })

    // 4. Check onboarding status
    const { data: userData } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', userId)
      .single()

    return new Response(
      JSON.stringify({
        email,
        session_key: derivedPassword,
        onboarding_complete: userData?.onboarding_complete ?? false,
      }),
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
