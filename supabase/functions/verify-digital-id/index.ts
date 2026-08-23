// Supabase Edge Function: verify-digital-id
// Deploy with: supabase functions deploy verify-digital-id
//
// This is your "blockchain verify" demo button. It recomputes the hash
// from stored record_data + previous_hash and checks it matches
// current_hash. If someone tampered with the row directly in the DB,
// this will fail — that's the whole tamper-evidence story.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const { digital_id } = await req.json()
    if (!digital_id) {
      return new Response(JSON.stringify({ error: 'digital_id required' }), { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: entry, error } = await supabase
      .from('id_ledger')
      .select('*')
      .eq('digital_id_ref', digital_id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !entry) {
      return new Response(JSON.stringify({ error: 'Ledger entry not found' }), { status: 404 })
    }

    const dataString = JSON.stringify(entry.record_data) + entry.previous_hash
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(dataString))
    const recomputedHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const valid = recomputedHash === entry.current_hash

    return new Response(
      JSON.stringify({
        valid,
        stored_hash: entry.current_hash,
        recomputed_hash: recomputedHash,
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})