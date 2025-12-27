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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string
          shop_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id: string
          shop_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string
          shop_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          brand: string | null
          created_at: string
          distributor_id: number
          drug_name: string
          id: number
          in_stock: boolean | null
          min_order_qty: number | null
          price: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          distributor_id: number
          drug_name: string
          id?: number
          in_stock?: boolean | null
          min_order_qty?: number | null
          price?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          distributor_id?: number
          drug_name?: string
          id?: number
          in_stock?: boolean | null
          min_order_qty?: number | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      },
      diary_scans: {
        Row: {
          confirmed: boolean | null
          created_at: string
          extracted_text: string | null
          id: string
          image_url: string | null
          shop_id: string
          status: string | null
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url?: string | null
          shop_id: string
          status?: string | null
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url?: string | null
          shop_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_scans_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          batch_number: string | null
          category: string | null
          cost_price: number | null
          created_at: string
          expiry_date: string | null
          generic_name: string | null
          id: string
          manufacturer: string | null
          medicine_name: string
          quantity: number
          reorder_level: number | null
          shop_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          manufacturer?: string | null
          medicine_name: string
          quantity?: number
          reorder_level?: number | null
          shop_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          manufacturer?: string | null
          medicine_name?: string
          quantity?: number
          reorder_level?: number | null
          shop_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          id: number
          name: string
          generic_name: string | null
          batch_number: string | null
          expiry_date: string | null
          quantity: number | null
          mrp: number | null
          min_stock_level: number | null
          shop_id: string | null
          hsn_code: string | null
          sgst_rate: number | null
          cgst_rate: number | null
          igst_rate: number | null
          schedule_h1: boolean | null
          salt_composition: string | null
          manufacturer: string | null
          created_at: string
          sync_status: string | null
          supabase_id: string | null
        }
        Insert: {
          id?: number
          name: string
          generic_name?: string | null
          batch_number?: string | null
          expiry_date?: string | null
          quantity?: number | null
          mrp?: number | null
          min_stock_level?: number | null
          shop_id?: string | null
          hsn_code?: string | null
          sgst_rate?: number | null
          cgst_rate?: number | null
          igst_rate?: number | null
          schedule_h1?: boolean | null
          salt_composition?: string | null
          manufacturer?: string | null
          created_at?: string
          sync_status?: string | null
          supabase_id?: string | null
        }
        Update: {
          id?: number
          name?: string
          generic_name?: string | null
          batch_number?: string | null
          expiry_date?: string | null
          quantity?: number | null
          mrp?: number | null
          min_stock_level?: number | null
          shop_id?: string | null
          hsn_code?: string | null
          sgst_rate?: number | null
          cgst_rate?: number | null
          igst_rate?: number | null
          schedule_h1?: boolean | null
          salt_composition?: string | null
          manufacturer?: string | null
          created_at?: string
          sync_status?: string | null
          supabase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          order_items: Json
          shop_id: string
          source: string | null
          status: string
          total_amount: number | null
          tax_total: number | null
          invoice_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          order_items?: Json
          shop_id: string
          source?: string | null
          status?: string
          total_amount?: number | null
          tax_total?: number | null
          invoice_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          order_items?: Json
          shop_id?: string
          source?: string | null
          status?: string
          total_amount?: number | null
          tax_total?: number | null
          invoice_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_reminders: {
        Row: {
          created_at: string
          id: string
          medicine_name: string
          patient_name: string
          patient_phone: string | null
          reminder_date: string
          shop_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medicine_name: string
          patient_name: string
          patient_phone?: string | null
          reminder_date: string
          shop_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medicine_name?: string
          patient_name?: string
          patient_phone?: string | null
          reminder_date?: string
          shop_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_reminders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          shop_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          shop_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          shop_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          inventory_id: string | null
          quantity_sold: number
          sale_date: string
          shop_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          inventory_id?: string | null
          quantity_sold: number
          sale_date?: string
          shop_id: string
          total_amount: number
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          inventory_id?: string | null
          quantity_sold?: number
          sale_date?: string
          shop_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string | null
          gstin: string | null
          dl_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          gstin?: string | null
          dl_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          gstin?: string | null
          dl_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shops: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shops_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_modify: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _shop_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_shop_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pharmacist" | "staff"
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
      app_role: ["admin", "pharmacist", "staff"],
    },
  },
} as const
