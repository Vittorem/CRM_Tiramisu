import { useMemo, useState } from 'react';
import { Badge, Drawer, List, Button, Typography, Tag, Space } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useFirestoreSubscription } from '../../hooks/useFirestore';
import { Order, Customer, InventoryItem } from '../../types';
import { generateIntelligentAlerts, PeriodMetrics } from '../../utils/intelligentAlerts';
import { getDeliveredOrdersInRange } from '../../utils/dateHelpers';

export const GlobalAlerts = () => {
    const { data: orders } = useFirestoreSubscription<Order>('orders');
    const { data: customers } = useFirestoreSubscription<Customer>('customers');
    const { data: inventory } = useFirestoreSubscription<InventoryItem>('inventory');

    const [isOpen, setIsOpen] = useState(false);

    // Calculate metrics for the last 30 days
    const intelligentAlerts = useMemo(() => {
        if (!orders.length || !customers.length) return [];

        const now = dayjs();
        const thirtyDaysAgo = now.subtract(30, 'days');
        const sixtyDaysAgo = now.subtract(60, 'days');

        const currentDelivered = getDeliveredOrdersInRange(orders, thirtyDaysAgo, now);
        const previousDelivered = getDeliveredOrdersInRange(orders, sixtyDaysAgo, thirtyDaysAgo);

        const currentMetrics: PeriodMetrics = {
            totalRevenue: currentDelivered.reduce((sum, o) => sum + (o.total || 0), 0),
            totalOrders: currentDelivered.length,
            avgTicket: currentDelivered.length > 0 ? currentDelivered.reduce((sum, o) => sum + (o.total || 0), 0) / currentDelivered.length : 0,
        };

        const previousMetrics: PeriodMetrics = {
            totalRevenue: previousDelivered.reduce((sum, o) => sum + (o.total || 0), 0),
            totalOrders: previousDelivered.length,
            avgTicket: previousDelivered.length > 0 ? previousDelivered.reduce((sum, o) => sum + (o.total || 0), 0) / previousDelivered.length : 0,
        };

        return generateIntelligentAlerts(customers, orders, now, currentMetrics, previousMetrics);
    }, [orders, customers]);

    const inventoryAlerts = useMemo(() => {
        return inventory.filter(i => i.stockPackages <= (i.minPackages || 0) && i.isActive !== false);
    }, [inventory]);

    const totalAlerts = intelligentAlerts.length + inventoryAlerts.length;



    return (
        <>
            <Badge count={totalAlerts} size="small" offset={[-2, 6]}>
                <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 20 }} />}
                    onClick={() => setIsOpen(true)}
                    style={{ color: 'inherit' }}
                />
            </Badge>

            <Drawer
                title="Centro de Notificaciones"
                placement="right"
                onClose={() => setIsOpen(false)}
                open={isOpen}
                width={360}
            >
                {totalAlerts === 0 ? (
                    <div style={{ textAlign: 'center', color: 'gray', marginTop: 40 }}>
                        <BellOutlined style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }} />
                        <p>No tienes notificaciones pendientes. ¡Todo en orden!</p>
                    </div>
                ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">


                        {inventoryAlerts.length > 0 && (
                            <div>
                                <Typography.Title level={5}>Stock Crítico ({inventoryAlerts.length})</Typography.Title>
                                <List
                                    size="small"
                                    dataSource={inventoryAlerts}
                                    renderItem={item => (
                                        <List.Item>
                                            <List.Item.Meta
                                                title={item.name}
                                                description={`Stock al mínimo: ${item.stockPackages} de ${item.minPackages}`}
                                            />
                                            <Tag color="red">Resurtir</Tag>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        )}

                        {intelligentAlerts.length > 0 && (
                            <div>
                                <Typography.Title level={5}>Alertas de Clientes y CRM ({intelligentAlerts.length})</Typography.Title>
                                <List
                                    size="small"
                                    dataSource={intelligentAlerts}
                                    renderItem={alert => {
                                        let color = 'blue';
                                        if (alert.severity === 'HIGH') color = 'red';
                                        if (alert.severity === 'MEDIUM') color = 'orange';
                                        return (
                                            <List.Item>
                                                <List.Item.Meta
                                                    title={
                                                        <Space>
                                                            <span>{alert.title}</span>
                                                            <Tag color={color}>{alert.severity}</Tag>
                                                        </Space>
                                                    }
                                                    description={<span style={{ fontSize: 13 }}>{alert.description}</span>}
                                                />
                                            </List.Item>
                                        );
                                    }}
                                />
                            </div>
                        )}
                    </Space>
                )}
            </Drawer>
        </>
    );
};
