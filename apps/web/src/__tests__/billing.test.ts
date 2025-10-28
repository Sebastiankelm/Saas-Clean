import { describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/db/client', () => ({
  getSupabaseAdminClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

describe('billing summaries', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('merges team metadata with billing snapshot', async () => {
    const summaryRecord = {
      team_id: 21,
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_456',
      subscription_status: 'active',
      plan_name: 'Pro',
      stripe_product_id: 'prod_789',
      stripe_price_id: 'price_321',
    };

    const teamRecord = {
      id: 21,
      name: 'Example Org',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'team_billing_mv') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: summaryRecord, error: null }),
            }),
          }),
        };
      }

      if (table === 'teams') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: teamRecord, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { getTeamByStripeCustomerId } = await import('@/lib/db/queries');

    const result = await getTeamByStripeCustomerId('cus_123');

    expect(result?.id).toBe(teamRecord.id);
    expect(result?.name).toBe(teamRecord.name);
    expect(result?.billingSummary).toMatchObject({
      stripe_customer_id: summaryRecord.stripe_customer_id,
      subscription_status: summaryRecord.subscription_status,
    });
  });
});
