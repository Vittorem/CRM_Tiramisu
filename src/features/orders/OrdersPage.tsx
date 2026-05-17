import { useState } from 'react';
import { Button, Segmented, message, DatePicker, Skeleton } from 'antd';
import { PlusOutlined, UnorderedListOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { Order, OrderStatus } from '../../types';
import { OrderForm } from './components/OrderForm';
import { OrderKanbanBoard } from './components/OrderKanbanBoard';
import { OrderSummary } from './components/OrderSummary';
import { OrderList } from './OrderList';
import { getOrderDate } from '../../utils/dateHelpers';
import dayjs from 'dayjs';
import { useIsMobile } from '../../hooks/useIsMobile';


export const OrdersPage = () => {
    const { data: orders, loading: loadingOrders } = useFirestoreSubscription<Order>('orders');
    const { add, update, softDelete } = useFirestoreMutation('orders');

    const isMobile = useIsMobile();

    const [viewMode, setViewMode] = useState<'Kanban' | 'List'>('Kanban');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(dayjs());
    const [prefillCustomerId, setPrefillCustomerId] = useState<string | null>(null);

    const handleCreate = (customerId?: string) => {
        setEditingOrder(null);
        setPrefillCustomerId(customerId || null);
        setIsFormOpen(true);
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
