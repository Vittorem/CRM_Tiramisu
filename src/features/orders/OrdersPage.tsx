import { useState, useMemo, useEffect } from 'react';
import { Button, Segmented, message, DatePicker, Modal, Skeleton, Space } from 'antd';
import { PlusOutlined, UnorderedListOutlined, AppstoreOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { Order, OrderStatus, Customer, SystemSettings, B2BDeliverySchedule } from '../../types';
import { OrderForm } from './components/OrderForm';
import { OrderKanbanBoard } from './components/OrderKanbanBoard';
import { OrderSummary } from './components/OrderSummary';
import { OrderList } from './OrderList';
import { getOrderDate } from '../../utils/dateHelpers';
import dayjs from 'dayjs';
import { increment } from 'firebase/firestore';
import { calculateProductPoints, LOYALTY_RULES, getPointsCostForProduct, getLoyaltyRewardSummary } from '../../utils/loyalty';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocation } from 'react-router-dom';
import { getPendingB2BAlerts } from '../../utils/b2bAlerts';
import { arrayUnion } from 'firebase/firestore';


export const OrdersPage = () => {
    const { data: orders, loading: loadingOrders } = useFirestoreSubscription<Order>('orders');
    const { data: customers, loading: loadingCustomers } = useFirestoreSubscription<Customer>('customers');
    const { add, update, softDelete } = useFirestoreMutation('orders');
    const { update: updateCustomer } = useFirestoreMutation('customers');
    const { add: addLoyalty } = useFirestoreMutation('loyalty_ledger');
    const { data: settings } = useFirestoreSubscription<SystemSettings>('settings');
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

    const loyaltySettings = settings[0];
    const isLoyaltyEnabled = loyaltySettings ? loyaltySettings.loyaltyEnabled : true;

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

                // Loyalty Points Logic
                if (isLoyaltyEnabled && !order.pointsAwarded && order.customerId) {
                    let pointsEarned = 0;
                    const pointsRedeemed = order.pointsRedeemed || 0;

                    if (order.items && order.items.length > 0) {
                        order.items.forEach(item => {
                            const pCost = getPointsCostForProduct(item.productNameAtSale || '');
                            const itemRedeemed = item.pointsRedeemed || 0;
                            const qtyRedeemed = pCost > 0 ? Math.round(itemRedeemed / pCost) : 0;
                            const paidQty = Math.max(0, (item.quantity || 1) - qtyRedeemed);
                            pointsEarned += calculateProductPoints(item.productNameAtSale || '', paidQty);
                        });
                    } else {
                        const pointsCost = getPointsCostForProduct(order.productNameAtSale || '');
                        const quantityRedeemed = pointsCost > 0 ? Math.round((order.pointsRedeemed || 0) / pointsCost) : 0;
                        const paidQuantity = Math.max(0, (order.quantity || 1) - quantityRedeemed);
                        pointsEarned += calculateProductPoints(order.productNameAtSale || '', paidQuantity);
                    }

                    const pointsChange = pointsEarned - pointsRedeemed;

                    if (pointsChange !== 0 || pointsEarned > 0 || pointsRedeemed > 0) {
                        payload.pointsEarned = pointsEarned;
                        payload.pointsAwarded = true;

                        await updateCustomer(order.customerId, {
                            loyaltyPoints: increment(pointsChange)
                        });

                        if (pointsEarned > 0) {
                            await addLoyalty({
                                customerId: order.customerId,
                                orderId: order.id,
                                pointsChange: pointsEarned,
                                reason: 'purchase'
                            });
                        }

                        if (pointsRedeemed > 0) {
                            await addLoyalty({
                                customerId: order.customerId,
                                orderId: order.id,
                                pointsChange: -pointsRedeemed,
                                reason: 'redemption'
                            });
                        }

                        const currentCustomer = customers.find(c => c.id === order.customerId);
                        const newPoints = (currentCustomer?.loyaltyPoints || 0) + pointsChange;
                        if (newPoints >= LOYALTY_RULES.POINTS_FOR_FREE_BAMBINO) {
                            const rewardText = getLoyaltyRewardSummary(newPoints);

                            Modal.confirm({
                                title: '¡Promoción de Lealtad!',
                                content: `El cliente ${currentCustomer?.fullName || ''} ahora tiene ${newPoints} puntos, suficientes para ${rewardText} gratis. ¿Enviar aviso por WhatsApp?`,
                                okText: 'Enviar WhatsApp',
                                cancelText: 'Cancelar',
                                onOk: () => {
                                    if (currentCustomer?.phone) {
                                        const phoneStr = currentCustomer.phone.replace(/\D/g, '');
                                        const firstName = currentCustomer.fullName.split(' ')[0] || currentCustomer.fullName;
                                        const msg = `Hola ${firstName}, gracias por comprar en King Candy La Casa Del Tiramisu, tu compra acumulo ${pointsChange} puntos de lealtad, ahora tienes ${newPoints} puntos acumulados. Comunicate con nosotros para saber como redimirlos.`;
                                        const url = `https://wa.me/52${phoneStr}?text=${encodeURIComponent(msg)}`;
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                    } else {
                                        message.warning('El cliente no tiene teléfono registrado.');
                                    }
                                }
                            });
                        }
                    }
                }
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
        <div style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
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

            {/* #2 — Compact mobile summary */}
            {isMobile && !loadingOrders && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
                    {(() => {
                        const mobileOrders = filteredOrders.filter(o => o.status !== 'Entregado');
                        const ready = mobileOrders.filter(o => o.status === 'Listo para entregar').length;
                        const inPrep = mobileOrders.filter(o => o.status === 'En preparación').length;
                        const confirmed = mobileOrders.filter(o => o.status === 'Confirmado').length;
                        const pending = mobileOrders.filter(o => o.status === 'Pendiente').length;
                        return (
                            <>
                                <div style={{ background: '#e6fffb', border: '1px solid #87e8de', borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 70, flexShrink: 0 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#13c2c2' }}>{ready}</div>
                                    <div style={{ fontSize: 10, color: '#006d75' }}>Listos</div>
                                </div>
                                <div style={{ background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 70, flexShrink: 0 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#722ed1' }}>{inPrep}</div>
                                    <div style={{ fontSize: 10, color: '#531dab' }}>Preparando</div>
                                </div>
                                <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 70, flexShrink: 0 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2f54eb' }}>{confirmed}</div>
                                    <div style={{ fontSize: 10, color: '#1d39c4' }}>Confirmados</div>
                                </div>
                                <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 70, flexShrink: 0 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fa8c16' }}>{pending}</div>
                                    <div style={{ fontSize: 10, color: '#d46b08' }}>Pendientes</div>
                                </div>
                                <div style={{ background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 70, flexShrink: 0 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>{mobileOrders.length}</div>
                                    <div style={{ fontSize: 10, color: '#888' }}>Total</div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {loadingOrders || loadingCustomers ? (
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
