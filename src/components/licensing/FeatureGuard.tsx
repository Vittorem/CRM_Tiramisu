import { ReactNode } from 'react';
import { Tooltip, theme } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useLicense } from '../../contexts/LicenseContext';

interface FeatureGuardProps {
    /** The wrapped content — rendered in all cases, but interactions blocked when unauthorized. */
    children: ReactNode;
    /** Short label describing what this section does (shown in the tooltip). */
    featureLabel: string;
    /** Whether to show a tooltip on hover when locked (default: true). */
    showTooltip?: boolean;
    /** Callback when the user clicks the locked area. Typically opens the PaywallOverlay. */
    onLockedClick?: () => void;
}

/**
 * Wraps CRM sections. When the user is NOT authorized:
 *  - Renders children with a semi-transparent overlay
 *  - Blocks pointer events on the content
 *  - Shows a tooltip explaining the feature and inviting to unlock
 *  - Calls `onLockedClick` when the overlay is clicked
 */
export const FeatureGuard = ({
    children,
    featureLabel,
    showTooltip = true,
    onLockedClick,
}: FeatureGuardProps) => {
    const { isAuthorized, loading } = useLicense();
    const {
        token: { colorPrimary },
    } = theme.useToken();

    // While loading or when authorized, render children transparently
    if (loading || isAuthorized) {
        return <>{children}</>;
    }

    const overlay = (
        <div
            style={{ position: 'relative', width: '100%', minHeight: 120 }}
            onClick={(e) => {
                e.stopPropagation();
                onLockedClick?.();
            }}
        >
            {/* Blurred content behind */}
            <div
                style={{
                    filter: 'blur(2px)',
                    opacity: 0.55,
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {children}
            </div>

            {/* Lock overlay */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 5,
                    borderRadius: 12,
                    transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(219, 39, 119, 0.04)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
            >
                <div
                    style={{
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: 12,
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                        border: '1px solid rgba(219, 39, 119, 0.12)',
                    }}
                >
                    <LockOutlined style={{ color: colorPrimary, fontSize: 18 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#3f2b2f' }}>
                        {featureLabel} — <span style={{ color: colorPrimary }}>Desbloquear</span>
                    </span>
                </div>
            </div>
        </div>
    );

    if (!showTooltip) return overlay;

    return (
        <Tooltip
            title={`${featureLabel}. Activa tu suscripción para usar esta función.`}
            placement="top"
            color={colorPrimary}
        >
            {overlay}
        </Tooltip>
    );
};
