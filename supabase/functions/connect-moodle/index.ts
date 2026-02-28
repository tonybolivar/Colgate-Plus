import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function encryptToken(token: string): Promise<{ encrypted: string; iv: string }> {
  const keyBytes = hexToBytes(ENCRYPTION_KEY)
  const ivBytes = crypto.getRandomValues(new Uint8Array(16))

  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  )

  const encoded = new TextEncoder().encode(token)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, key, encoded)

  return {
    encrypted: bytesToHex(new Uint8Array(encrypted)),
    iv: bytesToHex(ivBytes),
  }
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    const token: string = body?.token

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)

    if (authError || !user) {
      console.error('Auth error:', authError?.message, 'user:', user)
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const { encrypted, iv } = await encryptToken(token)

    const { error: updateError } = await supabase
      .from('users')
      .upsert({ id: user.id, email: user.email, moodle_token_encrypted: encrypted, moodle_token_iv: iv })
      .eq('id', user.id)

    if (updateError) {
      console.error('DB update error:', updateError.message)
      throw new Error(`Failed to store token: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('connect-moodle error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
