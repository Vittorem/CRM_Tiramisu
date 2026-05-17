import { useState, useMemo, useEffect } from 'react';
import { Button, Segmented, message, DatePicker, Skeleton, Space } from 'antd';
import { PlusOutlined, UnorderedListOutlined, AppstoreOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { Order, OrderStatus, B2BDeliverySchedule } from '../../types';
import { OrderForm } from './components/OrderForm';
import { OrderKanbanBoard } from './components/OrderKanbanBoard';
import { OrderSummary } from './components/OrderSummary';
import { OrderList } from './OrderList';
import { getOrderDate } from '../../utils/dateHelpers';
import dayjs from 'dayjs';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocation } from 'react-router-dom';
import { getPendingB2BAlerts } from '../../utils/b2bAlerts';
import { arrayUnion } from 'firebase/firestore';


export const OrdersPage = () => {
    const { data: orders, loading: loadingOrders } = useFirestoreSubscription<Order>('orders');
    const { add, update, softDelete } = useFirestoreMutation('orders');
    const { data: b2bSchedules } = useFirestoreSubscription<B2BDeliverySchedule>('b2b_schedules');
    const { update: updateSchedule } = useFirestoreMutation<B2BDeliverySchedule>('b2b_schedules');

    const isMobile = useIsMobile();
    const location = useLocation();

    const [viewMode, setViewMode] = useState<'Kanban' | 'List'>('Kanban');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(dayjs());
    const [prefillCustomerId, setPrefillCustomerId] = useState<string | null>(null);

    // Handle navigation state for creating orders from B2B alerts
    useEffect(() => {
        const state = location.state as { createNew?: boolean; prefillCustomerId?: string } | null;
        if (state?.createNew) {
            if (state.prefillCustomerId) {
                setPrefillCustomerId(state.prefillCustomerId);
            }
            setEditingOrder(null);
            setIsFormOpen(true);
            // Clean navigation state
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // B2B delivery alerts
    const pendingB2BAlerts = useMemo(() => {
        return getPendingB2BAlerts(b2bSchedules, orders);
    }, [b2bSchedules, orders]);



    const handleCreate = (customerId?: string) => {
        setEditingOrder(null);
        setPrefillCustomerId(customerId || null);
        setIsFormOpen(true);
    };

    const handleDismissB2BAlert = async (scheduleId: string, targetDateStr: string) => {
        try {
            await updateSchedule(scheduleId, {
                dismissedDates: arrayUnion(targetDateStr) as unknown as string[]
            });
            message.success('Alerta de entrega omitida');
        } catch (error) {
            console.error('Error al omitir notificación', error);
            message.error('Error al omitir la notificación');
        }
    };

    const handleEdit = (order: Order) => {
        setEditingOrder(order);
        setIsFormOpen(true);
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) return;

            const payload: Record<string, unknown> = { status: newStatus };
            if (newStatus === 'Entregado') {
                payload.deliveredAt = new Date();
            }
            await update(orderId, payload);
            message.success(`Estado actualizado a ${newStatus}`);
            if (navigator.vibrate) navigator.vibrate(50);
        } catch (e) {
            console.error('Error al actualizar estado:', e);
            message.error('Error al actualizar estado');
        }
    };

    const handleSubmit = async (values: Partial<Order>) => {
        try {
            if (editingOrder) {
                await update(editingOrder.id, values);
                message.success('Pedido actualizado');
            } else {
                await add(values);
                message.success('Pedido creado');
            }
            if (navigator.vibrate) navigator.vibrate(50);
        } catch {
            message.error('Error al guardar pedido');
        }
    };

    const handleDelete = async (id: string) => {
        await softDelete(id);
        message.success('Pedido eliminado');
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const filteredOrders = orders.filter(o => {
        const date = getOrderDate(o);
        if (!date) return false;
        return date.isSame(selectedMonth, 'month') && date.isSame(selectedMonth, 'year');
    });



    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 16, width: isMobile ? '100%' : 'auto' }}>
                    {!isMobile && (
                        <Segmented<string>
                            options={[
                                { label: 'Kanban', value: 'Kanban', icon: <AppstoreOutlined /> },
                                { label: 'Lista', value: 'List', icon: <UnorderedListOutlined /> },
                            ]}
                            value={viewMode}
                            onChange={(val) => setViewMode(val as 'Kanban' | 'List')}
                        />
                    )}
                    <DatePicker
                        style={{ flex: 1 }}
                        picker="month"
                        value={selectedMonth}
                        onChange={(val) => val && setSelectedMonth(val)}
                        allowClear={false}
                        format="MMMM YYYY"
                        placeholder="Seleccionar Mes"

                    />
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()} style={{ width: isMobile ? '100%' : 'auto' }}>
                    Nuevo Pedido
                </Button>
            </div>

            {/* B2B Delivery Alert Banner */}
            {pendingB2BAlerts.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%)',
                    border: '1px solid #ffe58f',
                    borderRadius: 10,
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#d48806', fontSize: 14 }}>
                        <SendOutlined /> Entregas B2B Pendientes
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pendingB2BAlerts.map(alert => (
                            <div
                                key={`${alert.schedule.id}-${alert.urgency}`}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: '#fff',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    border: alert.urgency === 'today' ? '1px solid #ff7a45' : '1px solid #ffd591',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 500 }}>{alert.schedule.customerName}</span>
                                    <span style={{
                                        fontSize: 11,
                                        padding: '1px 8px',
                                        borderRadius: 10,
                                        fontWeight: 600,
                                        background: alert.urgency === 'today' ? '#fff2e8' : '#fffbe6',
                                        color: alert.urgency === 'today' ? '#d4380d' : '#d48806',
                                        border: `1px solid ${alert.urgency === 'today' ? '#ffbb96' : '#ffe58f'}`,
                                    }}>
                                        {alert.urgency === 'today' ? `HOY ${alert.deliveryDay}` : `Mañana ${alert.deliveryDay}`}
                                    </span>
                                </div>
                                <Space size="small">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<StopOutlined />}
                                        onClick={() => handleDismissB2BAlert(alert.schedule.id, alert.targetDateStr)}
                                    >
                                        {!isMobile && 'Omitir'}
                                    </Button>
                                    <Button
                                        type="primary"
                                        size="small"
                                        onClick={() => handleCreate(alert.schedule.customerId)}
                                        style={{ borderRadius: 6 }}
                                    >
                                        Crear Pedido
                                    </Button>
                                </Space>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <OrderSummary orders={filteredOrders} />
                </div>
            )}



            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {loadingOrders ? (
                    <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></div>
                ) : viewMode === 'Kanban' && !isMobile ? (
                <OrderKanbanBoard
                    orders={filteredOrders}
                    onStatusChange={handleStatusChange}
                    onEditOrder={handleEdit}
                />
            ) : (
                <OrderList
                    orders={isMobile ? filteredOrders.filter(o => o.status !== 'Entregado') : filteredOrders}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                />
            )}
            </div>

            <OrderForm
                open={isFormOpen}
                onClose={() => { setIsFormOpen(false); setPrefillCustomerId(null); }}
                onSubmit={handleSubmit}
                initialValues={editingOrder}
                prefillCustomerId={prefillCustomerId}
            />
        </div>
    );
};
