import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/session';
import { getTeamInvoices } from '@/lib/payments/stripe';
import { getTeamDataWithMembers } from '@/lib/db/queries';

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get team data
    const teamData = await getTeamDataWithMembers(user.id);

    if (!teamData) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user has permission (owner or admin)
    const isOwnerOrAdmin = teamData.teamMembers.some(
      (member) => member.user.id === user.id && ['owner', 'admin'].includes(member.role)
    );

    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get invoices from Stripe
    const stripeCustomerId = teamData.billingSummary?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    const invoices = await getTeamInvoices(stripeCustomerId);

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Failed to fetch invoices', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

