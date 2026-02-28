import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

async function decryptToken(encryptedHex: string, ivHex: string): Promise<string> {
  const keyBytes = hexToBytes(ENCRYPTION_KEY)
  const iv = hexToBytes(ivHex)
  const encrypted = hexToBytes(encryptedHex)

  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, encrypted)
  return new TextDecoder().decode(decrypted)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const jwt = (req.headers.get('authorization') || '').replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)

    if (authError || !user) throw new Error('Not authenticated')

    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('moodle_token_encrypted, moodle_token_iv')
      .eq('id', user.id)
      .single()

    if (dbError || !userData?.moodle_token_encrypted || !userData?.moodle_token_iv) {
      throw new Error('No Moodle token found. Please reconnect Moodle.')
    }

    const token = await decryptToken(userData.moodle_token_encrypted, userData.moodle_token_iv)

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('decrypt-moodle-token error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
