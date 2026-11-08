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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      buffer_connections: {
        Row: {
          access_token: string
          buffer_account_id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          buffer_account_id: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          buffer_account_id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_snapshots: {
        Row: {
          buffer_account_id: string
          cooldown_until: string | null
          lock_until: string | null
          refresh_id: string | null
          snapshot: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          buffer_account_id: string
          cooldown_until?: string | null
          lock_until?: string | null
          refresh_id?: string | null
          snapshot?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          buffer_account_id?: string
          cooldown_until?: string | null
          lock_until?: string | null
          refresh_id?: string | null
          snapshot?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      magic_caption_usage: {
        Row: {
          usage_date: string
          user_id: string
          uses: number
        }
        Insert: {
          usage_date: string
          user_id: string
          uses?: number
        }
        Update: {
          usage_date?: string
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      media_cleanup_claims: {
        Row: {
          claimed_at: string
          path: string
        }
        Insert: {
          claimed_at?: string
          path: string
        }
        Update: {
          claimed_at?: string
          path?: string
        }
        Relationships: []
      }
      media_references: {
        Row: {
          buffer_id: string
          created_at: string
          id: string
          kind: string
          path: string
          user_id: string
        }
        Insert: {
          buffer_id: string
          created_at?: string
          id?: string
          kind: string
          path: string
          user_id: string
        }
        Update: {
          buffer_id?: string
          created_at?: string
          id?: string
          kind?: string
          path?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          state: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at?: string
          state: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          state?: string
        }
        Relationships: []
      }
      photo_usage: {
        Row: {
          kind: string
          usage_date: string
          user_id: string
          uses: number
        }
        Insert: {
          kind: string
          usage_date: string
          user_id: string
          uses?: number
        }
        Update: {
          kind?: string
          usage_date?: string
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          default_channel_id: string | null
          magic_style: string
          time_zone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          default_channel_id?: string | null
          magic_style?: string
          time_zone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          default_channel_id?: string | null
          magic_style?: string
          time_zone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_dashboard_refresh: {
        Args: { p_account_id: string; p_refresh_id: string; p_user_id: string }
        Returns: boolean
      }
      claim_unused_media: {
        Args: never
        Returns: {
          path: string
        }[]
      }
      magic_caption_left: { Args: { p_user_id: string }; Returns: number }
      media_usage_bytes: { Args: { p_user_id: string }; Returns: number }
      photo_usage_left: {
        Args: { p_kind: string; p_user_id: string }
        Returns: number
      }
      protect_media_save: {
        Args: { p_operation: string; p_paths: string[]; p_user_id: string }
        Returns: undefined
      }
      refund_magic_caption_use: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      refund_photo_use: {
        Args: { p_kind: string; p_user_id: string }
        Returns: undefined
      }
      release_media_references: {
        Args: { p_buffer_id: string }
        Returns: {
          path: string
        }[]
      }
      try_magic_caption_use: { Args: { p_user_id: string }; Returns: string }
      try_photo_use: {
        Args: { p_kind: string; p_user_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
