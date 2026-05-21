import { useState, useMemo } from 'react';
import { Card, Row, Col, Typography, List as AntList, Tag, Button, theme, Table, Skeleton } from 'antd';
import { WhatsAppOutlined, MessageOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { useFirestoreSubscription } from '../../hooks/useFirestore';
import { Customer, Order } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTheme } from '../../App';
import {
    computeCustomerRFMScores,
    aggregateRFMSegments,
    formatRFMForChart,
    type RFMSegment,
    type CustomerRFMScore
} from '../../utils/rfmAnalysis';

const { Title, Text } = Typography;

const COLORS = {
    'Champions': '#10b981',           // Green
    'Loyal': '#3b82f6',               // Blue
    'Potential Loyalists': '#8b5cf6', // Purple
    'At Risk': '#f59e0b',             // Orange/Yellow
    'Hibernating': '#ef4444'          // Red
};

const SEGMENT_DESCRIPTIONS = {
    'Champions': {
        title: 'Campeones',
        desc: 'Compran muy seguido, recientemente y gastan bien. ¡Tus mejores clientes!',
        action: 'Manténlos felices con detalles exclusivos o lanzamientos anticipados.',
        emoji: '🏆',
        color: '#10b981',
        message: (name: string) => `¡Hola ${name}! Queremos agradecerte por ser uno de nuestros clientes estrella en Postres CRM. ¡Nos alegra mucho endulzar tus días! 🍰🌟`
    },
    'Loyal': {
        title: 'Leales',
        desc: 'Compran regularmente. Responden muy bien a las promociones.',
        action: 'Agradece su lealtad con mensajes personalizados o promociones especiales.',
        emoji: '💖',
        color: '#3b82f6',
        message: (name: string) => `¡Hola ${name}! Gracias por tu preferencia constante en Postres CRM. ¡Esperamos volver a verte pronto con tus postres favoritos! 🧁✨`
    },
    'Potential Loyalists': {
        title: 'Leales Potenciales',
        desc: 'Clientes recientes con buena frecuencia y ticket prometedor.',
        action: 'Ofréceles recomendaciones personalizadas de postres o un incentivo rápido.',
        emoji: '🌱',
        color: '#8b5cf6',
        message: (name: string) => `¡Hola ${name}! Gracias por tus compras recientes en Postres CRM. ¿Se te antoja algo dulce hoy? ¡Mira nuestro menú de repostería! 🍪🥧`
    },
    'At Risk': {
        title: 'En Riesgo',
        desc: 'Compraban seguido pero no han ordenado recientemente. ¡Peligro de perderlos!',
        action: 'Envíales una oferta de reactivación ("Te extrañamos") o descuento especial.',
        emoji: '⚠️',
        color: '#f59e0b',
        message: (name: string) => `¡Hola ${name}! Te extrañamos en Postres CRM. ¡Te regalamos un 10% de descuento en tu siguiente pedido para volver a consentirte! 🍰🎁`
    },
    'Hibernating': {
        title: 'En Hibernación',
        desc: 'Bajo recuento de pedidos, bajo gasto y hace mucho no compran.',
        action: 'Intenta reconectar con un postre de temporada o una promoción de valor.',
        emoji: '💤',
        color: '#ef4444',
        message: (name: string) => `¡Hola ${name}! Hace tiempo que no sabemos de ti. ¡Tenemos nuevas recetas y postres deliciosos esperándote en Postres CRM! 🧁🧁`
    }
};

