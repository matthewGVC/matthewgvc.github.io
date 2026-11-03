/* ============================================================
   DRIVE-TOKEN — hands a signed-in teammate a fresh one-hour Google Drive pass
   (overhaul 9b, migration 0022, assets/js/drive-web.js).

   POST, with the person's workspace session (Authorization: Bearer …):
     { action: 'store', refresh_token }  → keeps the long-lasting permission Google gave at sign-in
     { action: 'mint' }                  → { access_token, expires_in }, or 409 { need: 'consent' }
     { action: 'forget' }                → drops it

   Only active members. The permission lives in google_tokens, which no page can
   read; Google's client secret is the GOOGLE_CLIENT_SECRET secret (Supabase →
   Edge Functions → Secrets, set by Matt), never in the repo. Nothing is logged
   but plain failures.
   ============================================================ */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CLIENT_ID = '537755129990-08phgja5558aa7lifp0mo15c711go2jp.apps.googleusercontent.com';   // public
const ORIGINS = ['https://matthewgvc.github.io', 'http://localhost:8080'];

function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'access-control-allow-headers': 'authorization, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'origin'
  };
}
const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'POST only' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(jwt);
  const user = u && u.user;
  if (!user) return reply(req, 401, { error: 'Sign in again.' });
  const { data: m } = await admin.from('members').select('role').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (!m) return reply(req, 403, { error: 'Not on the team list.' });

  let body: { action?: string; refresh_token?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }

  if (body.action === 'store') {
    if (!body.refresh_token || typeof body.refresh_token !== 'string') return reply(req, 400, { error: 'No permission to keep.' });
    const { error } = await admin.from('google_tokens').upsert({ user_id: user.id, refresh_token: body.refresh_token, updated_at: new Date().toISOString() });
    return error ? reply(req, 500, { error: 'The permission could not be kept.' }) : reply(req, 200, { ok: true });
  }
  if (body.action === 'forget') {
    await admin.from('google_tokens').delete().eq('user_id', user.id);
    return reply(req, 200, { ok: true });
  }
  if (body.action === 'mint') {
    const secret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!secret) return reply(req, 503, { error: 'Drive through Google isn\'t set up yet (the server key is missing).' });
    const { data: t } = await admin.from('google_tokens').select('refresh_token').eq('user_id', user.id).maybeSingle();
    if (!t) return reply(req, 409, { need: 'consent' });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: secret, refresh_token: t.refresh_token })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      // withdrawn or expired: forget it, so the next sign-in asks again
      if (j.error === 'invalid_grant') { await admin.from('google_tokens').delete().eq('user_id', user.id); return reply(req, 409, { need: 'consent' }); }
      return reply(req, 502, { error: 'Google didn\'t give a Drive pass. Try again in a minute.' });
    }
    return reply(req, 200, { access_token: j.access_token, expires_in: j.expires_in || 3600 });
  }
  return reply(req, 400, { error: 'Unknown action.' });
});
