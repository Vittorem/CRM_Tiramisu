import { useMemo } from 'react';
import {
    DndContext,
    useSensors,
    useSensor,
    PointerSensor,
    DragEndEvent,
    closestCenter,
    useDroppable,
    useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, Tag, Typography, theme } from 'antd';
import { Order, OrderStatus, KANBAN_STATUSES } from '../../../types';
import { toDay, getOrderDate } from '../../../utils/dateHelpers';

interface KanbanBoardProps {
    orders: Order[];
    onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
    onEditOrder: (order: Order) => void;
}

// ─── Draggable Card ──────────────────────────────────────────────────────────

function SortableItem({ order, onClick }: { order: Order; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: order.id,
        data: { order },
    });
    const { token: { colorTextSecondary, colorTextTertiary } } = theme.useToken();

    const style = {
        transform: CSS.Translate.toString(transform),
        marginBottom: 8,
        cursor: isDragging ? ('grabbing' as const) : ('grab' as const),
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? ('relative' as const) : undefined,
    };

    const dateStr = toDay(order.deliveryDate)?.format('DD/MM/YYYY') ?? '-';

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Card size="small" hoverable onClick={onClick} styles={{ body: { padding: 12 } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                    <Typography.Text strong>{order.customerName}</Typography.Text>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {order.paymentStatus && order.paymentStatus !== 'No Pagado' && (
                            <Tag color={order.paymentStatus === 'Pagado' ? 'success' : 'warning'} style={{ margin: 0 }}>
                                {order.paymentStatus === 'Pagado' ? '$' : '1/2'}
                            </Tag>
                        )}
                        <Tag color="blue" style={{ margin: 0 }}>${(order.total ?? 0).toFixed(2)}</Tag>
                    </div>
                </div>
                <div style={{ fontSize: 12, color: colorTextSecondary }}>
                    {order.items && order.items.length > 0 ? (
                        order.items.map((item, i) => (
                            <div key={item.id || i}>
                                {item.quantity}x {item.productNameAtSale} ({item.flavorNameAtSale})
                            </div>
                        ))
                    ) : (
                        <div>
                            {order.quantity}x {order.productNameAtSale} ({order.flavorNameAtSale})
                        </div>
                    )}
                </div>
                <div style={{ fontSize: 11, color: colorTextTertiary, marginTop: 4 }}>
                    {dateStr}
                </div>
            </Card>
        </div>
    );
}

// ─── Droppable Column ────────────────────────────────────────────────────────

function KanbanColumn({ status, orders, onEdit }: { status: OrderStatus; orders: Order[]; onEdit: (o: Order) => void }) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const { token: { colorBgLayout, colorPrimary, colorPrimaryBg } } = theme.useToken();

    return (
        <div
            ref={setNodeRef}
            style={{
                flex: 1,
                background: isOver ? colorPrimaryBg : colorBgLayout,
                padding: '8px 6px',
                borderRadius: 8,
                minWidth: 130,
                display: 'flex',
                flexDirection: 'column',
                border: isOver ? `1px dashed ${colorPrimary}` : '1px solid transparent',
                transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
        >
            <Typography.Title level={5} style={{ margin: '0 0 12px 0', textAlign: 'center', fontSize: 13 }}>
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

    const ordersByStatus = useMemo(() => {
        const grouped: Record<string, Order[]> = {};
        KANBAN_STATUSES.forEach(s => {
            grouped[s] = [];
        });

        orders.forEach(o => {
            if (grouped[o.status]) {
                grouped[o.status].push(o);
            }
        });

        KANBAN_STATUSES.forEach(s => {
            grouped[s].sort((a, b) => {
                const dateA = getOrderDate(a);
                const dateB = getOrderDate(b);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateA.valueOf() - dateB.valueOf();
            });
        });

        return grouped;
    }, [orders]);

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
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, height: '100%', minHeight: 400 }}>
                {KANBAN_STATUSES.map(status => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        orders={ordersByStatus[status] || []}
                        onEdit={onEditOrder}
                    />
                ))}
            </div>
        </DndContext>
    );
};
