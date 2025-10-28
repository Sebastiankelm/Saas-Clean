import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/db/client', () => ({
  getSupabaseAdminClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

describe('organization management', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes subscriptions when billing is cancelled', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          delete: () => ({ eq: eqMock }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { updateTeamSubscription } = await import('@/lib/db/queries');

    await updateTeamSubscription(10, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      stripePriceId: null,
      planName: null,
      subscriptionStatus: 'canceled',
      currentPeriodEnd: null,
    });

    expect(eqMock).toHaveBeenCalledWith('team_id', 10);
    expect(rpcMock).toHaveBeenCalledWith('refresh_team_views');
  });
});
