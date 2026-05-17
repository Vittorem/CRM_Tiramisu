import { Statistic, Space, Divider, Typography, theme } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Order } from '../../../types';

const { Text } = Typography;

interface OrderSummaryProps {
    orders: Order[];
}

export const OrderSummary = ({ orders }: OrderSummaryProps) => {
    // Summary Statistics Logic
    const activeOrders = orders.filter(o =>
        ['Confirmado', 'En preparación', 'Listo para entregar'].includes(o.status)
    );

    const pendingPrep = activeOrders.filter(o => ['Confirmado', 'En preparación'].includes(o.status));
    const ready = activeOrders.filter(o => o.status === 'Listo para entregar');

    const stats = {
        total: activeOrders.length,
        readyCount: ready.length,
        pendingCount: pendingPrep.length,
        bySize: pendingPrep.reduce((acc, order) => {
            const processItem = (name: string, qty: number) => {
                const n = name.toLowerCase();
                if (n.includes('chico') || n.includes('pequeño') || n.includes('bambino')) acc.chico += qty;
                else if (n.includes('mediano')) acc.mediano += qty;
                else if (n.includes('grande')) acc.grande += qty;
                else acc.otro += qty;
            };

            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    processItem(item.productNameAtSale || '', item.quantity || 1);
                });
            } else {
                processItem(order.productNameAtSale || '', order.quantity || 1);
            }
            return acc;
        }, { chico: 0, mediano: 0, grande: 0, otro: 0 })
    };

    const { token: { colorBgContainer, colorBorder } } = theme.useToken();

    return (
        <div style={{ display: 'flex', alignItems: 'center', background: colorBgContainer, padding: '16px 24px', borderRadius: 8, border: `1px solid ${colorBorder}`, width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Statistic
                    title="Progreso"
                    value={stats.readyCount}
                    suffix={`/ ${stats.total}`}
                    valueStyle={{ fontSize: 16, color: '#3f8600' }}
                    prefix={<CheckCircleOutlined />}
                />
            </div>
            <Divider type="vertical" style={{ height: 40, top: 'auto' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Statistic
                    title="Por Preparar"
                    value={stats.pendingCount}
                    valueStyle={{ fontSize: 16, color: '#cf1322' }}
                    prefix={<ClockCircleOutlined />}
                />
            </div>
            <Divider type="vertical" style={{ height: 40, top: 'auto' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Space direction="vertical" size={0} style={{ fontSize: 12, minWidth: 150 }}>
                    <Text type="secondary">Chico: {stats.bySize.chico}</Text>
                    <Text type="secondary">Mediano: {stats.bySize.mediano}</Text>
                    <Text type="secondary">Grande: {stats.bySize.grande}</Text>
                </Space>
            </div>
        </div>
    );
};
