import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import type { Database } from '../../types.ts';

type RoleActionPayload = {
  action: 'update_role' | 'remove_member';
  team_id: number;
  member_id: number;
  role?: 'owner' | 'admin' | 'member';
  actor_id: number;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase environment variables are not configured.');
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function ensureActorCanManage(teamId: number, actorId: number) {
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', actorId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !['owner', 'admin'].includes(data.role)) {
    throw new Error('Insufficient permissions.');
  }

  return data.role;
}

async function ensureOwnerPresence(teamId: number, memberId: number, newRole?: 'owner' | 'admin' | 'member') {
  const { data: member, error: memberError } = await supabase
    .from('team_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('team_id', teamId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error('Team member not found.');
  }

  if (member.role !== 'owner') {
    return;
  }

  if (newRole && newRole === 'owner') {
    return;
  }

  const { data: owners, error: ownersError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('role', 'owner');

  if (ownersError) {
    throw new Error(ownersError.message);
  }

  if (!owners || owners.length <= 1) {
    throw new Error('Cannot remove the last owner from the team.');
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: RoleActionPayload;
  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { action, team_id, member_id, role, actor_id } = payload;
  if (!action || !team_id || !member_id || !actor_id) {
    return new Response(
      JSON.stringify({ error: 'action, team_id, member_id and actor_id are required.' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  try {
    await ensureActorCanManage(team_id, actor_id);

    switch (action) {
      case 'update_role': {
        if (!role) {
          throw new Error('role is required for update_role.');
        }

        await ensureOwnerPresence(team_id, member_id, role);

        const { error: updateError } = await supabase
          .from('team_members')
          .update({ role })
          .eq('id', member_id)
          .eq('team_id', team_id);

        if (updateError) {
          throw new Error(updateError.message);
        }
        break;
      }
      case 'remove_member': {
        await ensureOwnerPresence(team_id, member_id);

        const { error: deleteError } = await supabase
          .from('team_members')
          .delete()
          .eq('id', member_id)
          .eq('team_id', team_id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }
        break;
      }
      default:
        throw new Error('Unsupported action.');
    }

    await supabase.rpc('refresh_team_views');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
