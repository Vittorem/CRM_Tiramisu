import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Spin } from 'antd';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { EmailVerificationPending } from './EmailVerificationPending';
import { ensureLicenseExists } from '../../services/licenseService';

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AuthContextValue {
    user: User;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Custom hook to access auth state.
 * The `user` returned here is always verified (email verified or Google account).
 */
export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthGate>');
    return ctx;
};

// ─── AuthGate Component ───────────────────────────────────────────────────────

type AuthView = 'login' | 'register';

interface AuthGateProps {
    children: ReactNode;
}

export const AuthGate = ({ children }: AuthGateProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<AuthView>('login');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Ensure a license document exists for every verified user.
    // Runs once after the user is confirmed authenticated & verified.
    useEffect(() => {
        if (user && user.emailVerified) {
            ensureLicenseExists(user).catch((err) =>
                console.error('Failed to ensure license:', err),
            );
        }
    }, [user?.uid, user?.emailVerified]);

    const logout = () => signOut(auth);

    // ── Loading ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" tip="Cargando..." />
            </div>
        );
    }

    // ── Not logged in ─────────────────────────────────────────────────────────

    if (!user) {
        if (view === 'register') {
            return <RegisterPage onGoLogin={() => setView('login')} />;
        }
        return <LoginPage onGoRegister={() => setView('register')} />;
    }

    // ── Logged in but email not verified (only applies to email/password accounts)
    // Google accounts always have emailVerified = true
    if (!user.emailVerified) {
        return <EmailVerificationPending email={user.email} />;
    }

    // ── Fully authenticated ───────────────────────────────────────────────────

    return (
        <AuthContext.Provider value={{ user, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
