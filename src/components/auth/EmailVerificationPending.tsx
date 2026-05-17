import { useState } from 'react';
import {
    sendEmailVerification,
    signOut,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import {
    Button,
    Card,
    Typography,
    Layout,
    Space,
    Alert,
    message,
} from 'antd';
import { MailOutlined, ReloadOutlined, LogoutOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Content } = Layout;

interface EmailVerificationPendingProps {
    /** The email address where the verification was sent */
    email: string | null;
}

export const EmailVerificationPending = ({ email }: EmailVerificationPendingProps) => {
    const [resending, setResending] = useState(false);
    const [reloading, setReloading] = useState(false);

    const handleResend = async () => {
        if (!auth.currentUser) return;
        try {
            setResending(true);
            await sendEmailVerification(auth.currentUser);
            message.success('Correo de verificación reenviado. Revisa tu bandeja de entrada.');
        } catch (error: unknown) {
            const code = (error as { code?: string }).code ?? '';
            console.error('Error reenviando verificación:', error);
            if (code === 'auth/too-many-requests') {
                message.warning('Demasiados intentos. Espera un momento antes de reenviar.');
            } else {
                message.error('No se pudo reenviar el correo. Intenta más tarde.');
            }
        } finally {
            setResending(false);
        }
    };

    const handleReload = async () => {
        if (!auth.currentUser) return;
        try {
            setReloading(true);
            // Force Firebase to refresh the token, which will include the new emailVerified status
            await auth.currentUser.reload();
            // onAuthStateChanged in AuthGate will re-evaluate automatically
            // but we trigger a token refresh to force the UI update
            await auth.currentUser.getIdToken(true);
        } catch (error: unknown) {
            console.error('Error actualizando sesión:', error);
            message.error('Error al verificar. Intenta de nuevo.');
        } finally {
            setReloading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff5f6 0%, #ffd1dc 100%)' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Card
                    style={{
                        width: '100%',
                        maxWidth: 460,
                        textAlign: 'center',
                        borderRadius: 16,
                        boxShadow: '0 8px 32px rgba(74,59,50,0.12)',
                    }}
                >
                    <div style={{ marginBottom: 24 }}>
                        <MailOutlined style={{ fontSize: 48, color: '#db2777', marginBottom: 16 }} />
                        <Title level={3} style={{ marginBottom: 8, color: '#3f2b2f' }}>
                            Verifica tu correo
                        </Title>
                        <Text type="secondary">
                            Hemos enviado un enlace de verificación a:
                        </Text>
                        <br />
                        <Text strong style={{ fontSize: 15 }}>
                            {email ?? 'tu correo'}
                        </Text>
                    </div>

                    <Alert
                        message="Revisa tu bandeja de entrada (y spam)"
                        description="Haz clic en el enlace del correo para activar tu cuenta. Una vez verificado, haz clic en el botón de abajo."
                        type="info"
                        showIcon
                        style={{ marginBottom: 24, textAlign: 'left' }}
                    />

                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            size="large"
                            block
                            loading={reloading}
                            onClick={handleReload}
                            id="verify-reload"
                            style={{ height: 48 }}
                        >
                            Ya verifiqué — Continuar
                        </Button>

                        <Button
                            type="default"
                            size="large"
                            block
                            loading={resending}
                            onClick={handleResend}
                            id="verify-resend"
                            style={{ height: 44 }}
                        >
                            Reenviar correo de verificación
                        </Button>

                        <Button
                            type="text"
                            icon={<LogoutOutlined />}
                            size="middle"
                            onClick={handleLogout}
                            id="verify-logout"
                            danger
                        >
                            Cerrar sesión
                        </Button>
                    </Space>
                </Card>
            </Content>
        </Layout>
    );
};
