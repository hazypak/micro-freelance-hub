/**
 * Database type definitions.
 *
 * In production, generate these with:
 *   npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
 *
 * For now, hand-maintained to match our migration schema.
 */

export type UserRole = "student" | "business" | "admin";

export type TaskStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "submitted"
  | "ai_review"
  | "client_review"
  | "completed"
  | "cancelled"
  | "disputed";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type NotificationType =
  | "proposal_received"
  | "proposal_accepted"
  | "proposal_rejected"
  | "submission_received"
  | "task_completed"
  | "task_disputed";

export type VerificationStatus =
  | "pending"
  | "queued"
  | "scanning"
  | "passed"
  | "failed"
  | "needs_manual_review"
  | "retryable_error";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          bio: string | null;
          avatar_url: string | null;
          school_or_company: string | null;
          focus_areas: string[] | null;
          skills: string[] | null;
          trust_score: number;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: UserRole;
          bio?: string | null;
          avatar_url?: string | null;
          school_or_company?: string | null;
          focus_areas?: string[] | null;
          skills?: string[] | null;
          trust_score?: number;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          school_or_company?: string | null;
          focus_areas?: string[] | null;
          skills?: string[] | null;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      micro_tasks: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          description: string;
          brief: string | null;
          category: string;
          budget: number;
          deadline: string | null;
          required_skills: string[] | null;
          permitted_deliverable_types: string[] | null;
          status: TaskStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          description: string;
          brief?: string | null;
          category: string;
          budget: number;
          deadline?: string | null;
          required_skills?: string[] | null;
          permitted_deliverable_types?: string[] | null;
          status?: TaskStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          brief?: string | null;
          category?: string;
          budget?: number;
          deadline?: string | null;
          required_skills?: string[] | null;
          permitted_deliverable_types?: string[] | null;
          status?: TaskStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "micro_tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_proposals: {
        Row: {
          id: string;
          task_id: string;
          student_id: string;
          cover_message: string;
          proposed_price: number | null;
          timeline_estimate: string | null;
          status: ProposalStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          student_id: string;
          cover_message: string;
          proposed_price?: number | null;
          timeline_estimate?: string | null;
          status?: ProposalStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          cover_message?: string;
          proposed_price?: number | null;
          timeline_estimate?: string | null;
          status?: ProposalStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_proposals_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "micro_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_proposals_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_assignments: {
        Row: {
          id: string;
          task_id: string;
          student_id: string;
          proposal_id: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          student_id: string;
          proposal_id: string;
          assigned_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "micro_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignments_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "task_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          id: string;
          task_id: string;
          student_id: string;
          deliverable_url: string | null;
          storage_path: string | null;
          notes: string | null;
          ai_verification_status: VerificationStatus;
          ai_feedback: Record<string, unknown> | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          student_id: string;
          deliverable_url?: string | null;
          storage_path?: string | null;
          notes?: string | null;
          ai_verification_status?: VerificationStatus;
          ai_feedback?: Record<string, unknown> | null;
          submitted_at?: string;
        };
        Update: {
          deliverable_url?: string | null;
          storage_path?: string | null;
          notes?: string | null;
          ai_verification_status?: VerificationStatus;
          ai_feedback?: Record<string, unknown> | null;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "micro_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          task_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          rating?: number;
          comment?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "micro_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey";
            columns: ["reviewee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trust_score_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          delta: number;
          evidence: Record<string, unknown> | null;
          score_before: number;
          score_after: number;
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          delta: number;
          evidence?: Record<string, unknown> | null;
          score_before: number;
          score_after: number;
          version?: number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "trust_score_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_trust_score: {
        Args: {
          p_user_id: string;
          p_delta: number;
          p_event_type: string;
          p_evidence?: Record<string, unknown> | null;
        };
        Returns: number;
      };
      /**
       * Atomically accept a proposal. See migration 005 for details.
       * Returns one row per auto-rejected peer proposal (the student_ids
       * we should notify).
       */
      accept_proposal: {
        Args: {
          p_proposal_id: string;
        };
        Returns: {
          rejected_student_id: string;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
