export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_edges: {
        Row: {
          created_at: string
          id: string
          relationship: string
          source_schema_id: string
          target_schema_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relationship: string
          source_schema_id: string
          target_schema_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relationship?: string
          source_schema_id?: string
          target_schema_id?: string
        }
        Relationships: []
      }
      graph_nodes: {
        Row: {
          created_at: string
          id: string
          label: string | null
          node_type: string | null
          page_id: string | null
          schema_id: string
          site: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          node_type?: string | null
          page_id?: string | null
          schema_id: string
          site?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          node_type?: string | null
          page_id?: string | null
          schema_id?: string
          site?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graph_nodes_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          beer_abv: number | null
          beer_launch_year: number | null
          beer_official_url: string | null
          beer_style: string | null
          category: string | null
          created_at: string
          created_by_user_id: string | null
          discovered_at: string | null
          domain: string
          faq_mode: string
          has_faq: boolean
          hero_image_url: string | null
          id: string
          is_home_page: boolean
          last_crawled_at: string | null
          last_html_hash: string | null
          last_modified_by_user_id: string | null
          last_schema_generated_at: string | null
          last_schema_hash: string | null
          logo_url: string | null
          notes: string | null
          page_type: string | null
          path: string
          priority: number | null
          section: string | null
          status: Database["public"]["Enums"]["page_status"]
          updated_at: string
        }
        Insert: {
          beer_abv?: number | null
          beer_launch_year?: number | null
          beer_official_url?: string | null
          beer_style?: string | null
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          discovered_at?: string | null
          domain?: string
          faq_mode?: string
          has_faq?: boolean
          hero_image_url?: string | null
          id?: string
          is_home_page?: boolean
          last_crawled_at?: string | null
          last_html_hash?: string | null
          last_modified_by_user_id?: string | null
          last_schema_generated_at?: string | null
          last_schema_hash?: string | null
          logo_url?: string | null
          notes?: string | null
          page_type?: string | null
          path: string
          priority?: number | null
          section?: string | null
          status?: Database["public"]["Enums"]["page_status"]
          updated_at?: string
        }
        Update: {
          beer_abv?: number | null
          beer_launch_year?: number | null
          beer_official_url?: string | null
          beer_style?: string | null
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          discovered_at?: string | null
          domain?: string
          faq_mode?: string
          has_faq?: boolean
          hero_image_url?: string | null
          id?: string
          is_home_page?: boolean
          last_crawled_at?: string | null
          last_html_hash?: string | null
          last_modified_by_user_id?: string | null
          last_schema_generated_at?: string | null
          last_schema_hash?: string | null
          logo_url?: string | null
          notes?: string | null
          page_type?: string | null
          path?: string
          priority?: number | null
          section?: string | null
          status?: Database["public"]["Enums"]["page_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_last_modified_by_user_id_fkey"
            columns: ["last_modified_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          is_active: boolean
          name: string
          page_type: string | null
          rules_backup: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          page_type?: string | null
          rules_backup?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          page_type?: string | null
          rules_backup?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_versions: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          google_rr_passed: boolean
          id: string
          jsonld: string
          page_id: string
          rules_id: string | null
          status: Database["public"]["Enums"]["schema_version_status"]
          validation_notes: string | null
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          google_rr_passed?: boolean
          id?: string
          jsonld: string
          page_id: string
          rules_id?: string | null
          status?: Database["public"]["Enums"]["schema_version_status"]
          validation_notes?: string | null
          version_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          google_rr_passed?: boolean
          id?: string
          jsonld?: string
          page_id?: string
          rules_id?: string | null
          status?: Database["public"]["Enums"]["schema_version_status"]
          validation_notes?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "schema_versions_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_versions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_versions_rules_id_fkey"
            columns: ["rules_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          canonical_base_url: string
          created_at: string
          fetch_base_url: string
          id: string
          preview_auth_password: string | null
          preview_auth_user: string | null
          schema_engine_version: string
          sitemap_url: string | null
          updated_at: string
        }
        Insert: {
          canonical_base_url?: string
          created_at?: string
          fetch_base_url?: string
          id?: string
          preview_auth_password?: string | null
          preview_auth_user?: string | null
          schema_engine_version?: string
          sitemap_url?: string | null
          updated_at?: string
        }
        Update: {
          canonical_base_url?: string
          created_at?: string
          fetch_base_url?: string
          id?: string
          preview_auth_password?: string | null
          preview_auth_user?: string | null
          schema_engine_version?: string
          sitemap_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          last_login_at: string | null
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          last_login_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      page_status:
        | "not_started"
        | "ai_draft"
        | "needs_review"
        | "approved"
        | "implemented"
        | "needs_rework"
        | "removed_from_sitemap"
      schema_version_status: "draft" | "approved" | "deprecated" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      page_status: [
        "not_started",
        "ai_draft",
        "needs_review",
        "approved",
        "implemented",
        "needs_rework",
        "removed_from_sitemap",
      ],
      schema_version_status: ["draft", "approved", "deprecated", "rejected"],
    },
  },
} as const
