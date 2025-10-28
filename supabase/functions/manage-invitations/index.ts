import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import type { Database } from '../../types.ts';

type InvitationPayload = {
  team_id: number;
  email: string;
  role: 'owner' | 'admin' | 'member';
  invited_by: number;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase environment variables are not configured.');
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: InvitationPayload;
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { team_id, email, role, invited_by } = payload;
  if (!team_id || !email || !role || !invited_by) {
    return new Response(
      JSON.stringify({ error: 'team_id, email, role and invited_by are required.' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const { data: inviterMembership, error: membershipError } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', team_id)
    .eq('user_id', invited_by)
    .maybeSingle();

  if (membershipError) {
    return new Response(JSON.stringify({ error: membershipError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!inviterMembership || !['owner', 'admin'].includes(inviterMembership.role)) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data: existingUser, error: userLookupError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (userLookupError) {
    return new Response(JSON.stringify({ error: userLookupError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (existingUser) {
    const { data: memberRecord, error: membershipLookupError } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    if (membershipLookupError) {
      return new Response(JSON.stringify({ error: membershipLookupError.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (memberRecord) {
      return new Response(
        JSON.stringify({ error: 'User is already a member of this team.' }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      );
    }
  }

  const { data: duplicateInvitation, error: duplicateError } = await supabase
    .from('invitations')
    .select('id')
    .eq('team_id', team_id)
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (duplicateError) {
    return new Response(JSON.stringify({ error: duplicateError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (duplicateInvitation) {
    return new Response(
      JSON.stringify({ error: 'An invitation has already been sent to this email.' }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    );
  }

  const { data: invitation, error: insertError } = await supabase
    .from('invitations')
    .insert({
      team_id,
      email,
      role,
      invited_by,
      status: 'pending',
    })
    .select('id, invited_at')
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ invitation }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
