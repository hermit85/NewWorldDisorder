// ═══════════════════════════════════════════════════════════
// Database types — mirrors Supabase schema
//
// Generated via Supabase MCP (`generate_typescript_types`) against
// project `umdmipgxbiverudtvylx`. Re-run after every migration drop:
//
//   mcp generate_typescript_types --project-id umdmipgxbiverudtvylx
//
// Hand edits will be overwritten on the next regeneration.
// ═══════════════════════════════════════════════════════════

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          slug: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id: string
          name: string
          slug: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
          xp_reward?: number
        }
        Relationships: []
      }
      beat_events: {
        Row: {
          beaten_duration_ms: number
          beaten_new_position: number
          beaten_previous_position: number
          beaten_user_id: string
          beater_duration_ms: number
          beater_user_id: string
          created_at: string
          delta_ms: number
          id: string
          run_id: string | null
          seen_at: string | null
          trail_id: string
        }
        Insert: {
          beaten_duration_ms: number
          beaten_new_position: number
          beaten_previous_position: number
          beaten_user_id: string
          beater_duration_ms: number
          beater_user_id: string
          created_at?: string
          delta_ms: number
          id?: string
          run_id?: string | null
          seen_at?: string | null
          trail_id: string
        }
        Update: {
          beaten_duration_ms?: number
          beaten_new_position?: number
          beaten_previous_position?: number
          beaten_user_id?: string
          beater_duration_ms?: number
          beater_user_id?: string
          created_at?: string
          delta_ms?: number
          id?: string
          run_id?: string | null
          seen_at?: string | null
          trail_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beat_events_beaten_user_id_fkey"
            columns: ["beaten_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beat_events_beater_user_id_fkey"
            columns: ["beater_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beat_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beat_events_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          current_value: number
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          current_value?: number
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          current_value?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string
          ends_at: string
          id: string
          is_active: boolean
          name: string
          reward_xp: number
          spot_id: string
          starts_at: string
          trail_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at: string
          id: string
          is_active?: boolean
          name: string
          reward_xp?: number
          spot_id: string
          starts_at: string
          trail_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reward_xp?: number
          spot_id?: string
          starts_at?: string
          trail_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          best_duration_ms: number
          id: string
          period_type: string
          previous_position: number | null
          rank_position: number
          run_id: string
          trail_id: string
          trail_version_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_duration_ms: number
          id?: string
          period_type?: string
          previous_position?: number | null
          rank_position?: number
          run_id: string
          trail_id: string
          trail_version_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_duration_ms?: number
          id?: string
          period_type?: string
          previous_position?: number | null
          rank_position?: number
          run_id?: string
          trail_id?: string
          trail_version_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_trail_version_id_fkey"
            columns: ["trail_version_id"]
            isOneToOne: false
            referencedRelation: "trail_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          best_position: number | null
          created_at: string
          display_name: string
          favorite_trail_id: string | null
          id: string
          pioneered_total_count: number
          pioneered_verified_count: number
          rank_id: string
          role: string
          streak_days: number
          streak_grace_expires_at: string | null
          streak_last_ride_at: string | null
          total_pbs: number
          total_runs: number
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          best_position?: number | null
          created_at?: string
          display_name?: string
          favorite_trail_id?: string | null
          id: string
          pioneered_total_count?: number
          pioneered_verified_count?: number
          rank_id?: string
          role?: string
          streak_days?: number
          streak_grace_expires_at?: string | null
          streak_last_ride_at?: string | null
          total_pbs?: number
          total_runs?: number
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          best_position?: number | null
          created_at?: string
          display_name?: string
          favorite_trail_id?: string | null
          id?: string
          pioneered_total_count?: number
          pioneered_verified_count?: number
          rank_id?: string
          role?: string
          streak_days?: number
          streak_grace_expires_at?: string | null
          streak_last_ride_at?: string | null
          total_pbs?: number
          total_runs?: number
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
      runs: {
        Row: {
          counted_in_leaderboard: boolean
          created_at: string
          duration_ms: number
          finished_at: string
          gps_trace: Json | null
          id: string
          is_pb: boolean
          mode: string
          spot_id: string
          started_at: string
          trail_id: string
          trail_version_id: string | null
          user_id: string
          verification_status: string
          verification_summary: Json | null
          xp_awarded: number
        }
        Insert: {
          counted_in_leaderboard?: boolean
          created_at?: string
          duration_ms: number
          finished_at: string
          gps_trace?: Json | null
          id?: string
          is_pb?: boolean
          mode?: string
          spot_id: string
          started_at: string
          trail_id: string
          trail_version_id?: string | null
          user_id: string
          verification_status?: string
          verification_summary?: Json | null
          xp_awarded?: number
        }
        Update: {
          counted_in_leaderboard?: boolean
          created_at?: string
          duration_ms?: number
          finished_at?: string
          gps_trace?: Json | null
          id?: string
          is_pb?: boolean
          mode?: string
          spot_id?: string
          started_at?: string
          trail_id?: string
          trail_version_id?: string | null
          user_id?: string
          verification_status?: string
          verification_summary?: Json | null
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "runs_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_trail_version_id_fkey"
            columns: ["trail_version_id"]
            isOneToOne: false
            referencedRelation: "trail_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spots: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          center_lat: number | null
          center_lng: number | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_official: boolean
          name: string
          region: string
          rejection_reason: string | null
          season_label: string
          slug: string
          status: string
          submitted_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          description?: string
          id: string
          is_active?: boolean
          is_official?: boolean
          name: string
          region?: string
          rejection_reason?: string | null
          season_label?: string
          slug: string
          status?: string
          submitted_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_official?: boolean
          name?: string
          region?: string
          rejection_reason?: string | null
          season_label?: string
          slug?: string
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spots_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spots_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trail_flags: {
        Row: {
          created_at: string
          flagged_by: string
          id: string
          notes: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          trail_id: string
        }
        Insert: {
          created_at?: string
          flagged_by: string
          id?: string
          notes?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          trail_id: string
        }
        Update: {
          created_at?: string
          flagged_by?: string
          id?: string
          notes?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          trail_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trail_flags_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trail_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trail_flags_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
      }
      trail_versions: {
        Row: {
          created_at: string
          created_by: string | null
          geometry: Json
          id: string
          is_current: boolean
          superseded_at: string | null
          superseded_by_version_id: string | null
          trail_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          geometry: Json
          id?: string
          is_current?: boolean
          superseded_at?: string | null
          superseded_by_version_id?: string | null
          trail_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          geometry?: Json
          id?: string
          is_current?: boolean
          superseded_at?: string | null
          superseded_by_version_id?: string | null
          trail_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "trail_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trail_versions_superseded_by_version_id_fkey"
            columns: ["superseded_by_version_id"]
            isOneToOne: false
            referencedRelation: "trail_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trail_versions_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
      }
      trails: {
        Row: {
          avg_grade_pct: number
          calibration_status: string
          confidence_label: string | null
          consistent_pioneer_runs_count: number
          created_at: string
          current_version_id: string | null
          description: string
          difficulty: string
          distance_m: number
          elevation_drop_m: number
          game_flavor: string
          game_label: string
          geometry: Json | null
          id: string
          is_active: boolean
          is_race_trail: boolean
          official_name: string
          pioneer_user_id: string | null
          pioneered_at: string | null
          runs_contributed: number
          seed_source: Database["public"]["Enums"]["seed_source"] | null
          short_name: string
          sort_order: number
          spot_id: string
          trail_type: string
          trust_tier: Database["public"]["Enums"]["trust_tier"] | null
          unique_confirming_riders_count: number
        }
        Insert: {
          avg_grade_pct?: number
          calibration_status?: string
          confidence_label?: string | null
          consistent_pioneer_runs_count?: number
          created_at?: string
          current_version_id?: string | null
          description?: string
          difficulty?: string
          distance_m?: number
          elevation_drop_m?: number
          game_flavor?: string
          game_label?: string
          geometry?: Json | null
          id: string
          is_active?: boolean
          is_race_trail?: boolean
          official_name: string
          pioneer_user_id?: string | null
          pioneered_at?: string | null
          runs_contributed?: number
          seed_source?: Database["public"]["Enums"]["seed_source"] | null
          short_name: string
          sort_order?: number
          spot_id: string
          trail_type?: string
          trust_tier?: Database["public"]["Enums"]["trust_tier"] | null
          unique_confirming_riders_count?: number
        }
        Update: {
          avg_grade_pct?: number
          calibration_status?: string
          confidence_label?: string | null
          consistent_pioneer_runs_count?: number
          created_at?: string
          current_version_id?: string | null
          description?: string
          difficulty?: string
          distance_m?: number
          elevation_drop_m?: number
          game_flavor?: string
          game_label?: string
          geometry?: Json | null
          id?: string
          is_active?: boolean
          is_race_trail?: boolean
          official_name?: string
          pioneer_user_id?: string | null
          pioneered_at?: string | null
          runs_contributed?: number
          seed_source?: Database["public"]["Enums"]["seed_source"] | null
          short_name?: string
          sort_order?: number
          spot_id?: string
          trail_type?: string
          trust_tier?: Database["public"]["Enums"]["trust_tier"] | null
          unique_confirming_riders_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trails_pioneer_user_id_fkey"
            columns: ["pioneer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trails_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          related_achievement_id: string | null
          related_challenge_id: string | null
          related_run_id: string | null
          related_trail_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          related_achievement_id?: string | null
          related_challenge_id?: string | null
          related_run_id?: string | null
          related_trail_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          related_achievement_id?: string | null
          related_challenge_id?: string | null
          related_run_id?: string | null
          related_trail_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_related_achievement_id_fkey"
            columns: ["related_achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_related_challenge_id_fkey"
            columns: ["related_challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_related_run_id_fkey"
            columns: ["related_run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_related_trail_id_fkey"
            columns: ["related_trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      run_kpi_daily: {
        Row: {
          avg_bg_sample_ratio: number | null
          avg_duration_sec: number | null
          avg_gps_accuracy_m: number | null
          avg_samples_per_sec: number | null
          avg_time_to_armed_sec: number | null
          day: string | null
          mode: string | null
          run_count: number | null
          verification_status: string | null
        }
        Relationships: []
      }
      verified_pass_rate_weekly: {
        Row: {
          mode: string | null
          pass_rate_pct: number | null
          rejected_runs: number | null
          total_runs: number | null
          verified_runs: number | null
          week: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_resolve_pioneer: {
        Args: {
          p_new_pioneer_user_id: string
          p_reason: string
          p_trail_id: string
        }
        Returns: Json
      }
      approve_spot: { Args: { p_spot_id: string }; Returns: Json }
      check_run_consistency: {
        Args: { p_run_id: string; p_trail_id: string }
        Returns: Json
      }
      create_trail: {
        Args: {
          p_difficulty: string
          p_name: string
          p_spot_id: string
          p_trail_type: string
        }
        Returns: Json
      }
      delete_run: { Args: { p_run_id: string }; Returns: Json }
      delete_spot_cascade: { Args: { p_spot_id: string }; Returns: Json }
      delete_trail_cascade: { Args: { p_trail_id: string }; Returns: Json }
      fetch_scoped_leaderboard: {
        Args: { p_limit?: number; p_since: string; p_trail_id: string }
        Returns: {
          avatar_url: string
          best_duration_ms: number
          display_name: string
          rank_id: string
          rank_position: number
          trail_id: string
          user_id: string
          username: string
        }[]
      }
      finalize_pioneer_run: {
        Args: { p_geometry: Json; p_run_payload: Json; p_trail_id: string }
        Returns: Json
      }
      finalize_seed_run: {
        Args: {
          p_duration_ms: number
          p_finished_at: string
          p_geometry: Json
          p_gps_trace: Json
          p_median_accuracy_m: number
          p_quality_tier: string
          p_started_at: string
          p_trail_id: string
          p_verification_status: string
        }
        Returns: Json
      }
      gps_distance_m: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      increment_profile_runs: {
        Args: { p_is_pb?: boolean; p_user_id: string }
        Returns: Json
      }
      increment_profile_xp: {
        Args: { p_user_id: string; p_xp_to_add: number }
        Returns: Json
      }
      promote_run_as_baseline: { Args: { p_run_id: string }; Returns: Json }
      recalibrate_trail: {
        Args: { p_new_geometry: Json; p_trail_id: string }
        Returns: Json
      }
      recompute_trail_confidence: {
        Args: { p_trail_id: string }
        Returns: Json
      }
      reject_spot: {
        Args: { p_reason: string; p_spot_id: string }
        Returns: Json
      }
      submit_run: {
        Args: {
          p_duration_ms: number
          p_finished_at: string
          p_gps_trace: Json
          p_mode: string
          p_spot_id: string
          p_started_at: string
          p_trail_id: string
          p_verification_status: string
          p_verification_summary: Json
          p_xp_awarded: number
        }
        Returns: Json
      }
      submit_spot:
        | {
            Args: { p_lat: number; p_lng: number; p_name: string }
            Returns: Json
          }
        | {
            Args: {
              p_description?: string
              p_lat: number
              p_lng: number
              p_name: string
              p_region?: string
            }
            Returns: Json
          }
      unlock_achievement_with_xp: {
        Args: { p_achievement_id: string; p_user_id: string }
        Returns: Json
      }
      upsert_leaderboard_entry:
        | {
            Args: {
              p_duration_ms: number
              p_period_type: string
              p_run_id: string
              p_trail_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_duration_ms: number
              p_period_type: string
              p_run_id: string
              p_trail_id: string
              p_trail_version_id: string
              p_user_id: string
            }
            Returns: Json
          }
    }
    Enums: {
      seed_source: "curator" | "rider"
      trust_tier: "provisional" | "verified" | "disputed"
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
      seed_source: ["curator", "rider"],
      trust_tier: ["provisional", "verified", "disputed"],
    },
  },
} as const

// ── Convenience row aliases ─────────────────────────────────
// Hand-curated re-exports so the rest of the codebase doesn't have to
// spell out `Database['public']['Tables']['x']['Row']` everywhere.
// Keep this list in sync with imports across `src/` and tests.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type DbSpot = Database["public"]["Tables"]["spots"]["Row"]
export type DbTrail = Database["public"]["Tables"]["trails"]["Row"]
export type DbRun = Database["public"]["Tables"]["runs"]["Row"]
export type DbLeaderboardEntry = Database["public"]["Tables"]["leaderboard_entries"]["Row"]
export type DbChallenge = Database["public"]["Tables"]["challenges"]["Row"]
export type DbChallengeProgress = Database["public"]["Tables"]["challenge_progress"]["Row"]
export type DbAchievement = Database["public"]["Tables"]["achievements"]["Row"]
export type DbUserAchievement = Database["public"]["Tables"]["user_achievements"]["Row"]
