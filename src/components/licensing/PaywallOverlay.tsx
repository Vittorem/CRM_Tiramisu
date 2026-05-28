import { useState } from 'react';
import { Modal, Button, Typography, Divider, Space, Tag, theme } from 'antd';
import {
    CrownOutlined,
    CheckCircleOutlined,
    WhatsAppOutlined,
    MailOutlined,
    BankOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../App';

const { Title, Text, Paragraph } = Typography;

interface PaywallOverlayProps {
    /** Whether the overlay is visible. */
    visible: boolean;
    /** Called when the user dismisses the overlay to continue exploring. */
    onDismiss: () => void;
}

/**
 * Premium paywall modal shown to unauthorized users.
 * Displays plan info, benefits, and payment instructions.
 */
export const PaywallOverlay = ({ visible, onDismiss }: PaywallOverlayProps) => {
    const { isDarkMode } = useTheme();
    const {
        token: { colorPrimary },
    } = theme.useToken();
    const [showPaymentInfo, setShowPaymentInfo] = useState(false);

    const benefits = [
        'Gestión completa de clientes (B2C y B2B)',
        'Sistema de pedidos con Kanban y carrito',
        'Dashboard con KPIs y gráficas en tiempo real',
        'Control de inventario con alertas de stock',
        'Recetario con costeo automático por receta',
        'Reportes avanzados y análisis de comportamiento',
        'Exportación a Excel y PDF',
        'Soporte prioritario por WhatsApp',
    ];

    return (
        <Modal
            open={visible}
            onCancel={onDismiss}
            footer={null}
            width={520}
            centered
            closable
            maskClosable
            styles={{
                body: { padding: 0 },
                content: {
                    borderRadius: 20,
                    overflow: 'hidden',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
                },
            }}
        >
            {/* Hero gradient header */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #db2777 0%, #9333ea 50%, #6366f1 100%)',
                    padding: '32px 32px 24px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: 28,
                }}>
                    <CrownOutlined style={{ color: '#fff' }} />
                </div>
                <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
                    Desbloquea todo el poder del CRM
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, display: 'block', marginTop: 8 }}>
                    Accede a todas las funciones para impulsar tu negocio de repostería
                </Text>
            </div>

            {/* Benefits list */}
            <div style={{ padding: '24px 32px' }}>
                <Text strong style={{ fontSize: 13, letterSpacing: '0.5px', color: colorPrimary, display: 'block', marginBottom: 12 }}>
                    LO QUE INCLUYE TU SUSCRIPCIÓN
                </Text>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {benefits.map((benefit, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <CheckCircleOutlined style={{ color: '#10b981', fontSize: 16, marginTop: 2, flexShrink: 0 }} />
                            <Text style={{ fontSize: 14 }}>{benefit}</Text>
                        </div>
                    ))}
                </Space>

                <Divider />

                {/* Payment section */}
                {!showPaymentInfo ? (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Button
                            type="primary"
                            size="large"
                            block
                            icon={<BankOutlined />}
                            onClick={() => setShowPaymentInfo(true)}
                            style={{
                                height: 52,
                                fontSize: 16,
                                fontWeight: 700,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #db2777 0%, #9333ea 100%)',
                                border: 'none',
                                boxShadow: '0 4px 15px rgba(219, 39, 119, 0.35)',
                            }}
                        >
                            Ver información de pago
                        </Button>
                        <Button
                            type="default"
                            size="large"
                            block
                            onClick={onDismiss}
                            style={{ height: 48, borderRadius: 12, fontWeight: 500 }}
                        >
                            Seguir explorando
                        </Button>
                    </Space>
                ) : (
                    <div>
                        <div style={{
                            background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8f4ff',
                            borderRadius: 12,
                            padding: '20px',
                            border: `1px solid ${isDarkMode ? 'rgba(147, 51, 234, 0.2)' : 'rgba(147, 51, 234, 0.15)'}`,
                        }}>
                            <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 15 }}>
                                <BankOutlined style={{ marginRight: 8, color: colorPrimary }} />
                                Datos para transferencia bancaria
                            </Text>
                            <div style={{ display: 'grid', gap: 8 }}>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Banco</Text>
                                    <Text style={{ display: 'block', fontWeight: 600 }}>Por confirmar con el administrador</Text>
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Referencia</Text>
                                    <Text style={{ display: 'block', fontWeight: 600 }}>Tu correo de registro</Text>
                                </div>
                            </div>
                        </div>

                        <Divider style={{ margin: '16px 0' }}>
                            <Tag color="purple">O contáctanos directamente</Tag>
                        </Divider>

                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Button
                                type="default"
                                size="large"
                                block
                                icon={<WhatsAppOutlined style={{ color: '#25D366' }} />}
                                href="https://wa.me/5218000000000?text=Hola%2C%20me%20interesa%20activar%20mi%20cuenta%20del%20CRM%20Repostería"
                                target="_blank"
                                style={{ height: 48, borderRadius: 12, fontWeight: 500 }}
                            >
                                WhatsApp
                            </Button>
                            <Button
                                type="default"
                                size="large"
                                block
                                icon={<MailOutlined style={{ color: '#db2777' }} />}
                                href="mailto:vittorem19@gmail.com?subject=Activar%20CRM%20Repostería"
                                target="_blank"
                                style={{ height: 48, borderRadius: 12, fontWeight: 500 }}
                            >
                                Enviar correo
                            </Button>
                            <Button
                                type="text"
                                block
                                onClick={() => { setShowPaymentInfo(false); onDismiss(); }}
                                style={{ fontWeight: 500, color: isDarkMode ? '#aaa' : '#666' }}
                            >
                                Cerrar y seguir explorando
                            </Button>
                        </Space>
                    </div>
                )}

                <Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, margin: '16px 0 0' }}>
                    Una vez confirmado tu pago, tu cuenta será activada en un máximo de 24 horas.
                </Paragraph>
            </div>
        </Modal>
    );
};
