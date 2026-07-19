import type { V3ProgramMealPlan } from "@/lib/campfit/v3/catalogRepository"

export const MEAL_REDUCTION_RATES: Readonly<Record<V3ProgramMealPlan, number>> = {
  none: 0,
  weekday_lunch: 0.18,
  weekday_two_meals: 0.35,
  full_board: 0.55,
}

export const TRANSPORT_REDUCTION_RATES = {
  shuttleIncluded: 0.6,
} as const

export const ACCOMMODATION_CAPACITY: Readonly<Record<string, number>> = {
  Studio: 2,
  Residence: 2,
  "1BR": 3,
  Hotel: 3,
  Homestay: 4,
  "2BR": 5,
}

export const ACCOMMODATION_UPGRADE_ORDER = ["Studio", "Residence", "1BR", "Hotel", "Homestay", "2BR"] as const
