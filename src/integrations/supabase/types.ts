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
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      billing_run_items: {
        Row: {
          billing_run_id: string
          created_at: string
          id: string
          invoice_id: string | null
          message: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          billing_run_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          message?: string | null
          status: string
          subscription_id: string
        }
        Update: {
          billing_run_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          message?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_run_items_billing_run_id_fkey"
            columns: ["billing_run_id"]
            isOneToOne: false
            referencedRelation: "billing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_run_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_run_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          failed: number
          finished_at: string | null
          id: string
          processed: number
          run_date: string
          run_type: string
          skipped: number
          started_at: string
          status: string
          succeeded: number
          triggered_by: string | null
        }
        Insert: {
          failed?: number
          finished_at?: string | null
          id?: string
          processed?: number
          run_date?: string
          run_type: string
          skipped?: number
          started_at?: string
          status?: string
          succeeded?: number
          triggered_by?: string | null
        }
        Update: {
          failed?: number
          finished_at?: string | null
          id?: string
          processed?: number
          run_date?: string
          run_type?: string
          skipped?: number
          started_at?: string
          status?: string
          succeeded?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          created_by: string | null
          customer_number: string
          email: string
          id: string
          name: string
          phone: string | null
          status: string
          tax_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      demo_audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      demo_customers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          created_by: string | null
          customer_number: string
          email: string
          id: string
          name: string
          phone: string | null
          status: string
          tax_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_number: string
          email: string
          id?: string
          name: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_number?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      demo_discount_products: {
        Row: {
          discount_id: string
          product_id: string
        }
        Insert: {
          discount_id: string
          product_id: string
        }
        Update: {
          discount_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_discount_products_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "demo_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_discount_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_discounts: {
        Row: {
          active: boolean
          created_at: string
          discount_type: string
          ends_on: string | null
          id: string
          max_uses: number | null
          min_purchase: number
          min_quantity: number
          name: string
          scope: string
          starts_on: string
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_type?: string
          ends_on?: string | null
          id?: string
          max_uses?: number | null
          min_purchase?: number
          min_quantity?: number
          name: string
          scope?: string
          starts_on?: string
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_type?: string
          ends_on?: string | null
          id?: string
          max_uses?: number | null
          min_purchase?: number
          min_quantity?: number
          name?: string
          scope?: string
          starts_on?: string
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      demo_invoice_lines: {
        Row: {
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          line_subtotal: number
          line_total: number
          product_id: string | null
          quantity: number
          tax_amount: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          description: string
          discount_amount?: number
          id?: string
          invoice_id: string
          line_subtotal?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          line_subtotal?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "demo_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_invoices: {
        Row: {
          amount_paid: number
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_snapshot: Json
          discount_amount: number
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_snapshot?: Json
          discount_amount?: number
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_snapshot?: Json
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "demo_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "demo_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_meta: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: boolean
          size: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: boolean
          size: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: boolean
          size?: string
        }
        Relationships: []
      }
      demo_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "demo_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "demo_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          payment_number: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date: string
          payment_number: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          payment_number?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "demo_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "demo_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_plan_product_lines: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          product_id: string
          quantity: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          product_id: string
          quantity?: number
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_plan_product_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "demo_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_plan_product_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_plan_product_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "demo_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_plans: {
        Row: {
          allow_early_close: boolean
          allow_pause: boolean
          allow_renew: boolean
          auto_close: boolean
          auto_close_cycles: number | null
          available_from: string | null
          available_until: string | null
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          min_quantity: number
          name: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          allow_early_close?: boolean
          allow_pause?: boolean
          allow_renew?: boolean
          auto_close?: boolean
          auto_close_cycles?: number | null
          available_from?: string | null
          available_until?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_quantity?: number
          name: string
          price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          allow_early_close?: boolean
          allow_pause?: boolean
          allow_renew?: boolean
          auto_close?: boolean
          auto_close_cycles?: number | null
          available_from?: string | null
          available_until?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_quantity?: number
          name?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_product_variants: {
        Row: {
          active: boolean
          attribute: string
          created_at: string
          extra_price: number
          id: string
          product_id: string
          value: string
        }
        Insert: {
          active?: boolean
          attribute: string
          created_at?: string
          extra_price?: number
          id?: string
          product_id: string
          value: string
        }
        Update: {
          active?: boolean
          attribute?: string
          created_at?: string
          extra_price?: number
          id?: string
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_products: {
        Row: {
          cost_price: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          product_type: string
          sales_price: number
          status: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          product_type?: string
          sales_price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_type?: string
          sales_price?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_quotation_lines: {
        Row: {
          description: string
          id: string
          line_subtotal: number
          product_id: string
          quantity: number
          quotation_id: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          description: string
          id?: string
          line_subtotal?: number
          product_id: string
          quantity?: number
          quotation_id: string
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          description?: string
          id?: string
          line_subtotal?: number
          product_id?: string
          quantity?: number
          quotation_id?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "demo_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_quotation_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "demo_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_quotation_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          plan_id: string
          validity_days: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          plan_id: string
          validity_days?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan_id?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_quotation_templates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "demo_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_quotations: {
        Row: {
          converted_subscription_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          plan_id: string
          quotation_number: string
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_amount: number
          template_id: string | null
          total: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          converted_subscription_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          plan_id: string
          quotation_number: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_amount?: number
          template_id?: string | null
          total?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          converted_subscription_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          plan_id?: string
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_amount?: number
          template_id?: string | null
          total?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "demo_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_quotations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "demo_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_quotations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "demo_quotation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_subscription_lines: {
        Row: {
          description: string
          id: string
          product_id: string
          quantity: number
          subscription_id: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          description: string
          id?: string
          product_id: string
          quantity?: number
          subscription_id: string
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          description?: string
          id?: string
          product_id?: string
          quantity?: number
          subscription_id?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_subscription_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_subscription_lines_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "demo_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_subscription_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "demo_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_subscriptions: {
        Row: {
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at: string
          created_by: string | null
          customer_id: string
          cycles_billed: number
          expiry_date: string | null
          id: string
          next_billing_date: string | null
          notes: string | null
          payment_terms_days: number
          plan_id: string
          quotation_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_number: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          customer_id: string
          cycles_billed?: number
          expiry_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_terms_days?: number
          plan_id: string
          quotation_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_number: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          customer_id?: string
          cycles_billed?: number
          expiry_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_terms_days?: number
          plan_id?: string
          quotation_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_number?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "demo_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "demo_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_subscriptions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "demo_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_tax_rules: {
        Row: {
          active: boolean
          applies_to: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          product_id: string | null
          rate: number
          tax_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          product_id?: string | null
          rate: number
          tax_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          product_id?: string | null
          rate?: number
          tax_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_tax_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "demo_products"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_products: {
        Row: {
          discount_id: string
          product_id: string
        }
        Insert: {
          discount_id: string
          product_id: string
        }
        Update: {
          discount_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_products_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_usages: {
        Row: {
          amount: number
          created_at: string
          discount_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          discount_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          discount_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_usages_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_usages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean
          created_at: string
          discount_type: string
          ends_on: string | null
          id: string
          max_uses: number | null
          min_purchase: number
          min_quantity: number
          name: string
          scope: string
          starts_on: string
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_type: string
          ends_on?: string | null
          id?: string
          max_uses?: number | null
          min_purchase?: number
          min_quantity?: number
          name: string
          scope?: string
          starts_on?: string
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_type?: string
          ends_on?: string | null
          id?: string
          max_uses?: number | null
          min_purchase?: number
          min_quantity?: number
          name?: string
          scope?: string
          starts_on?: string
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      document_metadata: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          meta: Json
          provider: string
          provider_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
          template: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          meta?: Json
          provider?: string
          provider_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
          template: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          meta?: Json
          provider?: string
          provider_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          failed: number
          file_name: string
          id: string
          imported: number
          report: Json
          skipped: number
          status: string
          total_rows: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          failed?: number
          file_name: string
          id?: string
          imported?: number
          report?: Json
          skipped?: number
          status?: string
          total_rows?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          failed?: number
          file_name?: string
          id?: string
          imported?: number
          report?: Json
          skipped?: number
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          line_subtotal: number
          line_total: number
          product_id: string | null
          quantity: number
          tax_amount: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          description: string
          discount_amount?: number
          id?: string
          invoice_id: string
          line_subtotal: number
          line_total: number
          product_id?: string | null
          quantity: number
          tax_amount?: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          line_subtotal?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_snapshot: Json
          discount_amount: number
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_snapshot: Json
          discount_amount?: number
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_snapshot?: Json
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          email_status: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          email_status?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          email_status?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string
          id: string
          invoice_id: string
          last_event_id: string | null
          order_id: string | null
          payment_id: string | null
          payment_record_id: string | null
          provider: string
          raw: Json
          signature_verified: boolean
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          invoice_id: string
          last_event_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          payment_record_id?: string | null
          provider?: string
          raw?: Json
          signature_verified?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          last_event_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          payment_record_id?: string | null
          provider?: string
          raw?: Json
          signature_verified?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          payment_number: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          payment_number?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          payment_number?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_product_lines: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          product_id: string
          quantity: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          product_id: string
          quantity?: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_product_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_product_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_product_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          allow_early_close: boolean
          allow_pause: boolean
          allow_renew: boolean
          auto_close: boolean
          auto_close_cycles: number | null
          available_from: string | null
          available_until: string | null
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          min_quantity: number
          name: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          allow_early_close?: boolean
          allow_pause?: boolean
          allow_renew?: boolean
          auto_close?: boolean
          auto_close_cycles?: number | null
          available_from?: string | null
          available_until?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_quantity?: number
          name: string
          price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          allow_early_close?: boolean
          allow_pause?: boolean
          allow_renew?: boolean
          auto_close?: boolean
          auto_close_cycles?: number | null
          available_from?: string | null
          available_until?: string | null
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_quantity?: number
          name?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          active: boolean
          attribute: string
          created_at: string
          extra_price: number
          id: string
          product_id: string
          value: string
        }
        Insert: {
          active?: boolean
          attribute?: string
          created_at?: string
          extra_price?: number
          id?: string
          product_id: string
          value: string
        }
        Update: {
          active?: boolean
          attribute?: string
          created_at?: string
          extra_price?: number
          id?: string
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          product_type: string
          sales_price: number
          status: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          product_type?: string
          sales_price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_type?: string
          sales_price?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_mode: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_mode?: string
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_mode?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quotation_lines: {
        Row: {
          description: string
          id: string
          line_subtotal: number
          product_id: string
          quantity: number
          quotation_id: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          description: string
          id?: string
          line_subtotal: number
          product_id: string
          quantity: number
          quotation_id: string
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          description?: string
          id?: string
          line_subtotal?: number
          product_id?: string
          quantity?: number
          quotation_id?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          plan_id: string
          validity_days: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          plan_id: string
          validity_days?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan_id?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_templates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          converted_subscription_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          plan_id: string
          quotation_number: string
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_amount: number
          template_id: string | null
          total: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          converted_subscription_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          plan_id: string
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_amount?: number
          template_id?: string | null
          total?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          converted_subscription_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          plan_id?: string
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_amount?: number
          template_id?: string | null
          total?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_sub_fk"
            columns: ["converted_subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quotation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["subscription_status"] | null
          id: string
          note: string | null
          subscription_id: string
          to_status: Database["public"]["Enums"]["subscription_status"] | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          note?: string | null
          subscription_id: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          note?: string | null
          subscription_id?: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_lines: {
        Row: {
          description: string
          id: string
          product_id: string
          quantity: number
          subscription_id: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          description: string
          id?: string
          product_id: string
          quantity: number
          subscription_id: string
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          description?: string
          id?: string
          product_id?: string
          quantity?: number
          subscription_id?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_lines_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at: string
          created_by: string | null
          customer_id: string
          cycles_billed: number
          expiry_date: string | null
          id: string
          next_billing_date: string | null
          notes: string | null
          payment_terms_days: number
          plan_id: string
          quotation_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_number: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          customer_id: string
          cycles_billed?: number
          expiry_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_terms_days?: number
          plan_id: string
          quotation_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_number?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          customer_id?: string
          cycles_billed?: number
          expiry_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_terms_days?: number
          plan_id?: string
          quotation_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_number?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rules: {
        Row: {
          active: boolean
          applies_to: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          product_id: string | null
          rate: number
          tax_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          product_id?: string | null
          rate: number
          tax_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          product_id?: string | null
          rate?: number
          tax_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_verified_payment: {
        Args: {
          _amount: number
          _invoice: string
          _method: Database["public"]["Enums"]["payment_method"]
          _notes?: string
          _reference: string
        }
        Returns: string
      }
      billing_date_for_cycle: {
        Args: {
          _cycle: number
          _f: Database["public"]["Enums"]["billing_frequency"]
          _start: string
        }
        Returns: string
      }
      cancel_invoice: {
        Args: { _inv: string; _reason: string }
        Returns: undefined
      }
      clear_demo_data: { Args: never; Returns: undefined }
      confirm_invoice: { Args: { _inv: string }; Returns: undefined }
      convert_quotation: {
        Args: {
          _expiry: string
          _payment_terms: number
          _q: string
          _start: string
        }
        Returns: string
      }
      create_quotation: {
        Args: {
          _customer: string
          _lines: Json
          _notes?: string
          _plan: string
          _template: string
          _valid_until: string
        }
        Returns: string
      }
      create_subscription: {
        Args: {
          _customer: string
          _expiry: string
          _lines: Json
          _notes?: string
          _payment_terms: number
          _plan: string
          _start: string
        }
        Returns: string
      }
      dashboard_metrics: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      demo_dashboard_metrics: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      freq_interval: {
        Args: { _f: Database["public"]["Enums"]["billing_frequency"] }
        Returns: string
      }
      generate_invoice_for_subscription: {
        Args: { _sub: string }
        Returns: string
      }
      generate_sample_data: { Args: { _size: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: { _action: string; _entity: string; _id: string; _meta?: Json }
        Returns: undefined
      }
      my_customer_id: { Args: never; Returns: string }
      notify_staff: {
        Args: { _body: string; _link?: string; _title: string; _type: string }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _body: string
          _link?: string
          _title: string
          _type: string
          _user: string
        }
        Returns: undefined
      }
      record_payment: {
        Args: {
          _amount: number
          _date: string
          _inv: string
          _method: Database["public"]["Enums"]["payment_method"]
          _notes: string
          _reference: string
        }
        Returns: string
      }
      refresh_invoice_status: { Args: { _inv: string }; Returns: undefined }
      reverse_payment: {
        Args: { _pay: string; _reason: string }
        Returns: undefined
      }
      run_billing: { Args: { _run_type?: string }; Returns: string }
      set_active_mode: { Args: { _mode: string }; Returns: undefined }
      set_quotation_status: {
        Args: {
          _q: string
          _status: Database["public"]["Enums"]["quotation_status"]
        }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      tax_rate_for: { Args: { _on: string; _product: string }; Returns: number }
      transition_subscription: {
        Args: { _action: string; _note?: string; _sub: string }
        Returns: Database["public"]["Enums"]["subscription_status"]
      }
      validate_plan: {
        Args: { _on: string; _plan: string; _qty: number }
        Returns: {
          allow_early_close: boolean
          allow_pause: boolean
          allow_renew: boolean
          auto_close: boolean
          auto_close_cycles: number | null
          available_from: string | null
          available_until: string | null
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          min_quantity: number
          name: string
          price: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      variant_unit_price: {
        Args: { _product: string; _variant: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      billing_frequency: "daily" | "weekly" | "monthly" | "yearly"
      invoice_status:
        | "draft"
        | "confirmed"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      payment_method: "upi" | "cash" | "bank_transfer" | "card" | "other"
      payment_status: "recorded" | "reversed"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
      subscription_status:
        | "draft"
        | "quotation"
        | "confirmed"
        | "active"
        | "paused"
        | "closed"
        | "cancelled"
        | "expired"
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
    Enums: {
      app_role: ["admin", "staff", "customer"],
      billing_frequency: ["daily", "weekly", "monthly", "yearly"],
      invoice_status: [
        "draft",
        "confirmed",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      payment_method: ["upi", "cash", "bank_transfer", "card", "other"],
      payment_status: ["recorded", "reversed"],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
      subscription_status: [
        "draft",
        "quotation",
        "confirmed",
        "active",
        "paused",
        "closed",
        "cancelled",
        "expired",
      ],
    },
  },
} as const
