import type { Database } from '../../../../supabase/types';

export type User = Database['public']['Tables']['users']['Row'];
export type NewUser = Database['public']['Tables']['users']['Insert'];
export type UpdateUser = Database['public']['Tables']['users']['Update'];

export type Team = Database['public']['Tables']['teams']['Row'];
export type NewTeam = Database['public']['Tables']['teams']['Insert'];
export type UpdateTeam = Database['public']['Tables']['teams']['Update'];

export type TeamMember = Database['public']['Tables']['team_members']['Row'];
export type NewTeamMember = Database['public']['Tables']['team_members']['Insert'];
export type UpdateTeamMember = Database['public']['Tables']['team_members']['Update'];

export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type NewActivityLog = Database['public']['Tables']['activity_logs']['Insert'];

export type Invitation = Database['public']['Tables']['invitations']['Row'];
export type NewInvitation = Database['public']['Tables']['invitations']['Insert'];

export type BillingCustomer = Database['public']['Tables']['billing_customers']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];

export type TeamMembershipSummary = Database['public']['Views']['team_memberships_mv']['Row'];
export type TeamBillingSummary = Database['public']['Views']['team_billing_mv']['Row'];

export type TeamMemberWithUser = TeamMember & {
  user: Pick<User, 'id' | 'name' | 'email'>;
};

export type TeamDataWithMembers = Team & {
  teamMembers: TeamMemberWithUser[];
  billingSummary: TeamBillingSummary | null;
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
