/**
 * Supabase-Datenbanktypen.
 *
 * Diese Datei wird NICHT manuell bearbeitet.
 * Nach dem Erstellen und Anwenden einer Migration wird sie mit folgendem Befehl neu generiert:
 *
 *   npx supabase gen types typescript --local > types/database.ts
 *
 * Zum Starten des lokalen Supabase-Stacks:
 *   npx supabase start
 *
 * Zum Generieren aus dem Remote-Projekt:
 *   npx supabase gen types typescript --project-id <project-ref> > types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          user_id: string
          name: string
          brand_name: string
          sector: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          brand_name: string
          sector: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          brand_name?: string
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          tenant_id: string
          name: string
          date: string
          description: string | null
          campaign_type: string
          flow_mode: string
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          date: string
          description?: string | null
          campaign_type: string
          flow_mode: string
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          date?: string
          description?: string | null
          campaign_type?: string
          flow_mode?: string
          archived_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      submissions: {
        Row: {
          id: string
          tenant_id: string
          event_id: string
          guest_user_id: string
          media_url: string | null
          file_type: 'image' | 'video' | null
          guest_name: string | null
          consent_at: string
          uploaded_at: string | null
          moderation_flag: boolean
          rating: number | null
          comment: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          event_id: string
          guest_user_id: string
          media_url?: string | null
          file_type?: 'image' | 'video' | null
          guest_name?: string | null
          consent_at: string
          uploaded_at?: string | null
          moderation_flag?: boolean
          rating?: number | null
          comment?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          media_url?: string | null
          file_type?: 'image' | 'video' | null
          guest_name?: string | null
          uploaded_at?: string | null
          moderation_flag?: boolean
          rating?: number | null
          comment?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'submissions_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'submissions_event_id_fkey'
            columns: ['event_id']
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      current_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Häufig verwendete Tabellen-Zeilentypen als Kurzformen exportieren
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Submission = Database['public']['Tables']['submissions']['Row']

export type TenantInsert = Database['public']['Tables']['tenants']['Insert']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type SubmissionInsert = Database['public']['Tables']['submissions']['Insert']

export type TenantUpdate = Database['public']['Tables']['tenants']['Update']
export type EventUpdate = Database['public']['Tables']['events']['Update']
export type SubmissionUpdate = Database['public']['Tables']['submissions']['Update']
