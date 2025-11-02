export type Json = 
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray

export interface JsonObject {
  [key: string]: Json | undefined
}

export interface JsonArray extends Array<Json> {}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_size: number
          filename: string
          id: string
          mime_type: string
          original_name: string
          storage_path: string
          updated_at: string
          user_id: string
          metadata: Json | null
          content: string | null
          processing_status: string | null
          character_count: number | null
          word_count: number | null
          total_chunks: number | null
          processed_chunks: number | null
          processed_at: string | null
          upload_ip: string | null
          user_agent: string | null
          title: string | null
          chunk_count: number
          status: Database["public"]["Enums"]["document_status"]
          needs_ocr: boolean
          status_message: string | null
          error_message: string | null
          processing_started_at: string | null
          processing_completed_at: string | null
        }
        Insert: {
          created_at?: string
          file_size: number
          filename: string
          id?: string
          mime_type: string
          original_name: string
          storage_path: string
          updated_at?: string
          user_id: string
          metadata?: Json | null
          content?: string | null
          processing_status?: string | null
          character_count?: number | null
          word_count?: number | null
          total_chunks?: number | null
          processed_chunks?: number | null
          processed_at?: string | null
          upload_ip?: string | null
          user_agent?: string | null
          title?: string | null
          chunk_count?: number
          status?: Database["public"]["Enums"]["document_status"]
          needs_ocr?: boolean
          status_message?: string | null
          error_message?: string | null
          processing_started_at?: string | null
          processing_completed_at?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          original_name?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
          metadata?: Json | null
          content?: string | null
          processing_status?: string | null
          character_count?: number | null
          word_count?: number | null
          total_chunks?: number | null
          processed_chunks?: number | null
          processed_at?: string | null
          upload_ip?: string | null
          user_agent?: string | null
          title?: string | null
          chunk_count?: number
          status?: Database["public"]["Enums"]["document_status"]
          needs_ocr?: boolean
          status_message?: string | null
          error_message?: string | null
          processing_started_at?: string | null
          processing_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          id: string
          document_id: string
          content: string
          embedding: string  // vector(384)
          chunk_index: number
          token_count: number
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          embedding: string  // vector(384)
          chunk_index: number
          token_count: number
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          content?: string
          embedding?: string  // vector(384)
          chunk_index?: number
          token_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          credits_remaining: number
          credits_max: number
          last_refresh_date: string | null
          subscription_end_date: string | null
          paystack_subscription_id: string | null
          paystack_customer_code: string | null
          created_at: string
          updated_at: string
          status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          id?: string
          user_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          credits_remaining?: number
          credits_max?: number
          last_refresh_date?: string | null
          subscription_end_date?: string | null
          paystack_subscription_id?: string | null
          paystack_customer_code?: string | null
          created_at?: string
          updated_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          id?: string
          user_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          credits_remaining?: number
          credits_max?: number
          last_refresh_date?: string | null
          subscription_end_date?: string | null
          paystack_subscription_id?: string | null
          paystack_customer_code?: string | null
          created_at?: string
          updated_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          email: string | null
          created_at_user: string | null
          is_pro: boolean | null
          pro_credits_used: number | null
          pro_credits_max: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          email?: string | null
          created_at_user?: string | null
          is_pro?: boolean | null
          pro_credits_used?: number | null
          pro_credits_max?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          email?: string | null
          created_at_user?: string | null
          is_pro?: boolean | null
          pro_credits_used?: number | null
          pro_credits_max?: number | null
        }
        Relationships: []
      }
      user_state: {
        Row: {
          id: string
          user_id: string
          intent_patterns: Json | null
          trust_level: number
          emotional_state: Json | null
          attention_focus: Json | null
          interaction_style: Json | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          intent_patterns?: Json | null
          trust_level?: number
          emotional_state?: Json | null
          attention_focus?: Json | null
          interaction_style?: Json | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          intent_patterns?: Json | null
          trust_level?: number
          emotional_state?: Json | null
          attention_focus?: Json | null
          interaction_style?: Json | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_memory: {
        Row: {
          id: string
          user_id: string
          memory_type: string
          content: Json | null
          confidence: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          memory_type: string
          content?: Json | null
          confidence?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          memory_type?: string
          content?: Json | null
          confidence?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          id: string
          user_id: string
          message_id: string
          feedback_type: string
          feedback_content: string | null
          system_response_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id: string
          feedback_type: string
          feedback_content?: string | null
          system_response_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message_id?: string
          feedback_type?: string
          feedback_content?: string | null
          system_response_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_log: {
        Row: {
          id: string
          user_id: string
          conversation_id: string
          message_id: string
          decision_factors: Json | null
          confidence_score: number | null
          alternatives: Json | null
          reasoning: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id: string
          message_id: string
          decision_factors?: Json | null
          confidence_score?: number | null
          alternatives?: Json | null
          reasoning?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string
          message_id?: string
          decision_factors?: Json | null
          confidence_score?: number | null
          alternatives?: Json | null
          reasoning?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          id: string
          name: string
          price_kobo: number
          currency: string
          credits: number
          credits_frequency: string | null
          max_file_size: string
          processing_queue: string
          features: string[] | null
          icon: string
          recommended: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          price_kobo: number
          currency?: string
          credits: number
          credits_frequency?: string | null
          max_file_size: string
          processing_queue: string
          features?: string[] | null
          icon?: string
          recommended?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price_kobo?: number
          currency?: string
          credits?: number
          credits_frequency?: string | null
          max_file_size?: string
          processing_queue?: string
          features?: string[] | null
          icon?: string
          recommended?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      search_knowledge_base: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          document_id: string
          content: string
          similarity: number
          source_file: string
          metadata: Json
        }[]
      }
      match_documents: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
          p_user_id?: string
          p_document_ids?: string[]
        }
        Returns: {
          id: string
          document_id: string
          content: string
          similarity: number
          document_title: string
          chunk_index: number
          token_count: number
        }[]
      }
      decrement_credits: {
        Args: {
          p_user_id: string
        }
        Returns: {
          success: boolean
          remaining_credits: number
        }[]
      }
      update_document_status: {
        Args: {
          p_document_id: string
          p_status: Database["public"]["Enums"]["document_status"]
          p_status_message?: string
          p_chunk_count?: number
          p_error_message?: string
        }
        Returns: void
      }
      get_document_processing_stats: {
        Args: {
          p_user_id?: string
        }
        Returns: {
          total_documents: number
          pending_count: number
          queued_count: number
          processing_count: number
          completed_count: number
          failed_count: number
          avg_processing_time_seconds: number
        }[]
      }
      get_or_create_user_state: {
        Args: {
          target_user_id: string
        }
        Returns: {
          id: string
          user_id: string
          intent_patterns: Json | null
          trust_level: number
          emotional_state: Json | null
          attention_focus: Json | null
          interaction_style: Json | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
      }
      update_user_state: {
        Args: {
          target_user_id: string
          interaction_data: Json
        }
        Returns: {
          id: string
          user_id: string
          intent_patterns: Json | null
          trust_level: number
          emotional_state: Json | null
          attention_focus: Json | null
          interaction_style: Json | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
      }
      log_decision: {
        Args: {
          target_user_id: string
          target_conversation_id: string
          target_message_id: string
          decision_factors: Json
          confidence_score?: number
          alternatives?: Json
          reasoning?: string
        }
        Returns: string
      }
      should_yield_control: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
      get_user_feedback_summary: {
        Args: {
          target_user_id: string
          days_back?: number
        }
        Returns: {
          feedback_type: string
          count: number
          recent_feedback: string[]
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      document_status: "pending" | "queued" | "processing" | "completed" | "failed" | "partial"
      subscription_plan: "free" | "pro"
      subscription_status: "active" | "cancelled" | "pending" | "trialing"
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
      app_role: ["admin", "user"],
      document_status: ["pending", "queued", "processing", "completed", "failed", "partial"],
      subscription_plan: ["free", "pro"],
      subscription_status: ["active", "cancelled", "pending", "trialing"],
    },
  },
} as const