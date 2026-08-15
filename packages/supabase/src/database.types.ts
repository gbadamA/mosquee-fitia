export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          body: string
          category: Database["public"]["Enums"]["announcement_category"]
          created_at: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_events: {
        Row: {
          asset_id: string
          condition_after: Database["public"]["Enums"]["asset_condition"] | null
          cost_fcfa: number | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          occurred_on: string
          type: Database["public"]["Enums"]["asset_event_type"]
        }
        Insert: {
          asset_id: string
          condition_after?:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          cost_fcfa?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          occurred_on?: string
          type?: Database["public"]["Enums"]["asset_event_type"]
        }
        Update: {
          asset_id?: string
          condition_after?:
            | Database["public"]["Enums"]["asset_condition"]
            | null
          cost_fcfa?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          occurred_on?: string
          type?: Database["public"]["Enums"]["asset_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          acquired_at: string | null
          category: Database["public"]["Enums"]["asset_category"]
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          quantity: number
          value_fcfa: number | null
        }
        Insert: {
          acquired_at?: string | null
          category?: Database["public"]["Enums"]["asset_category"]
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          quantity?: number
          value_fcfa?: number | null
        }
        Update: {
          acquired_at?: string | null
          category?: Database["public"]["Enums"]["asset_category"]
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          value_fcfa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          count: number
          created_at: string
          date: string
          event_id: string | null
          id: string
          moment: Database["public"]["Enums"]["attendance_moment"]
          recorded_by: string | null
        }
        Insert: {
          count: number
          created_at?: string
          date?: string
          event_id?: string | null
          id?: string
          moment: Database["public"]["Enums"]["attendance_moment"]
          recorded_by?: string | null
        }
        Update: {
          count?: number
          created_at?: string
          date?: string
          event_id?: string | null
          id?: string
          moment?: Database["public"]["Enums"]["attendance_moment"]
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attestations: {
        Row: {
          cancelled: boolean
          created_at: string
          data: Json
          id: string
          issued_by: string | null
          issued_on: string
          member_id: string | null
          reference: string
          subject: string
          type: Database["public"]["Enums"]["attestation_type"]
        }
        Insert: {
          cancelled?: boolean
          created_at?: string
          data?: Json
          id?: string
          issued_by?: string | null
          issued_on?: string
          member_id?: string | null
          reference?: string
          subject: string
          type?: Database["public"]["Enums"]["attestation_type"]
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          data?: Json
          id?: string
          issued_by?: string | null
          issued_on?: string
          member_id?: string | null
          reference?: string
          subject?: string
          type?: Database["public"]["Enums"]["attestation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "attestations_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          goal_amount: number
          id: string
          name: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal_amount: number
          id?: string
          name: string
          starts_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal_amount?: number
          id?: string
          name?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          method: Database["public"]["Enums"]["payment_method"]
          period: string
          proof_path: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          method: Database["public"]["Enums"]["payment_method"]
          period: string
          proof_path?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          period?: string
          proof_path?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          file_size: number | null
          id: string
          storage_path: string
          title: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          id?: string
          storage_path: string
          title: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          id?: string
          storage_path?: string
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          anonymous: boolean
          campaign_id: string | null
          created_at: string
          donor_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          proof_path: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["donation_type"]
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount: number
          anonymous?: boolean
          campaign_id?: string | null
          created_at?: string
          donor_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          proof_path?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["donation_type"]
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount?: number
          anonymous?: boolean
          campaign_id?: string | null
          created_at?: string
          donor_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          proof_path?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["donation_type"]
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          member_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          member_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at: string
          title: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          id: string
          label: string
          spent_at: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          spent_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          asset_id: string | null
          assignee: string | null
          created_at: string
          created_by: string | null
          done: boolean
          due_on: string
          id: string
          kind: Database["public"]["Enums"]["maintenance_kind"]
          last_done_on: string | null
          notes: string | null
          recurrence: Database["public"]["Enums"]["maintenance_recurrence"]
          title: string
        }
        Insert: {
          asset_id?: string | null
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_on: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_kind"]
          last_done_on?: string | null
          notes?: string | null
          recurrence?: Database["public"]["Enums"]["maintenance_recurrence"]
          title: string
        }
        Update: {
          asset_id?: string | null
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_on?: string
          id?: string
          kind?: Database["public"]["Enums"]["maintenance_kind"]
          last_done_on?: string | null
          notes?: string | null
          recurrence?: Database["public"]["Enums"]["maintenance_recurrence"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_log: {
        Row: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          delivered_count: number | null
          event_id: string | null
          id: string
          recipients_count: number
          sent_by: string | null
          title: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["message_audience"]
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          delivered_count?: number | null
          event_id?: string | null
          id?: string
          recipients_count?: number
          sent_by?: string | null
          title: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["message_audience"]
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          delivered_count?: number | null
          event_id?: string | null
          id?: string
          recipients_count?: number
          sent_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mosque: {
        Row: {
          address: string | null
          city: string | null
          contribution_amount: number
          contribution_due_day: number
          created_at: string
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          phone: string | null
          primary_color: string
          secondary_color: string
          singleton: boolean
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contribution_amount?: number
          contribution_due_day?: number
          created_at?: string
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          singleton?: boolean
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contribution_amount?: number
          contribution_due_day?: number
          created_at?: string
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          singleton?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      prayer_times: {
        Row: {
          asr: string
          chourouk: string | null
          created_at: string
          created_by: string | null
          date: string
          dhuhr: string
          fajr: string
          id: string
          isha: string
          jumua: string | null
          maghrib: string
          note: string | null
        }
        Insert: {
          asr: string
          chourouk?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          dhuhr: string
          fajr: string
          id?: string
          isha: string
          jumua?: string | null
          maghrib: string
          note?: string | null
        }
        Update: {
          asr?: string
          chourouk?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          dhuhr?: string
          fajr?: string
          id?: string
          isha?: string
          jumua?: string | null
          maghrib?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prayer_times_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          category: Database["public"]["Enums"]["member_category"]
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          joined_at: string
          member_number: string | null
          phone: string | null
          photo_url: string | null
          push_token: string | null
          quartier: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          category?: Database["public"]["Enums"]["member_category"]
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          joined_at?: string
          member_number?: string | null
          phone?: string | null
          photo_url?: string | null
          push_token?: string | null
          quartier?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          category?: Database["public"]["Enums"]["member_category"]
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          joined_at?: string
          member_number?: string | null
          phone?: string | null
          photo_url?: string | null
          push_token?: string | null
          quartier?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      campaign_progress: {
        Args: never
        Returns: {
          campaign_id: string
          collected: number
          donors: number
        }[]
      }
      contribution_arrears: {
        Args: never
        Returns: {
          amount_due: number
          member_id: string
          months_due: number
          oldest_unpaid: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      announcement_category:
        | "info"
        | "khutba"
        | "evenement"
        | "urgent"
        | "collecte"
      asset_category:
        | "tapis"
        | "sonorisation"
        | "mobilier"
        | "vehicule"
        | "informatique"
        | "climatisation"
        | "autre"
      asset_condition: "bon" | "moyen" | "mauvais" | "hors_service"
      asset_event_type:
        | "acquisition"
        | "controle"
        | "reparation"
        | "deplacement"
        | "changement_etat"
        | "sortie"
        | "autre"
      attendance_moment:
        | "fajr"
        | "dhuhr"
        | "asr"
        | "maghrib"
        | "isha"
        | "jumua"
        | "evenement"
      attestation_type:
        | "mariage"
        | "adhesion"
        | "don"
        | "residence"
        | "bonne_moralite"
        | "autre"
      document_type:
        | "statuts"
        | "proces_verbal"
        | "contrat"
        | "facture"
        | "autre"
      donation_type: "sadaqah" | "zakat" | "campagne"
      event_type:
        | "djouma"
        | "conference"
        | "aid"
        | "ramadan"
        | "janazah"
        | "cours"
        | "autre"
      expense_category:
        | "entretien"
        | "salaires"
        | "factures"
        | "evenement"
        | "travaux"
        | "autre"
      maintenance_kind:
        | "nettoyage"
        | "climatisation"
        | "sonorisation"
        | "plomberie"
        | "electricite"
        | "batiment"
        | "autre"
      maintenance_recurrence:
        | "ponctuel"
        | "hebdomadaire"
        | "mensuel"
        | "trimestriel"
        | "annuel"
      member_category: "membre_actif" | "bienfaiteur" | "staff"
      member_status: "actif" | "en_attente" | "inactif"
      message_audience: "tous" | "retardataires" | "evenement"
      message_channel: "push" | "whatsapp" | "sms"
      payment_method:
        | "orange_money"
        | "mtn_money"
        | "wave"
        | "especes"
        | "virement"
      payment_status: "en_attente" | "valide" | "rejete"
      user_role: "fidele" | "secretaire" | "tresorier" | "imam" | "admin"
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
      announcement_category: [
        "info",
        "khutba",
        "evenement",
        "urgent",
        "collecte",
      ],
      asset_category: [
        "tapis",
        "sonorisation",
        "mobilier",
        "vehicule",
        "informatique",
        "climatisation",
        "autre",
      ],
      asset_condition: ["bon", "moyen", "mauvais", "hors_service"],
      asset_event_type: [
        "acquisition",
        "controle",
        "reparation",
        "deplacement",
        "changement_etat",
        "sortie",
        "autre",
      ],
      attendance_moment: [
        "fajr",
        "dhuhr",
        "asr",
        "maghrib",
        "isha",
        "jumua",
        "evenement",
      ],
      attestation_type: [
        "mariage",
        "adhesion",
        "don",
        "residence",
        "bonne_moralite",
        "autre",
      ],
      document_type: [
        "statuts",
        "proces_verbal",
        "contrat",
        "facture",
        "autre",
      ],
      donation_type: ["sadaqah", "zakat", "campagne"],
      event_type: [
        "djouma",
        "conference",
        "aid",
        "ramadan",
        "janazah",
        "cours",
        "autre",
      ],
      expense_category: [
        "entretien",
        "salaires",
        "factures",
        "evenement",
        "travaux",
        "autre",
      ],
      maintenance_kind: [
        "nettoyage",
        "climatisation",
        "sonorisation",
        "plomberie",
        "electricite",
        "batiment",
        "autre",
      ],
      maintenance_recurrence: [
        "ponctuel",
        "hebdomadaire",
        "mensuel",
        "trimestriel",
        "annuel",
      ],
      member_category: ["membre_actif", "bienfaiteur", "staff"],
      member_status: ["actif", "en_attente", "inactif"],
      message_audience: ["tous", "retardataires", "evenement"],
      message_channel: ["push", "whatsapp", "sms"],
      payment_method: [
        "orange_money",
        "mtn_money",
        "wave",
        "especes",
        "virement",
      ],
      payment_status: ["en_attente", "valide", "rejete"],
      user_role: ["fidele", "secretaire", "tresorier", "imam", "admin"],
    },
  },
} as const

