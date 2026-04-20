// ═══════════════════════════════════════════════════════════
// Database types — mirrors Supabase schema
// Generated-like type file; update when schema changes
// ═══════════════════════════════════════════════════════════

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          rank_id: string;
          xp: number;
          total_runs: number;
          total_pbs: number;
          best_position: number | null;
          favorite_trail_id: string | null;
          role: 'rider' | 'curator' | 'moderator';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string;
          avatar_url?: string | null;
          rank_id?: string;
          xp?: number;
          total_runs?: number;
          total_pbs?: number;
          best_position?: number | null;
          favorite_trail_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          rank_id?: string;
          xp?: number;
          total_runs?: number;
          total_pbs?: number;
          best_position?: number | null;
          favorite_trail_id?: string | null;
          updated_at?: string;
        };
      };

      spots: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          region: string;
          is_official: boolean;
          is_active: boolean;
          season_label: string;
          status: 'pending' | 'active' | 'rejected';
          submitted_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          center_lat: number | null;
          center_lng: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string;
          region?: string;
          is_official?: boolean;
          is_active?: boolean;
          season_label?: string;
        };
        Update: Partial<Database['public']['Tables']['spots']['Insert']>;
      };

      trails: {
        Row: {
          id: string;
          spot_id: string;
          official_name: string;
          short_name: string;
          game_label: string;
          difficulty: 'easy' | 'medium' | 'hard' | 'expert';
          trail_type: string;
          distance_m: number;
          avg_grade_pct: number;
          elevation_drop_m: number;
          description: string;
          game_flavor: string;
          is_race_trail: boolean;
          is_active: boolean;
          sort_order: number;
          pioneer_user_id: string | null;
          calibration_status: 'draft' | 'calibrating' | 'verified' | 'locked';
          geometry: Json | null;
          pioneered_at: string | null;
          runs_contributed: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          official_name: string;
          short_name: string;
          game_label?: string;
          difficulty: string;
          trail_type: string;
          distance_m: number;
          avg_grade_pct?: number;
          elevation_drop_m?: number;
          description?: string;
          game_flavor?: string;
          is_race_trail?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['trails']['Insert']>;
      };

      runs: {
        Row: {
          id: string;
          user_id: string;
          spot_id: string;
          trail_id: string;
          mode: 'ranked' | 'practice';
          started_at: string;
          finished_at: string;
          duration_ms: number;
          verification_status: string;
          verification_summary: Json | null;
          gps_trace: Json | null;
          is_pb: boolean;
          xp_awarded: number;
          counted_in_leaderboard: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spot_id: string;
          trail_id: string;
          mode: 'ranked' | 'practice';
          started_at: string;
          finished_at: string;
          duration_ms: number;
          verification_status?: string;
          verification_summary?: Json | null;
          gps_trace?: Json | null;
          is_pb?: boolean;
          xp_awarded?: number;
          counted_in_leaderboard?: boolean;
        };
        Update: Partial<Database['public']['Tables']['runs']['Insert']>;
      };

      leaderboard_entries: {
        Row: {
          id: string;
          user_id: string;
          trail_id: string;
          period_type: 'day' | 'weekend' | 'all_time';
          best_duration_ms: number;
          rank_position: number;
          previous_position: number | null;
          run_id: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trail_id: string;
          period_type: 'day' | 'weekend' | 'all_time';
          best_duration_ms: number;
          rank_position?: number;
          previous_position?: number | null;
          run_id: string;
        };
        Update: Partial<Database['public']['Tables']['leaderboard_entries']['Insert']>;
      };

      challenges: {
        Row: {
          id: string;
          spot_id: string;
          trail_id: string | null;
          type: string;
          name: string;
          description: string;
          starts_at: string;
          ends_at: string;
          reward_xp: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          trail_id?: string | null;
          type: string;
          name: string;
          description?: string;
          starts_at: string;
          ends_at: string;
          reward_xp?: number;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['challenges']['Insert']>;
      };

      challenge_progress: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          current_value: number;
          completed: boolean;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          current_value?: number;
          completed?: boolean;
          completed_at?: string | null;
        };
        Update: {
          current_value?: number;
          completed?: boolean;
          completed_at?: string | null;
        };
      };

      achievements: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          icon: string;
          xp_reward: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string;
          icon?: string;
          xp_reward?: number;
        };
        Update: Partial<Database['public']['Tables']['achievements']['Insert']>;
      };

      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: never;
      };
    };

    Functions: {
      upsert_leaderboard_entry: {
        Args: {
          p_user_id: string;
          p_trail_id: string;
          p_period_type: string;
          p_duration_ms: number;
          p_run_id: string;
        };
        Returns: Json;
      };
      submit_spot: {
        Args: { p_name: string; p_lat: number; p_lng: number };
        Returns: Json;
      };
      approve_spot: {
        Args: { p_spot_id: string };
        Returns: Json;
      };
      reject_spot: {
        Args: { p_spot_id: string; p_reason: string };
        Returns: Json;
      };
      create_trail: {
        Args: {
          p_spot_id: string;
          p_name: string;
          p_difficulty: string;
          p_trail_type: string;
        };
        Returns: Json;
      };
      finalize_pioneer_run: {
        Args: {
          p_trail_id: string;
          p_run_payload: Json;
          p_geometry: Json;
        };
        Returns: Json;
      };
      delete_spot_cascade: {
        Args: { p_spot_id: string };
        Returns: Json;
      };
      delete_trail_cascade: {
        Args: { p_trail_id: string };
        Returns: Json;
      };
    };
  };
}

// ── Convenience row types ──

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type DbSpot = Database['public']['Tables']['spots']['Row'];
export type DbTrail = Database['public']['Tables']['trails']['Row'];
export type DbRun = Database['public']['Tables']['runs']['Row'];
export type DbLeaderboardEntry = Database['public']['Tables']['leaderboard_entries']['Row'];
export type DbChallenge = Database['public']['Tables']['challenges']['Row'];
export type DbChallengeProgress = Database['public']['Tables']['challenge_progress']['Row'];
export type DbAchievement = Database['public']['Tables']['achievements']['Row'];
export type DbUserAchievement = Database['public']['Tables']['user_achievements']['Row'];
