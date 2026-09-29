// Ce fichier est écrit à la main pour démarrer le projet.
// Une fois le projet Supabase créé et la migration appliquée, régénère-le
// automatiquement avec :
//   npx supabase gen types typescript --project-id <ton-project-id> > src/lib/supabase/database.types.ts
// pour rester parfaitement synchronisé avec la vraie base.

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";

export interface Database {
  public: {
    Tables: {
      ingredients: {
        Row: {
          id: string;
          name: string;
          default_unit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          default_unit: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ingredients"]["Insert"]>;
      };
      dishes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          photo_url: string | null;
          calories: number | null;
          protein_g: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          photo_url?: string | null;
          calories?: number | null;
          protein_g?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dishes"]["Insert"]>;
      };
      dish_ingredients: {
        Row: {
          id: string;
          dish_id: string;
          ingredient_id: string;
          quantity: number;
          unit: string;
        };
        Insert: {
          id?: string;
          dish_id: string;
          ingredient_id: string;
          quantity: number;
          unit: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["dish_ingredients"]["Insert"]
        >;
      };
      meal_cycles: {
        Row: {
          id: string;
          name: string;
          duration_days: number;
          start_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          duration_days: number;
          start_date: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meal_cycles"]["Insert"]>;
      };
      meal_cycle_entries: {
        Row: {
          id: string;
          meal_cycle_id: string;
          day_offset: number;
          meal_slot: MealSlot;
          dish_id: string;
        };
        Insert: {
          id?: string;
          meal_cycle_id: string;
          day_offset: number;
          meal_slot: MealSlot;
          dish_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["meal_cycle_entries"]["Insert"]
        >;
      };
      planned_meals: {
        Row: {
          id: string;
          date: string;
          meal_slot: MealSlot;
          dish_id: string | null;
          meal_cycle_id: string | null;
          special: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          meal_slot: MealSlot;
          dish_id?: string | null;
          meal_cycle_id?: string | null;
          special?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["planned_meals"]["Insert"]
        >;
      };
      shopping_list_items: {
        Row: {
          id: string;
          ingredient_id: string;
          period_start: string | null;
          period_end: string | null;
          quantity: number;
          unit: string;
          is_checked: boolean;
          is_bought: boolean;
          section: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ingredient_id: string;
          period_start?: string | null;
          period_end?: string | null;
          quantity: number;
          unit: string;
          is_checked?: boolean;
          is_bought?: boolean;
          section?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["shopping_list_items"]["Insert"]
        >;
      };
      saved_weeks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_weeks"]["Insert"]>;
      };
      saved_week_entries: {
        Row: {
          id: string;
          saved_week_id: string;
          day_offset: number;
          meal_slot: MealSlot;
          dish_id: string | null;
          special: string | null;
        };
        Insert: {
          id?: string;
          saved_week_id: string;
          day_offset: number;
          meal_slot: MealSlot;
          dish_id?: string | null;
          special?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["saved_week_entries"]["Insert"]>;
      };
    };
  };
}
