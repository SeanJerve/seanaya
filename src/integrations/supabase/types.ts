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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          all_day: boolean
          category: Database["public"]["Enums"]["event_category"]
          color: string | null
          countdown: boolean
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          recurrence: string | null
          relationship_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          category?: Database["public"]["Enums"]["event_category"]
          color?: string | null
          countdown?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          recurrence?: string | null
          relationship_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          category?: Database["public"]["Enums"]["event_category"]
          color?: string | null
          countdown?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          recurrence?: string | null
          relationship_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      hugs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          relationship_id: string
          seen: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          relationship_id: string
          seen?: boolean
          sender_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          relationship_id?: string
          seen?: boolean
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hugs_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      lilies: {
        Row: {
          created_at: string
          id: string
          memory_id: string | null
          planted_at: string
          position_x: number
          position_y: number
          relationship_id: string
          stage: Database["public"]["Enums"]["lily_stage"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_id?: string | null
          planted_at?: string
          position_x?: number
          position_y?: number
          relationship_id: string
          stage?: Database["public"]["Enums"]["lily_stage"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_id?: string | null
          planted_at?: string
          position_x?: number
          position_y?: number
          relationship_id?: string
          stage?: Database["public"]["Enums"]["lily_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lilies_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lilies_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          category: Database["public"]["Enums"]["memory_category"]
          cover_path: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          featured: boolean
          id: string
          location: string | null
          memory_date: string | null
          relationship_id: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["memory_category"]
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          featured?: boolean
          id?: string
          location?: string | null
          memory_date?: string | null
          relationship_id: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["memory_category"]
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          featured?: boolean
          id?: string
          location?: string | null
          memory_date?: string | null
          relationship_id?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_media: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          media_type: string
          memory_id: string
          relationship_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          media_type: string
          memory_id: string
          relationship_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          media_type?: string
          memory_id?: string
          relationship_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_media_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_media_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          body: string
          color: string | null
          created_at: string
          favorite: boolean
          id: string
          image_path: string | null
          image_url: string | null
          kind: string
          permanent: boolean
          pinned: boolean
          pos_x: number | null
          pos_y: number | null
          relationship_id: string
          rotation: number | null
          seen: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          color?: string | null
          created_at?: string
          favorite?: boolean
          id?: string
          image_path?: string | null
          image_url?: string | null
          kind?: string
          permanent?: boolean
          pinned?: boolean
          pos_x?: number | null
          pos_y?: number | null
          relationship_id: string
          rotation?: number | null
          seen?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          color?: string | null
          created_at?: string
          favorite?: boolean
          id?: string
          image_path?: string | null
          image_url?: string | null
          kind?: string
          permanent?: boolean
          pinned?: boolean
          pos_x?: number | null
          pos_y?: number | null
          relationship_id?: string
          rotation?: number | null
          seen?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          capsule: boolean
          event: boolean
          hug: boolean
          memory: boolean
          note: boolean
          song: boolean
          trip: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          capsule?: boolean
          event?: boolean
          hug?: boolean
          memory?: boolean
          note?: boolean
          song?: boolean
          trip?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          capsule?: boolean
          event?: boolean
          hug?: boolean
          memory?: boolean
          note?: boolean
          song?: boolean
          trip?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read: boolean
          ref_id: string | null
          relationship_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read?: boolean
          ref_id?: string | null
          relationship_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read?: boolean
          ref_id?: string | null
          relationship_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birthday: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          photos: string[]
          relationship_id: string
          species: string
          updated_at: string
          variant: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photos?: string[]
          relationship_id: string
          species?: string
          updated_at?: string
          variant?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photos?: string[]
          relationship_id?: string
          species?: string
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          category: Database["public"]["Enums"]["song_category"]
          created_at: string
          description: string | null
          id: string
          name: string
          relationship_id: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["song_category"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          relationship_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["song_category"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          relationship_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relationships: {
        Row: {
          anniversary: string | null
          created_at: string
          id: string
          invite_code: string | null
          name: string | null
          name_a: string | null
          name_b: string | null
          pin_hash: string | null
          pin_hash_a: string | null
          pin_hash_b: string | null
          updated_at: string
          user_a_id: string
          user_b_id: string | null
        }
        Insert: {
          anniversary?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          name?: string | null
          name_a?: string | null
          name_b?: string | null
          pin_hash?: string | null
          pin_hash_a?: string | null
          pin_hash_b?: string | null
          updated_at?: string
          user_a_id: string
          user_b_id?: string | null
        }
        Update: {
          anniversary?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          name?: string | null
          name_a?: string | null
          name_b?: string | null
          pin_hash?: string | null
          pin_hash_a?: string | null
          pin_hash_b?: string | null
          updated_at?: string
          user_a_id?: string
          user_b_id?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string | null
          category: Database["public"]["Enums"]["song_category"]
          created_at: string
          favorite: boolean
          id: string
          playlist_id: string | null
          relationship_id: string
          spotify_uri: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist?: string | null
          category?: Database["public"]["Enums"]["song_category"]
          created_at?: string
          favorite?: boolean
          id?: string
          playlist_id?: string | null
          relationship_id: string
          spotify_uri?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string | null
          category?: Database["public"]["Enums"]["song_category"]
          created_at?: string
          favorite?: boolean
          id?: string
          playlist_id?: string | null
          relationship_id?: string
          spotify_uri?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      time_capsules: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          opened: boolean
          relationship_id: string
          title: string
          unlock_at: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          opened?: boolean
          relationship_id: string
          title: string
          unlock_at: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          opened?: boolean
          relationship_id?: string
          title?: string
          unlock_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_capsules_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cover_path: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          images: string[]
          latitude: number | null
          location: string
          longitude: number | null
          relationship_id: string
          status: string
          title: string
          trip_date: string | null
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          images?: string[]
          latitude?: number | null
          location: string
          longitude?: number | null
          relationship_id: string
          status?: string
          title: string
          trip_date?: string | null
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          images?: string[]
          latitude?: number | null
          location?: string
          longitude?: number | null
          relationship_id?: string
          status?: string
          title?: string
          trip_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_slot: {
        Args: { _pin_hash: string; _rel_id: string }
        Returns: string
      }
      current_relationship_id: { Args: never; Returns: string }
      get_space_state: {
        Args: never
        Returns: {
          has_a: boolean
          has_b: boolean
          id: string
          name: string
          name_a: string
          name_b: string
        }[]
      }
      is_relationship_member: { Args: { _rel: string }; Returns: boolean }
      reset_slot_pin: {
        Args: {
          _anniversary: string
          _new_hash: string
          _rel_id: string
          _slot: string
        }
        Returns: undefined
      }
      set_partner_pin: {
        Args: { _name: string; _pin_hash: string; _rel_id: string }
        Returns: undefined
      }
    }
    Enums: {
      event_category:
        | "relationship"
        | "travel"
        | "family"
        | "pets"
        | "personal"
        | "health"
        | "study"
        | "custom"
      lily_stage: "seed" | "sprout" | "bud" | "bloom" | "full"
      memory_category:
        | "firsts"
        | "campus"
        | "travel"
        | "random"
        | "family"
        | "future"
      notification_kind:
        | "memory"
        | "note"
        | "hug"
        | "event"
        | "capsule"
        | "trip"
        | "song"
      song_category: "favorite" | "study" | "travel" | "comfort" | "future"
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
      event_category: [
        "relationship",
        "travel",
        "family",
        "pets",
        "personal",
        "health",
        "study",
        "custom",
      ],
      lily_stage: ["seed", "sprout", "bud", "bloom", "full"],
      memory_category: [
        "firsts",
        "campus",
        "travel",
        "random",
        "family",
        "future",
      ],
      notification_kind: [
        "memory",
        "note",
        "hug",
        "event",
        "capsule",
        "trip",
        "song",
      ],
      song_category: ["favorite", "study", "travel", "comfort", "future"],
    },
  },
} as const
