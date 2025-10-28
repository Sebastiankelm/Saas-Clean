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
          role?: 'owner' | 'admin' | 'member';
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
      team_memberships_mv: {
        Row: {
          team_id: number | null;
          user_id: number | null;
          role: 'owner' | 'admin' | 'member' | null;
          team_name: string | null;
        };
        Relationships: [];
      };
      team_billing_mv: {
        Row: {
          team_id: number | null;
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
    Views: {
      [_ in never]: never;
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
        Args: {
          p_team_id: number;
        };
        Returns: string | null;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  admin: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          app_user_id: number | null;
          display_name: string | null;
          avatar_url: string | null;
          preferences: Json;
          locale: string;
          timezone: string;
          is_active: boolean;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          app_user_id?: number | null;
          display_name?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          locale?: string;
          timezone?: string;
          is_active?: boolean;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          app_user_id?: number | null;
          display_name?: string | null;
          avatar_url?: string | null;
          preferences?: Json;
          locale?: string;
          timezone?: string;
          is_active?: boolean;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          rank: number;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          rank: number;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          rank?: number;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          permission_key: string;
          name: string;
          description: string | null;
          resource_type: string;
          resource_identifier: string | null;
          action: string;
          scope: Json;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          permission_key: string;
          name: string;
          description?: string | null;
          resource_type: string;
          resource_identifier?: string | null;
          action: string;
          scope?: Json;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          permission_key?: string;
          name?: string;
          description?: string | null;
          resource_type?: string;
          resource_identifier?: string | null;
          action?: string;
          scope?: Json;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permission_groups: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permission_group_permissions: {
        Row: {
          group_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          permission_id: string;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          permission_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'permission_group_permissions_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'permission_groups';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'permission_group_permissions_permission_id_fkey';
            columns: ['permission_id'];
            referencedRelation: 'permissions';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      roles_permission_groups: {
        Row: {
          role_id: string;
          group_id: string;
          created_at: string;
        };
        Insert: {
          role_id: string;
          group_id: string;
          created_at?: string;
        };
        Update: {
          role_id?: string;
          group_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roles_permission_groups_role_id_fkey';
            columns: ['role_id'];
            referencedRelation: 'roles';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'roles_permission_groups_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'permission_groups';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
          created_at?: string;
        };
        Update: {
          role_id?: string;
          permission_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            referencedRelation: 'roles';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'role_permissions_permission_id_fkey';
            columns: ['permission_id'];
            referencedRelation: 'permissions';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          team_id: number | null;
          assigned_by: string | null;
          assigned_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          team_id?: number | null;
          assigned_by?: string | null;
          assigned_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          team_id?: number | null;
          assigned_by?: string | null;
          assigned_at?: string;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_assigned_by_fkey';
            columns: ['assigned_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey';
            columns: ['role_id'];
            referencedRelation: 'roles';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'user_roles_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
            schema: 'public';
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      saved_views: {
        Row: {
          id: string;
          owner_user_id: string;
          team_id: number | null;
          name: string;
          description: string | null;
          resource_type: string;
          visibility: 'private' | 'team' | 'public';
          filters: Json;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          team_id?: number | null;
          name: string;
          description?: string | null;
          resource_type: string;
          visibility?: 'private' | 'team' | 'public';
          filters?: Json;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          team_id?: number | null;
          name?: string;
          description?: string | null;
          resource_type?: string;
          visibility?: 'private' | 'team' | 'public';
          filters?: Json;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_views_owner_user_id_fkey';
            columns: ['owner_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'saved_views_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
            schema: 'public';
          }
        ];
      };
      audit_log: {
        Row: {
          id: number;
          actor_user_id: string | null;
          event_type: string;
          resource_type: string;
          resource_identifier: string | null;
          previous_values: Json | null;
          new_values: Json | null;
          metadata: Json | null;
          ip_address: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          actor_user_id?: string | null;
          event_type: string;
          resource_type: string;
          resource_identifier?: string | null;
          previous_values?: Json | null;
          new_values?: Json | null;
          metadata?: Json | null;
          ip_address?: string | null;
          occurred_at?: string;
        };
        Update: {
          id?: number;
          actor_user_id?: string | null;
          event_type?: string;
          resource_type?: string;
          resource_identifier?: string | null;
          previous_values?: Json | null;
          new_values?: Json | null;
          metadata?: Json | null;
          ip_address?: string | null;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_user_id_fkey';
            columns: ['actor_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      feature_flags: {
        Row: {
          id: string;
          flag_key: string;
          description: string | null;
          is_enabled: boolean;
          targeting_rules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flag_key: string;
          description?: string | null;
          is_enabled?: boolean;
          targeting_rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flag_key?: string;
          description?: string | null;
          is_enabled?: boolean;
          targeting_rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_admin_user_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      has_permission: {
        Args: {
          p_permission_key: string;
        };
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  cms: {
    Tables: {
      collections: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          icon: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          is_singleton: boolean;
          default_locale: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          is_singleton?: boolean;
          default_locale?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          is_singleton?: boolean;
          default_locale?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collections_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      fields: {
        Row: {
          id: string;
          collection_id: string;
          field_key: string;
          label: string;
          field_type: string;
          description: string | null;
          config: Json;
          is_required: boolean;
          is_unique: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          field_key: string;
          label: string;
          field_type: string;
          description?: string | null;
          config?: Json;
          is_required?: boolean;
          is_unique?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          field_key?: string;
          label?: string;
          field_type?: string;
          description?: string | null;
          config?: Json;
          is_required?: boolean;
          is_unique?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fields_collection_id_fkey';
            columns: ['collection_id'];
            referencedRelation: 'collections';
            referencedColumns: ['id'];
            schema: 'cms';
          }
        ];
      };
      entries: {
        Row: {
          id: string;
          collection_id: string;
          status: 'draft' | 'review' | 'published' | 'archived';
          locale: string;
          slug: string | null;
          title: string | null;
          data: Json;
          published_at: string | null;
          archived_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          status?: 'draft' | 'review' | 'published' | 'archived';
          locale?: string;
          slug?: string | null;
          title?: string | null;
          data?: Json;
          published_at?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          status?: 'draft' | 'review' | 'published' | 'archived';
          locale?: string;
          slug?: string | null;
          title?: string | null;
          data?: Json;
          published_at?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entries_collection_id_fkey';
            columns: ['collection_id'];
            referencedRelation: 'collections';
            referencedColumns: ['id'];
            schema: 'cms';
          },
          {
            foreignKeyName: 'entries_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'entries_updated_by_fkey';
            columns: ['updated_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
      entry_versions: {
        Row: {
          id: number;
          entry_id: string;
          version_number: number;
          snapshot: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          entry_id: string;
          version_number: number;
          snapshot: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          entry_id?: string;
          version_number?: number;
          snapshot?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entry_versions_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'entry_versions_entry_id_fkey';
            columns: ['entry_id'];
            referencedRelation: 'entries';
            referencedColumns: ['id'];
            schema: 'cms';
          }
        ];
      };
      media: {
        Row: {
          id: string;
          collection_id: string | null;
          title: string | null;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id?: string | null;
          title?: string | null;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string | null;
          title?: string | null;
          file_name?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_collection_id_fkey';
            columns: ['collection_id'];
            referencedRelation: 'collections';
            referencedColumns: ['id'];
            schema: 'cms';
          },
          {
            foreignKeyName: 'media_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      log_entry_version: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  dashboards: {
    Tables: {
      dashboards: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          owner_user_id: string | null;
          visibility: 'private' | 'team' | 'public';
          team_id: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          owner_user_id?: string | null;
          visibility?: 'private' | 'team' | 'public';
          team_id?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          owner_user_id?: string | null;
          visibility?: 'private' | 'team' | 'public';
          team_id?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dashboards_owner_user_id_fkey';
            columns: ['owner_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          },
          {
            foreignKeyName: 'dashboards_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
            schema: 'public';
          }
        ];
      };
      dashboard_widgets: {
        Row: {
          id: string;
          dashboard_id: string;
          widget_key: string;
          widget_type: string;
          config: Json;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dashboard_id: string;
          widget_key: string;
          widget_type: string;
          config?: Json;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dashboard_id?: string;
          widget_key?: string;
          widget_type?: string;
          config?: Json;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dashboard_widgets_dashboard_id_fkey';
            columns: ['dashboard_id'];
            referencedRelation: 'dashboards';
            referencedColumns: ['id'];
            schema: 'dashboards';
          }
        ];
      };
      widget_layouts: {
        Row: {
          id: string;
          dashboard_id: string;
          user_id: string | null;
          viewport: string;
          layout: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dashboard_id: string;
          user_id?: string | null;
          viewport?: string;
          layout?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dashboard_id?: string;
          user_id?: string | null;
          viewport?: string;
          layout?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'widget_layouts_dashboard_id_fkey';
            columns: ['dashboard_id'];
            referencedRelation: 'dashboards';
            referencedColumns: ['id'];
            schema: 'dashboards';
          },
          {
            foreignKeyName: 'widget_layouts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            schema: 'admin';
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
