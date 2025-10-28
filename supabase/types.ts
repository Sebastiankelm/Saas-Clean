export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          name: string | null;
          email: string;
          password_hash: string;
          role: 'owner' | 'admin' | 'member';
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          email: string;
          password_hash: string;
          role?: 'owner' | 'admin' | 'member';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          email?: string;
          password_hash?: string;
          role?: 'owner' | 'admin' | 'member';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: number;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: number;
          user_id: number;
          team_id: number;
          role: 'owner' | 'admin' | 'member';
          joined_at: string;
        };
        Insert: {
          id?: number;
          user_id: number;
          team_id: number;
          role: 'owner' | 'admin' | 'member';
          joined_at?: string;
        };
        Update: {
          id?: number;
          user_id?: number;
          team_id?: number;
          role?: 'owner' | 'admin' | 'member';
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      activity_logs: {
        Row: {
          id: number;
          team_id: number;
          user_id: number | null;
          action: string;
          occurred_at: string;
          ip_address: string | null;
        };
        Insert: {
          id?: number;
          team_id: number;
          user_id?: number | null;
          action: string;
          occurred_at?: string;
          ip_address?: string | null;
        };
        Update: {
          id?: number;
          team_id?: number;
          user_id?: number | null;
          action?: string;
          occurred_at?: string;
          ip_address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_logs_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_logs_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      invitations: {
        Row: {
          id: number;
          team_id: number;
          email: string;
          role: 'owner' | 'admin' | 'member';
          invited_by: number;
          invited_at: string;
          status: 'pending' | 'accepted' | 'revoked';
        };
        Insert: {
          id?: number;
          team_id: number;
          email: string;
          role: 'owner' | 'admin' | 'member';
          invited_by: number;
          invited_at?: string;
          status?: 'pending' | 'accepted' | 'revoked';
        };
        Update: {
          id?: number;
          team_id?: number;
          email?: string;
          role?: 'owner' | 'admin' | 'member';
          invited_by?: number;
          invited_at?: string;
          status?: 'pending' | 'accepted' | 'revoked';
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_invited_by_fkey';
            columns: ['invited_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          }
        ];
      };
      billing_customers: {
        Row: {
          id: number;
          team_id: number;
          stripe_customer_id: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          team_id: number;
          stripe_customer_id: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          team_id?: number;
          stripe_customer_id?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_customers_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          }
        ];
      };
      subscriptions: {
        Row: {
          id: number;
          team_id: number;
          stripe_subscription_id: string;
          status: string;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          plan_name: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          team_id: number;
          stripe_subscription_id: string;
          status: string;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          plan_name?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          team_id?: number;
          stripe_subscription_id?: string;
          status?: string;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          plan_name?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          }
        ];
      };
      function_logs: {
        Row: {
          id: number;
          function_name: string;
          task_name: string;
          status: 'success' | 'failure';
          message: string;
          metadata: Json | null;
          triggered_by: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          function_name: string;
          task_name: string;
          status: 'success' | 'failure';
          message: string;
          metadata?: Json | null;
          triggered_by?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          function_name?: string;
          task_name?: string;
          status?: 'success' | 'failure';
          message?: string;
          metadata?: Json | null;
          triggered_by?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'function_logs_triggered_by_fkey';
            columns: ['triggered_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      team_memberships_mv: {
        Row: {
          team_id: number;
          user_id: number;
          role: 'owner' | 'admin' | 'member';
          team_name: string;
        };
        Relationships: [];
      };
      team_billing_mv: {
        Row: {
          team_id: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          plan_name: string | null;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      refresh_team_views: {
        Args: Record<string, never>;
        Returns: void;
      };
      current_app_user_id: {
        Args: Record<string, never>;
        Returns: number | null;
      };
      current_app_user_role: {
        Args: { p_team_id: number };
        Returns: 'owner' | 'admin' | 'member' | null;
      };
    };
    Enums: {};
  };
}
