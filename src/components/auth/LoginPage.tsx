import { useState } from 'react';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import {
    Button,
    Card,
    Form,
    Input,
    Tabs,
    Typography,
    Layout,
    message,
    Divider,
} from 'antd';
import { GoogleOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text, Link } = Typography;
const { Content } = Layout;

interface LoginPageProps {
    onGoRegister: () => void;
}

export const LoginPage = ({ onGoRegister }: LoginPageProps) => {
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);

    // ─── Google Login ─────────────────────────────────────────────────────────

    const handleGoogleLogin = async () => {
        try {
            setLoadingGoogle(true);
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, provider);
            message.success('¡Bienvenido a Postres CRM!');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            console.error('Error de autenticación Google:', msg);
            message.error('Error al iniciar sesión. Por favor, intenta nuevamente.');
        } finally {
            setLoadingGoogle(false);
        }
    };

    // ─── Email/Password Login ─────────────────────────────────────────────────

    const handleEmailLogin = async (values: { email: string; password: string }) => {
        try {
            setLoadingEmail(true);
            await signInWithEmailAndPassword(auth, values.email, values.password);
            message.success('¡Bienvenido a Postres CRM!');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            console.error('Error de autenticación email:', msg);
            // Generic message – never reveal if the email exists or not
            message.error('Credenciales incorrectas. Verifica tu email y contraseña.');
        } finally {
            setLoadingEmail(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const googleTab = (
        <div style={{ paddingTop: 8 }}>
            <Button
                type="primary"
                icon={<GoogleOutlined />}
                size="large"
                block
                loading={loadingGoogle}
                onClick={handleGoogleLogin}
                style={{ height: 48, fontSize: 16 }}
            >
                Iniciar Sesión con Google
            </Button>
        </div>
    );

    const emailTab = (
        <div style={{ paddingTop: 8 }}>
            <Form
                layout="vertical"
                onFinish={handleEmailLogin}
                autoComplete="on"
                requiredMark={false}
            >
                <Form.Item
                    name="email"
                    rules={[
                        { required: true, message: 'Ingresa tu email' },
                        { type: 'email', message: 'Email inválido' },
                    ]}
                >
                    <Input
                        prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
                        placeholder="correo@ejemplo.com"
                        size="large"
                        autoComplete="email"
                        id="login-email"
                    />
                </Form.Item>
                <Form.Item
                    name="password"
                    rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
                >
                    <Input.Password
                        prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                        placeholder="Contraseña"
                        size="large"
                        autoComplete="current-password"
                        id="login-password"
                    />
                </Form.Item>
                <Form.Item style={{ marginBottom: 8 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loadingEmail}
                        id="login-submit"
                        style={{ height: 48, fontSize: 16 }}
                    >
                        Iniciar Sesión
                    </Button>
                </Form.Item>
            </Form>
            <Divider plain>
                <Text type="secondary" style={{ fontSize: 13 }}>
                    ¿No tienes cuenta?{' '}
                    <Link onClick={onGoRegister} id="go-to-register">
                        Regístrate
                    </Link>
                </Text>
            </Divider>
        </div>
    );

    const items = [
        { key: 'google', label: 'Google', children: googleTab },
        { key: 'email', label: 'Email / Contraseña', children: emailTab },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff5f6 0%, #ffd1dc 100%)' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Card
                    style={{
                        width: '100%',
                        maxWidth: 420,
                        textAlign: 'center',
                        borderRadius: 16,
                        boxShadow: '0 8px 32px rgba(74,59,50,0.12)',
                    }}
                >
                    <div style={{ marginBottom: 24 }}>
                        <Title level={2} style={{ marginBottom: 4, color: '#3f2b2f' }}>
                            Postres CRM
                        </Title>
                        <Text type="secondary">Sistema de Gestión y Pedidos</Text>
                    </div>
                    <Tabs
                        defaultActiveKey="google"
                        centered
                        items={items}
                        id="login-tabs"
                    />
                </Card>
            </Content>
        </Layout>
    );
};
