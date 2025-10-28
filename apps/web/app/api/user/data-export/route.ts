import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { getTeamInvoices } from '@/lib/payments/stripe';
import { getTeamDataWithMembers } from '@/lib/db/queries';

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();

    // Collect all user data
    const [userData, activityLogs, teamData, invitations] = await Promise.all([
      // User profile
      supabase.from('users').select('*').eq('id', user.id).single(),
      
      // Activity logs
      supabase.from('activity_logs').select('*').eq('user_id', user.id),
      
      // Team membership
      supabase.from('team_members').select('*, teams(*)').eq('user_id', user.id),
      
      // Invitations
      supabase.from('invitations').select('*').eq('email', user.email).or(`invited_by.eq.${user.id}`),
    ]);

    // Get billing data
    const billingData = teamData ? await getTeamDataWithMembers(user.id) : null;
    
    // Get invoices if team has billing
    const invoices = billingData?.billingSummary?.stripe_customer_id
      ? await getTeamInvoices(billingData.billingSummary.stripe_customer_id)
      : [];

    // Compile export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      activity: activityLogs.data || [],
      teams: teamData.data || [],
      invitations: invitations.data || [],
      billing: {
        customerId: billingData?.billingSummary?.stripe_customer_id || null,
        subscription: billingData?.billingSummary || null,
        invoices: invoices,
      },
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gdpr-export-${user.id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to export user data', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

