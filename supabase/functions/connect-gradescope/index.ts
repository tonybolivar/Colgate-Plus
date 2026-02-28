import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!
const GS_BASE = 'https://www.gradescope.com'

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function encryptValue(value: string): Promise<{ encrypted: string; iv: string }> {
  const key = await crypto.subtle.importKey('raw', hexToBytes(ENCRYPTION_KEY), { name: 'AES-CBC' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(value))
  return { encrypted: bytesToHex(new Uint8Array(encrypted)), iv: bytesToHex(iv) }
}

// ── Verify credentials ────────────────────────────────────────────────────────

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

async function verifyLogin(email: string, password: string): Promise<boolean> {
  const jar: CookieJar = {}
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  const homeRes = await fetch(GS_BASE, { headers: { 'User-Agent': UA } })
  mergeCookies(jar, homeRes)
  const homeHtml = await homeRes.text()

  const m =
    homeHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
    homeHtml.match(/value="([^"]+)"[^>]*name="authenticity_token"/)
  if (!m) throw new Error('Could not reach Gradescope — try again later')

  const body = new URLSearchParams({
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
    body: body.toString(),
    redirect: 'manual',
  })

  // Success → 302 to /account (or /). Failure → 302 back to /login
  if (loginRes.status !== 302) return false
  const location = loginRes.headers.get('location') || ''
  return !location.includes('/login')
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) throw new Error('Unauthorized')

    const { password } = await req.json()
    if (!password?.trim()) throw new Error('Password required')

    const ok = await verifyLogin(user.email!, password)
    if (!ok) throw new Error('Invalid Gradescope credentials — check your password and try again')

    const { encrypted, iv } = await encryptValue(password)
    const { error: dbError } = await supabase.from('users').update({
      gradescope_password_encrypted: encrypted,
      gradescope_password_iv: iv,
      gradescope_connected: true,
    }).eq('id', user.id)
    if (dbError) throw new Error(`Failed to save credentials: ${dbError.message}`)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
