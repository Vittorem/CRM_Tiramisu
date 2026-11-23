import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    QueryConstraint,
    addDoc,
    doc,
    updateDoc,
    Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/auth/AuthGate';
import { createAuditFields, updateAuditFields, softDeleteFields } from '../utils/audit';
import { BaseEntity } from '../types';

// ─── Shared Firestore Subscription Store ──────────────────────────────────────
// Deduplicates identical real-time listeners across mounted components (e.g.
// GlobalAlerts + active pages + drawers) and keeps a brief grace period on
// unmount so fast route switches hydrate instantaneously without re-subscribing.

interface StoreEntry {
    uid: string;
    data: BaseEntity[];
    loading: boolean;
    error: Error | null;
    listeners: Set<() => void>;
    unsubscribe: Unsubscribe | null;
    cleanupTimer: number | null;
}

const subscriptionStore = new Map<string, StoreEntry>();
const CLEANUP_GRACE_MS = 5000;

function clearUserSubscriptions(activeUid: string) {
    for (const [key, entry] of subscriptionStore.entries()) {
        if (entry.uid !== activeUid) {
            if (entry.cleanupTimer !== null) {
                window.clearTimeout(entry.cleanupTimer);
            }
            entry.unsubscribe?.();
            subscriptionStore.delete(key);
        }
    }
}

function getConstraintSignature(constraints: QueryConstraint[]): string {
    if (constraints.length === 0) return '';
    return constraints
        .map(c => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyC = c as any;
            const type = anyC.type ?? 'c';
            const field = anyC._field?.segments?.join?.('.') ?? '';
            const op = anyC._op ?? '';
            const val = anyC._value !== undefined ? JSON.stringify(anyC._value) : '';
            const dir = anyC._direction ?? '';
            const lim = anyC._limit ?? '';
            return `${type}:${field}:${op}:${val}:${dir}:${lim}`;
        })
        .join('|');
}

function acquireSubscription(
    key: string,
    uid: string,
    collectionName: string,
    constraints: QueryConstraint[],
    includeDeleted: boolean
): StoreEntry {
    let entry = subscriptionStore.get(key);
    if (entry) {
        if (entry.cleanupTimer !== null) {
            window.clearTimeout(entry.cleanupTimer);
            entry.cleanupTimer = null;
        }
        return entry;
    }

    entry = {
        uid,
        data: [],
        loading: true,
        error: null,
        listeners: new Set(),
        unsubscribe: null,
        cleanupTimer: null,
    };
    subscriptionStore.set(key, entry);

    const userRef = collection(db, `users/${uid}/${collectionName}`);
    const finalConstraints: QueryConstraint[] = [...constraints];
    if (!includeDeleted) {
        finalConstraints.push(where('isDeleted', '==', false));
    }

    const q = query(userRef, ...finalConstraints);

    entry.unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const items = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            })) as BaseEntity[];
            entry!.data = items;
            entry!.loading = false;
            entry!.error = null;
            entry!.listeners.forEach(fn => fn());
        },
        (err) => {
            console.error(`Firestore subscription error (${collectionName}):`, err);
            entry!.error = err;
            entry!.loading = false;
            entry!.listeners.forEach(fn => fn());
        }
    );

    return entry;
}

function releaseSubscription(key: string, listener: () => void) {
    const entry = subscriptionStore.get(key);
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0 && entry.cleanupTimer === null) {
        entry.cleanupTimer = window.setTimeout(() => {
            const current = subscriptionStore.get(key);
            if (current && current.listeners.size === 0) {
                current.unsubscribe?.();
                subscriptionStore.delete(key);
            }
        }, CLEANUP_GRACE_MS);
    }
}

/**
 * Real-time Firestore subscription hook with shared deduplicated cache.
 * Automatically scoped to the authenticated user's sub-collection.
 * Filters out soft-deleted documents by default (pass `includeDeleted: true` to override).
 * Pass `enabled: false` to defer subscribing (e.g., while a Drawer is closed).
 */
export function useFirestoreSubscription<T extends BaseEntity>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    options?: { includeDeleted?: boolean; enabled?: boolean }
) {
    const { user } = useAuth();
    const includeDeleted = Boolean(options?.includeDeleted);
    const enabled = options?.enabled ?? true;

    const constraintsSig = getConstraintSignature(constraints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableConstraints = useMemo(() => constraints, [constraintsSig]);

    const storeKey = user
        ? `${user.uid}::${collectionName}::${includeDeleted ? 'all' : 'active'}::${constraintsSig}`
        : null;

    const getSnapshotState = useCallback(() => {
        if (!enabled || !storeKey) {
            return { data: [] as T[], loading: false, error: null as Error | null };
        }
        const existing = subscriptionStore.get(storeKey);
        if (existing) {
            return {
                data: existing.data as T[],
                loading: existing.loading,
                error: existing.error,
            };
        }
        return { data: [] as T[], loading: true, error: null as Error | null };
    }, [enabled, storeKey]);

    const [state, setState] = useState(getSnapshotState);

    useEffect(() => {
        if (!user || !enabled || !storeKey) {
            setState({ data: [] as T[], loading: false, error: null });
            return;
        }

        clearUserSubscriptions(user.uid);

        const entry = acquireSubscription(
            storeKey,
            user.uid,
            collectionName,
            stableConstraints,
            includeDeleted
        );

        const sync = () => {
            setState({
                data: entry.data as T[],
                loading: entry.loading,
                error: entry.error,
            });
        };

        entry.listeners.add(sync);
        sync();

        return () => {
            releaseSubscription(storeKey, sync);
        };
    }, [user, enabled, storeKey, collectionName, stableConstraints, includeDeleted]);

    return state;
}

/**
 * Firestore mutation helpers scoped to the authenticated user.
 */
export function useFirestoreMutation<T extends BaseEntity>(collectionName: string) {
    const { user } = useAuth();

    const add = useCallback(async (data: Omit<T, keyof BaseEntity>) => {
        if (!user) throw new Error('No user');

        const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

        return addDoc(collection(db, `users/${user.uid}/${collectionName}`), {
            ...cleanData,
            ...createAuditFields(user.uid),
        });
    }, [user, collectionName]);

    const update = useCallback(async (id: string, data: Partial<Omit<T, keyof BaseEntity>>) => {
        if (!user) throw new Error('No user');
        const ref = doc(db, `users/${user.uid}/${collectionName}`, id);

        const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

        return updateDoc(ref, {
            ...cleanData,
            ...updateAuditFields(user.uid),
        });
    }, [user, collectionName]);

    const softDelete = useCallback(async (id: string) => {
        if (!user) throw new Error('No user');
        const ref = doc(db, `users/${user.uid}/${collectionName}`, id);
        return updateDoc(ref, softDeleteFields(user.uid));
    }, [user, collectionName]);

    return { add, update, softDelete };
}
