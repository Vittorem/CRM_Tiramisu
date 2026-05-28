/**
 * Admin / Licensing constants for CRM Tiramisu.
 *
 * The master email is hardcoded here and mirrored in firestore.rules.
 * Security relies on Firestore Rules, not on hiding this value.
 */

export const ADMIN_EMAIL = 'vittorem19@gmail.com';

/** Check whether a given email belongs to the master admin. */
export const isAdminEmail = (email: string | null | undefined): boolean =>
    email?.toLowerCase().trim() === ADMIN_EMAIL;

/** Plan durations used by the licensing system. */
export type PlanType = '30d' | '1y' | 'unlimited';

export const PLAN_LABELS: Record<PlanType, string> = {
    '30d': '30 Días',
    '1y': '1 Año',
    unlimited: 'Indefinido',
};

export const PLAN_DAYS: Record<PlanType, number | null> = {
    '30d': 30,
    '1y': 365,
    unlimited: null, // never expires
};
