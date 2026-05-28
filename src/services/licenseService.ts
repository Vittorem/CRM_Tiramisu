import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { PlanType, PLAN_DAYS, isAdminEmail } from '../lib/adminConstants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface License {
    email: string;
    displayName: string;
    isAuthorized: boolean;
    planType: PlanType | null;
    authorizedAt: Timestamp | null;
    expiresAt: Timestamp | null;
    authorizedBy: string | null;
    notes: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const licensesCol = () => collection(db, 'licenses');
const licenseDoc = (uid: string) => doc(db, 'licenses', uid);

function calculateExpiry(planType: PlanType): Timestamp | null {
    const days = PLAN_DAYS[planType];
    if (days === null) return null; // unlimited
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return Timestamp.fromDate(expiry);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called once after a user registers / logs in for the first time.
 * Creates a license document with `isAuthorized: false` (or true if admin).
 * Idempotent — skips if the doc already exists.
 */
export async function ensureLicenseExists(user: User): Promise<void> {
    const ref = licenseDoc(user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return; // already present

    const isAdmin = isAdminEmail(user.email);

    const license: License = {
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        isAuthorized: isAdmin, // admin auto-authorized
        planType: isAdmin ? 'unlimited' : null,
        authorizedAt: isAdmin ? Timestamp.now() : null,
        expiresAt: null,
        authorizedBy: isAdmin ? user.uid : null,
        notes: '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    await setDoc(ref, license);
}

/**
 * Fetch all license documents (admin-only operation).
 */
export async function fetchAllLicenses(): Promise<(License & { uid: string })[]> {
    const snap = await getDocs(licensesCol());
    return snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as License),
    }));
}

/**
 * Authorize a user with a specific plan.
 */
export async function authorizeLicense(
    uid: string,
    planType: PlanType,
    adminUid: string,
    notes?: string,
): Promise<void> {
    const ref = licenseDoc(uid);
    await updateDoc(ref, {
        isAuthorized: true,
        planType,
        authorizedAt: serverTimestamp(),
        expiresAt: calculateExpiry(planType),
        authorizedBy: adminUid,
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Revoke a user's license.
 */
export async function revokeLicense(uid: string): Promise<void> {
    const ref = licenseDoc(uid);
    await updateDoc(ref, {
        isAuthorized: false,
        updatedAt: serverTimestamp(),
    });
}
