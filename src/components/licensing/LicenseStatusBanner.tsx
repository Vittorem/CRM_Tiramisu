import { Alert, Button } from 'antd';
import {
    WarningOutlined,
    ClockCircleOutlined,
    LockOutlined,
} from '@ant-design/icons';
import { useLicense } from '../../contexts/LicenseContext';

interface LicenseStatusBannerProps {
    /** Called when the user clicks the CTA to open the paywall. */
    onActivate: () => void;
}

/**
 * Sticky banner shown below the header for:
 *  - Unauthorized users (invite to activate)
 *  - Users whose license is expiring soon (< 7 days)
 *  - Hidden for admin and fully authorized users with > 7 days
 */
export const LicenseStatusBanner = ({ onActivate }: LicenseStatusBannerProps) => {
    const { isAuthorized, isAdmin, isExpired, daysRemaining, loading } = useLicense();

    if (loading || isAdmin) return null;

    // ── Expired license ──────────────────────────────────────────────────
    if (isExpired) {
        return (
            <Alert
                type="error"
                showIcon
                icon={<LockOutlined />}
                banner
                message={
                    <span>
                        Tu suscripción ha expirado.{' '}
                        <Button
                            type="link"
                            size="small"
                            onClick={onActivate}
                            style={{ padding: 0, fontWeight: 700 }}
                        >
                            Renueva ahora
                        </Button>{' '}
                        para seguir utilizando todas las funciones.
                    </span>
                }
                style={{ borderRadius: 0 }}
            />
        );
    }

    // ── Not authorized (never activated) ─────────────────────────────────
    if (!isAuthorized) {
        return (
            <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                banner
                message={
                    <span>
                        Tu cuenta no está activada. Estás en modo exploración.{' '}
                        <Button
                            type="link"
                            size="small"
                            onClick={onActivate}
                            style={{ padding: 0, fontWeight: 700 }}
                        >
                            Activa tu suscripción
                        </Button>{' '}
                        para desbloquear todas las funciones.
                    </span>
                }
                style={{ borderRadius: 0 }}
            />
        );
    }

    // ── Expiring soon (< 7 days remaining) ───────────────────────────────
    if (daysRemaining !== null && daysRemaining <= 7) {
        return (
            <Alert
                type="info"
                showIcon
                icon={<ClockCircleOutlined />}
                banner
                message={
                    <span>
                        Tu suscripción vence en <strong>{daysRemaining} día{daysRemaining !== 1 ? 's' : ''}</strong>.{' '}
                        <Button
                            type="link"
                            size="small"
                            onClick={onActivate}
                            style={{ padding: 0, fontWeight: 700 }}
                        >
                            Renueva ahora
                        </Button>{' '}
                        para mantener el acceso sin interrupciones.
                    </span>
                }
                style={{ borderRadius: 0 }}
            />
        );
    }

    // Authorized with plenty of time — no banner
    return null;
};