export const BehaviorPage = () => {
    const isMobile = useIsMobile();
    const { isDarkMode } = useTheme();
    const { token: { colorBgContainer, colorBorderSecondary, colorTextSecondary, colorText, colorPrimary } } = theme.useToken();

    const { data: customers, loading: loadingCustomers } = useFirestoreSubscription<Customer>('customers');
    const { data: orders, loading: loadingOrders } = useFirestoreSubscription<Order>('orders');

    const [selectedSegment, setSelectedSegment] = useState<RFMSegment>('Champions');

    if (loadingCustomers || loadingOrders) {
        return (
            <div style={{ padding: 24 }}>
                <Card bordered={false} style={{ background: colorBgContainer }}>
                    <Skeleton active paragraph={{ rows: 8 }} />
                </Card>
            </div>
        );
    }

    // ─── RFM Computations ──────────────────────────────────────────

    const rfmScores = useMemo(() => {
        if (!customers.length || !orders.length) return [];
        return computeCustomerRFMScores(customers, orders, dayjs());
    }, [customers, orders]);

    const rfmSegments = useMemo(() => {
        if (!rfmScores.length) return [];
        return aggregateRFMSegments(rfmScores);
    }, [rfmScores]);

    const rfmChartData = useMemo(() => {
        if (!rfmSegments.length) return [];
        return formatRFMForChart(rfmSegments).map(item => ({
            ...item,
            fill: COLORS[item.name as RFMSegment] || '#8c8c8c'
        }));
    }, [rfmSegments]);

    const customersBySegmentMap = useMemo(() => {
        const map: Record<RFMSegment, (CustomerRFMScore & { customerName: string; phone: string })[]> = {
            'Champions': [],
            'Loyal': [],
            'Potential Loyalists': [],
            'At Risk': [],
            'Hibernating': []
        };

        rfmScores.forEach(score => {
            const cust = customers.find(c => c.id === score.customerId);
            if (cust) {
                map[score.segment].push({
                    ...score,
                    customerName: cust.fullName,
                    phone: cust.phone
                });
            }
        });

        // Sort by monetary score (descending)
        Object.keys(map).forEach(key => {
            map[key as RFMSegment].sort((a, b) => b.totalSpent - a.totalSpent);
        });

        return map;
    }, [rfmScores, customers]);

    const handleSendWhatsApp = (custName: string, phone: string, segment: RFMSegment) => {
        const config = SEGMENT_DESCRIPTIONS[segment];
        const firstName = custName.split(' ')[0];
        const messageText = config.message(firstName);
        const encodedText = encodeURIComponent(messageText);
        const url = `https://wa.me/${phone}?text=${encodedText}`;
        window.open(url, '_blank');
    };

    const currentSegmentStats = useMemo(() => {
        return rfmSegments.find(s => s.segment === selectedSegment) || {
            segment: selectedSegment,
            count: 0,
            totalRevenue: 0,
            avgOrderValue: 0
        };
    }, [rfmSegments, selectedSegment]);

    const activeCustomersList = customersBySegmentMap[selectedSegment] || [];

    const columns = [
        {
            title: 'Cliente',
            dataIndex: 'customerName',
            key: 'customerName',
            render: (text: string) => <strong style={{ color: colorText }}>{text}</strong>,
        },
        {
            title: 'Último Pedido',
            dataIndex: 'lastOrderDate',
            key: 'lastOrderDate',
            render: (date: dayjs.Dayjs | null) => date ? date.format('DD/MM/YYYY') : 'N/A',
        },
        {
            title: 'Pedidos',
            dataIndex: 'orderCount',
            key: 'orderCount',
            align: 'center' as const,
        },
        {
            title: 'Gasto Total',
            dataIndex: 'totalSpent',
            key: 'totalSpent',
            render: (val: number) => `$${val.toFixed(2)}`,
        },
        {
            title: 'Contacto',
            key: 'action',
            render: (_: unknown, record: any) => (
                <Button
                    type="primary"
                    icon={<WhatsAppOutlined />}
                    style={{ background: '#25D366', borderColor: '#25D366' }}
                    onClick={() => handleSendWhatsApp(record.customerName, record.phone, selectedSegment)}
                >
                    Notificar
                </Button>
            ),
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
                    📊 Análisis de Comportamiento (RFM)
                </Title>
                <Text type="secondary">
                    Identifica patrones de compra y segmenta a tus clientes para enviar campañas dirigidas.
                </Text>
            </div>

            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                {/* Segment Selector & Chart */}
                <Col xs={24} lg={10}>
                    <Card
                        title="Distribución de Clientes"
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow: isDarkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.2)' : '0 8px 32px 0 rgba(0,0,0,0.02)',
                            background: colorBgContainer
                        }}
                    >
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={rfmChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={4}
                                >
                                    {rfmChartData.map((entry, index) => (
                                        <Cell key={index} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: colorBgContainer, borderColor: colorBorderSecondary, color: colorText, borderRadius: 8 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Segment Labels Grid */}
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                            {(Object.keys(SEGMENT_DESCRIPTIONS) as RFMSegment[]).map(key => {
                                const count = rfmSegments.find(s => s.segment === key)?.count || 0;
                                const isSelected = selectedSegment === key;
                                return (
                                    <Tag
                                        key={key}
                                        color={isSelected ? 'processing' : 'default'}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '4px 10px',
                                            borderRadius: 8,
                                            fontSize: 12,
                                            border: `1px solid ${isSelected ? colorPrimary : colorBorderSecondary}`,
                                            fontWeight: isSelected ? 700 : 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}
                                        onClick={() => setSelectedSegment(key)}
                                    >
                                        <span style={{ color: COLORS[key], fontSize: 14 }}>●</span>
                                        <span style={{ color: colorText }}>{SEGMENT_DESCRIPTIONS[key].title} ({count})</span>
                                    </Tag>
                                );
                            })}
                        </div>
                    </Card>
                </Col>

                {/* Segment Detail Info */}
                <Col xs={24} lg={14}>
                    <Card
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 24 }}>{SEGMENT_DESCRIPTIONS[selectedSegment].emoji}</span>
                                <div>
                                    <span style={{ fontWeight: 800, fontSize: 18 }}>
                                        {SEGMENT_DESCRIPTIONS[selectedSegment].title}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 12, color: colorTextSecondary, fontWeight: 400 }}>
                                        {currentSegmentStats.count} cliente(s) en este segmento
                                    </span>
                                </div>
                            </div>
                        }
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow: isDarkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.2)' : '0 8px 32px 0 rgba(0,0,0,0.02)',
                            background: colorBgContainer,
                            height: '100%',
                            borderLeft: `6px solid ${COLORS[selectedSegment]}`
                        }}
                    >
                        <div style={{ marginBottom: 20 }}>
                            <Title level={5} style={{ margin: '0 0 4px 0', color: colorText }}>Comportamiento</Title>
                            <Text style={{ color: colorTextSecondary }}>{SEGMENT_DESCRIPTIONS[selectedSegment].desc}</Text>
                        </div>

                        <div style={{ marginBottom: 20, padding: 12, borderRadius: 10, background: isDarkMode ? '#221417' : '#fff9fb', border: `1px dashed ${colorBorderSecondary}` }}>
                            <Title level={5} style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: colorPrimary }}>
                                <MessageOutlined /> Acción Recomendada CRM
                            </Title>
                            <Text style={{ color: colorText, fontSize: 13 }}>{SEGMENT_DESCRIPTIONS[selectedSegment].action}</Text>
                        </div>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Card size="small" style={{ background: isDarkMode ? '#1e1013' : '#fafafa', borderRadius: 8, border: `1px solid ${colorBorderSecondary}` }}>
                                    <span style={{ fontSize: 12, color: colorTextSecondary }}>Venta Acumulada</span>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS[selectedSegment] }}>
                                        ${currentSegmentStats.totalRevenue.toFixed(2)}
                                    </div>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" style={{ background: isDarkMode ? '#1e1013' : '#fafafa', borderRadius: 8, border: `1px solid ${colorBorderSecondary}` }}>
                                    <span style={{ fontSize: 12, color: colorTextSecondary }}>Ticket Promedio</span>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: colorText }}>
                                        ${currentSegmentStats.avgOrderValue.toFixed(2)}
                                    </div>
                                </Card>
                            </Col>
                        </Row>
                    </Card>
                </Col>
            </Row>

            {/* Customers list for the selected segment */}
            <Card
                title={<span>👥 Lista de Clientes — Segmento {SEGMENT_DESCRIPTIONS[selectedSegment].title}</span>}
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: isDarkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.2)' : '0 8px 32px 0 rgba(0,0,0,0.02)',
                    background: colorBgContainer
                }}
            >
                {activeCustomersList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: colorTextSecondary }}>
                        Sin clientes en este segmento de comportamiento.
                    </div>
                ) : isMobile ? (
                    <AntList
                        dataSource={activeCustomersList}
                        renderItem={item => (
                            <div style={{ 
                                padding: '16px 8px', 
                                borderBottom: `1px solid ${colorBorderSecondary}`,
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: 6
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: 15, color: colorText }}>{item.customerName}</strong>
                                    <span style={{ color: COLORS[selectedSegment], fontWeight: 700 }}>${item.totalSpent.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: colorTextSecondary }}>
                                    <div>Pedidos: {item.orderCount}</div>
                                    <div>Último: {item.lastOrderDate ? item.lastOrderDate.format('DD/MM/YYYY') : 'N/A'}</div>
                                </div>
                                <div style={{ marginTop: 6 }}>
                                    <Button
                                        block
                                        type="primary"
                                        icon={<WhatsAppOutlined />}
                                        style={{ background: '#25D366', borderColor: '#25D366' }}
                                        onClick={() => handleSendWhatsApp(item.customerName, item.phone, selectedSegment)}
                                    >
                                        Contactar por WhatsApp
                                    </Button>
                                </div>
                            </div>
                        )}
                    />
                ) : (
                    <Table
                        dataSource={activeCustomersList}
                        columns={columns}
                        rowKey="customerId"
                        pagination={{ pageSize: 8 }}
                    />
                )}
            </Card>
        </div>
    );
};
