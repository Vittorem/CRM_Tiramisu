import {
    createContext,
    useContext,
    useEffect,
    useState,
    useMemo,
    ReactNode,
} from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isAdminEmail } from '../lib/adminConstants';
import { useAuth } from '../components/auth/AuthGate';
import { License } from '../services/licenseService';

// ─── Context value ────────────────────────────────────────────────────────────

interface LicenseContextValue {
    /** Whether the current user has full access to the CRM. */
    isAuthorized: boolean;
    /** Whether the current user is the master admin. */
    isAdmin: boolean;
    /** Whether the license has expired (was authorized, now past expiresAt). */
    isExpired: boolean;
    /** Days remaining on the license (null = unlimited or N/A). */
    daysRemaining: number | null;
    /** The raw license document from Firestore. null while loading. */
    license: License | null;
    /** True while the license is being fetched. */
    loading: boolean;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

/**
 * Hook to access the current user's license state.
 * Must be used within `<LicenseProvider>`.
 */
export const useLicense = (): LicenseContextValue => {
    const ctx = useContext(LicenseContext);
    if (!ctx) throw new Error('useLicense must be used within <LicenseProvider>');
    return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LicenseProviderProps {
    children: ReactNode;
}

export const LicenseProvider = ({ children }: LicenseProviderProps) => {
    const { user } = useAuth();
    const [license, setLicense] = useState<License | null>(null);
    const [loading, setLoading] = useState(true);

    const isAdmin = useMemo(() => isAdminEmail(user.email), [user.email]);

    // Real-time listener on the user's license document.
    useEffect(() => {
        const ref = doc(db, 'licenses', user.uid);
        const unsubscribe = onSnapshot(
            ref,
            (snap) => {
                if (snap.exists()) {
                    setLicense(snap.data() as License);
                } else {
                    setLicense(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('License subscription error:', err);
                setLoading(false);
            },
        );
        return () => unsubscribe();
    }, [user.uid]);

    // Derived state
    const derived = useMemo(() => {
        // Admin always authorized
        if (isAdmin) {
            return {
                isAuthorized: true,
                isExpired: false,
                daysRemaining: null,
            };
        }

        if (!license) {
            return {
                isAuthorized: false,
                isExpired: false,
                daysRemaining: null,
            };
        }

        // Check expiration
        const now = new Date();
        let isExpired = false;
        let daysRemaining: number | null = null;

        if (license.expiresAt) {
            const expiryDate = (license.expiresAt as Timestamp).toDate();
            isExpired = expiryDate <= now;
            if (!isExpired) {
                daysRemaining = Math.ceil(
                    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );
            }
        } else if (license.isAuthorized && license.planType === 'unlimited') {
            // Unlimited plan — never expires
            daysRemaining = null;
        }

        const isAuthorized = license.isAuthorized && !isExpired;

        return { isAuthorized, isExpired, daysRemaining };
    }, [license, isAdmin]);

    const value: LicenseContextValue = {
        isAuthorized: derived.isAuthorized,
        isAdmin,
        isExpired: derived.isExpired,
        daysRemaining: derived.daysRemaining,
        license,
        loading,
    };

    return (
        <LicenseContext.Provider value={value}>
            {children}
        </LicenseContext.Provider>
    );
};
