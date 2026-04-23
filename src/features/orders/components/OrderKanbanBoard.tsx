import {
    DndContext,
    useSensors,
    useSensor,
    PointerSensor,
    DragEndEvent,
    closestCenter,
} from '@dnd-kit/core';
import { Order, OrderStatus, KANBAN_STATUSES } from '../../../types';
import { Card, Tag, Typography, theme } from 'antd';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { toDay, getOrderDate } from '../../../utils/dateHelpers';

interface KanbanBoardProps {
    orders: Order[];
    onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
    onEditOrder: (order: Order) => void;
}

// ─── Draggable Card ──────────────────────────────────────────────────────────

function SortableItem({ order, onClick }: { order: Order; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: order.id,
        data: { order },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        marginBottom: 8,
        cursor: 'grab' as const,
    };

    const dateStr = toDay(order.deliveryDate)?.format('DD/MM/YYYY') ?? '-';

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Card size="small" hoverable onClick={onClick} styles={{ body: { padding: 12 } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Typography.Text strong>{order.customerName}</Typography.Text>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {order.paymentStatus && order.paymentStatus !== 'No Pagado' && (
                            <Tag color={order.paymentStatus === 'Pagado' ? 'success' : 'warning'} style={{ margin: 0 }}>
                                {order.paymentStatus === 'Pagado' ? '$' : '1/2'}
                            </Tag>
                        )}
                        <Tag color="blue" style={{ margin: 0 }}>${order.total}</Tag>
                    </div>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                    {order.items && order.items.length > 0 ? (
                        order.items.map((item, i) => (
                            <div key={item.id || i}>
                                {item.quantity}x {item.productNameAtSale} ({item.flavorNameAtSale})
                                {item.pointsRedeemed ? ' 🎁' : ''}
                            </div>
                        ))
                    ) : (
                        <div>
                            {order.quantity}x {order.productNameAtSale} ({order.flavorNameAtSale})
                        </div>
                    )}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {dateStr}
                </div>
            </Card>
        </div>
    );
}

// ─── Droppable Column ────────────────────────────────────────────────────────

function KanbanColumn({ status, orders, onEdit }: { status: OrderStatus; orders: Order[]; onEdit: (o: Order) => void }) {
    const { setNodeRef } = useDroppable({ id: status });
    const { token: { colorBgLayout } } = theme.useToken();

    return (
        <div ref={setNodeRef} style={{ flex: 1, background: colorBgLayout, padding: 8, borderRadius: 8, minWidth: 250, display: 'flex', flexDirection: 'column' }}>
            <Typography.Title level={5} style={{ margin: '0 0 12px 0', textAlign: 'center' }}>
                {status} ({orders.length})
            </Typography.Title>
            <div style={{ flex: 1 }}>
                {orders.map(order => (
                    <SortableItem key={order.id} order={order} onClick={() => onEdit(order)} />
                ))}
            </div>
        </div>
    );
}

// ─── Board ───────────────────────────────────────────────────────────────────

export const OrderKanbanBoard = ({ orders, onStatusChange, onEditOrder }: KanbanBoardProps) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const orderId = active.id as string;
        const newStatus = over.id as OrderStatus;

        const order = orders.find(o => o.id === orderId);
        if (order && order.status !== newStatus) {
            onStatusChange(orderId, newStatus);
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, height: 'calc(100vh - 200px)' }}>
                {KANBAN_STATUSES.map(status => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        orders={orders
                            .filter(o => o.status === status)
                            .sort((a, b) => {
                                const dateA = getOrderDate(a);
                                const dateB = getOrderDate(b);
                                if (!dateA && !dateB) return 0;
                                if (!dateA) return 1;
                                if (!dateB) return -1;
                                return dateA.valueOf() - dateB.valueOf();
                            })}
                        onEdit={onEditOrder}
                    />
                ))}
            </div>
        </DndContext>
    );
};
