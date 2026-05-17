import { useState } from 'react';
import {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import {
    Button,
    Card,
    Form,
    Input,
    Typography,
    Layout,
    message,
    Divider,
} from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text, Link } = Typography;
const { Content } = Layout;

interface RegisterPageProps {
    onGoLogin: () => void;
}

interface RegisterFormValues {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export const RegisterPage = ({ onGoLogin }: RegisterPageProps) => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm<RegisterFormValues>();

    const handleRegister = async (values: RegisterFormValues) => {
        try {
            setLoading(true);

            // 1. Create account in Firebase Auth (password is hashed server-side, never stored)
            const credential = await createUserWithEmailAndPassword(
                auth,
                values.email,
                values.password
            );

            // 2. Store display name in Firebase Auth profile (not in Firestore, no extra rules needed)
            await updateProfile(credential.user, { displayName: values.name.trim() });

            // 3. Send verification email via Firebase (handled server-side, secure)
            await sendEmailVerification(credential.user);

            message.success('¡Cuenta creada! Revisa tu correo para verificarla.');
            // AuthGate will detect the new user and show EmailVerificationPending automatically
        } catch (error: unknown) {
            const code = (error as { code?: string }).code ?? '';
            console.error('Error de registro:', error);

            if (code === 'auth/email-already-in-use') {
                // Safe to show this specific message: user knows their own email already exists
                message.error('Este email ya está registrado. Intenta iniciar sesión.');
            } else if (code === 'auth/weak-password') {
                message.error('La contraseña es muy débil. Usa al menos 8 caracteres.');
            } else {
                message.error('Error al crear la cuenta. Intenta nuevamente más tarde.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff5f6 0%, #ffd1dc 100%)' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Card
                    style={{
                        width: '100%',
                        maxWidth: 420,
                        borderRadius: 16,
                        boxShadow: '0 8px 32px rgba(74,59,50,0.12)',
                    }}
                >
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <Title level={2} style={{ marginBottom: 4, color: '#3f2b2f' }}>
                            Crear Cuenta
                        </Title>
                        <Text type="secondary">Postres CRM</Text>
                    </div>

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleRegister}
                        autoComplete="on"
                        requiredMark={false}
                    >
                        <Form.Item
                            label="Nombre"
                            name="name"
                            rules={[
                                { required: true, message: 'Ingresa tu nombre' },
                                { min: 2, message: 'El nombre debe tener al menos 2 caracteres' },
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="Tu nombre completo"
                                size="large"
                                autoComplete="name"
                                id="register-name"
                            />
                        </Form.Item>

                        <Form.Item
                            label="Email"
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
                                id="register-email"
                            />
                        </Form.Item>

                        <Form.Item
                            label="Contraseña"
                            name="password"
                            rules={[
                                { required: true, message: 'Ingresa una contraseña' },
                                { min: 8, message: 'La contraseña debe tener al menos 8 caracteres' },
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="Mínimo 8 caracteres"
                                size="large"
                                autoComplete="new-password"
                                id="register-password"
                            />
                        </Form.Item>

                        <Form.Item
                            label="Confirmar Contraseña"
                            name="confirmPassword"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: 'Confirma tu contraseña' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Las contraseñas no coinciden'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="Repite tu contraseña"
                                size="large"
                                autoComplete="new-password"
                                id="register-confirm-password"
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 8 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                size="large"
                                block
                                loading={loading}
                                id="register-submit"
                                style={{ height: 48, fontSize: 16 }}
                            >
                                Crear Cuenta
                            </Button>
                        </Form.Item>
                    </Form>

                    <Divider plain>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            ¿Ya tienes cuenta?{' '}
                            <Link onClick={onGoLogin} id="go-to-login">
                                Inicia sesión
                            </Link>
                        </Text>
                    </Divider>
                </Card>
            </Content>
        </Layout>
    );
};
