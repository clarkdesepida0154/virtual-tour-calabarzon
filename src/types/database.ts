/**
 * Handwritten TypeScript types for the Supabase tables (see supabase/schema.sql).
 *
 * These are `type` aliases, not interfaces, on purpose: supabase-js needs each
 * Row/Insert/Update to be assignable to `Record<string, unknown>`.
 */
import type { Category, Province } from '@/constants/taxonomy';

// ---------------------------------------------------------------------------
// destinations (Phase 1 + Phase 2 tour text)
// ---------------------------------------------------------------------------

export type Destination = {
  id: string;
  name: string;
  description: string;
  address: string;
  municipality: string | null;
  province: Province;
  category: Category;
  latitude: number | null;
  longitude: number | null;
  history: string | null;
  cultural_significance: string | null;
  cover_image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DestinationInsert = {
  id?: string;
  name: string;
  description: string;
  address: string;
  municipality?: string | null;
  province: Province;
  category: Category;
  latitude?: number | null;
  longitude?: number | null;
  history?: string | null;
  cultural_significance?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DestinationUpdate = Partial<DestinationInsert>;

/**
 * What lists and cards need. The long texts are left out so that browsing and
 * searching stay light; load the full `Destination` on the Details screen.
 */
export type DestinationSummary = Pick<
  Destination,
  'id' | 'name' | 'municipality' | 'province' | 'category' | 'cover_image_url'
>;

// ---------------------------------------------------------------------------
// destination_images (Phase 2 photo gallery)
// ---------------------------------------------------------------------------

export type DestinationImage = {
  id: string;
  destination_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
};

export type DestinationImageInsert = {
  id?: string;
  destination_id: string;
  image_url: string;
  caption?: string | null;
  sort_order?: number;
};

export type DestinationImageUpdate = Partial<DestinationImageInsert>;

// ---------------------------------------------------------------------------
// quiz_questions / quiz_options (Phase 2 quiz engine)
// ---------------------------------------------------------------------------

export type QuizQuestion = {
  id: string;
  destination_id: string;
  question_text: string;
  sort_order: number;
};

export type QuizQuestionInsert = {
  id?: string;
  destination_id: string;
  question_text: string;
  sort_order?: number;
};

export type QuizQuestionUpdate = Partial<QuizQuestionInsert>;

export type QuizOption = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
};

export type QuizOptionInsert = {
  id?: string;
  question_id: string;
  option_text: string;
  is_correct?: boolean;
};

export type QuizOptionUpdate = Partial<QuizOptionInsert>;

// ---------------------------------------------------------------------------
// quiz_attempts / destination_completions (Phase 2 progress tracking)
// ---------------------------------------------------------------------------

export type QuizAttempt = {
  id: string;
  destination_id: string;
  device_id: string;
  score: number;
  total: number;
  taken_at: string | null;
};

export type QuizAttemptInsert = {
  id?: string;
  destination_id: string;
  device_id: string;
  score: number;
  total: number;
  taken_at?: string | null;
};

export type QuizAttemptUpdate = Partial<QuizAttemptInsert>;

export type DestinationCompletion = {
  id: string;
  destination_id: string;
  device_id: string;
  completed_at: string | null;
};

export type DestinationCompletionInsert = {
  id?: string;
  destination_id: string;
  device_id: string;
  completed_at?: string | null;
};

export type DestinationCompletionUpdate = Partial<DestinationCompletionInsert>;

// ---------------------------------------------------------------------------
// Database shape consumed by createClient<Database>()
// ---------------------------------------------------------------------------

type ForeignKey<Name extends string, Column extends string, Target extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ['id'];
};

type Empty = { [_ in never]: never };

export type Database = {
  public: {
    Tables: {
      destinations: {
        Row: Destination;
        Insert: DestinationInsert;
        Update: DestinationUpdate;
        Relationships: [];
      };
      destination_images: {
        Row: DestinationImage;
        Insert: DestinationImageInsert;
        Update: DestinationImageUpdate;
        Relationships: [
          ForeignKey<'destination_images_destination_id_fkey', 'destination_id', 'destinations'>,
        ];
      };
      quiz_questions: {
        Row: QuizQuestion;
        Insert: QuizQuestionInsert;
        Update: QuizQuestionUpdate;
        Relationships: [
          ForeignKey<'quiz_questions_destination_id_fkey', 'destination_id', 'destinations'>,
        ];
      };
      quiz_options: {
        Row: QuizOption;
        Insert: QuizOptionInsert;
        Update: QuizOptionUpdate;
        Relationships: [
          ForeignKey<'quiz_options_question_id_fkey', 'question_id', 'quiz_questions'>,
        ];
      };
      quiz_attempts: {
        Row: QuizAttempt;
        Insert: QuizAttemptInsert;
        Update: QuizAttemptUpdate;
        Relationships: [
          ForeignKey<'quiz_attempts_destination_id_fkey', 'destination_id', 'destinations'>,
        ];
      };
      destination_completions: {
        Row: DestinationCompletion;
        Insert: DestinationCompletionInsert;
        Update: DestinationCompletionUpdate;
        Relationships: [
          ForeignKey<
            'destination_completions_destination_id_fkey',
            'destination_id',
            'destinations'
          >,
        ];
      };
    };
    Views: Empty;
    Functions: Empty;
    Enums: Empty;
    CompositeTypes: Empty;
  };
};
