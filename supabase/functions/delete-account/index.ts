// Supabase Edge Function: delete-account
//
// Account deletion has to remove the `auth.users` row, which the client cannot
// do (and must not be able to). The service role key lives only here.
//
// The function takes no body: it deletes the caller identified by their own
// access token, so it cannot be used to delete somebody else's account.
//
// Deploy:
//   supabase functions deploy delete-account
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to
// every Edge Function by the Supabase runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in is required.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json({ error: 'The service is not configured.' }, 503);
  }

  // Identify the caller from their own token. Never trust a user id in the body.
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller.user) return json({ error: 'Sign in is required.' }, 401);

  const admin = createClient(url, serviceKey);
  const userId = caller.user.id;

  // Remove the avatar first: the profile row that references it is deleted by
  // the cascade from auth.users.
  const { data: files } = await admin.storage.from('avatars').list(userId);
  if (files && files.length > 0) {
    await admin.storage.from('avatars').remove(files.map((file) => `${userId}/${file.name}`));
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // Logged, not returned: the raw message can name internal details.
    console.error('delete-account failed', deleteError.message);
    return json({ error: 'The account could not be deleted.' }, 500);
  }

  return json({ deleted: true }, 200);
});
