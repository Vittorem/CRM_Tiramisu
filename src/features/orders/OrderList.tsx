import { useState } from 'react';
import { Table, Tag, Space, Button, Input, Select, List as AntList, Card, Modal, Typography, theme } from 'antd';
import { EditOutlined, DeleteOutlined, CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { SwipeableList, SwipeableListItem, SwipeAction, TrailingActions, LeadingActions } from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';
import { Order, OrderStatus, ORDER_STATUSES } from '../../types';
import { toDay } from '../../utils/dateHelpers';
import { useIsMobile } from '../../hooks/useIsMobile';

const { Text } = Typography;

interface OrderListProps {
    orders: Order[];
    onEdit: (order: Order) => void;
    onDelete: (id: string) => void;
    onStatusChange?: (id: string, newStatus: OrderStatus) => void;
}


// Status labels for the mobile filter chips
const MOBILE_FILTER_STATUSES: OrderStatus[] = [
    'Listo para entregar',
    'En preparación',
    'Confirmado',
    'Pendiente',
];

// Priority map for mobile: lower number = higher priority (appears first)
const STATUS_PRIORITY: Record<string, number> = {
    'Listo para entregar': 1,
    'En preparación': 2,
    'Confirmado': 3,
    'Pendiente': 4,
    'Entregado': 5,
    'Cancelado': 6,
};

// Next status label for swipe action
const NEXT_STATUS_LABEL: Record<string, string> = {
    'Pendiente': 'Confirmado',
    'Confirmado': 'En preparación',
    'En preparación': 'Listo',
    'Listo para entregar': 'Entregado',
};

export const OrderList = ({ orders, onEdit, onDelete, onStatusChange }: OrderListProps) => {
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
    const isMobile = useIsMobile();
    const { token: { colorBgContainer, colorBorderSecondary, colorTextSecondary, colorText, colorPrimary, colorFillAlter } } = theme.useToken();

    const filteredData = orders
        .filter(o => {
            const matchesSearch =
                (o.customerName || '').toLowerCase().includes(searchText.toLowerCase()) ||
                (o.notes || '').toLowerCase().includes(searchText.toLowerCase());
            const matchesStatus = statusFilter ? o.status === statusFilter : true;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            // On mobile, sort by status priority first, then by delivery date
            if (isMobile) {
                const priorityA = STATUS_PRIORITY[a.status] ?? 99;
                const priorityB = STATUS_PRIORITY[b.status] ?? 99;
                if (priorityA !== priorityB) return priorityA - priorityB;
            }
            const aDate = toDay(a.deliveryDate);
            const bDate = toDay(b.deliveryDate);
            return (bDate?.valueOf() ?? 0) - (aDate?.valueOf() ?? 0);
        });

    // #5 — Group orders by status for section headers on mobile
    const getStatusGroups = () => {
        const groups: { status: string; startIndex: number }[] = [];
        let lastStatus = '';
        filteredData.forEach((item, index) => {
            if (item.status !== lastStatus) {
                groups.push({ status: item.status, startIndex: index });
                lastStatus = item.status;
            }
        });
        return groups;
    };
    const statusGroups = isMobile ? getStatusGroups() : [];

    // #3 — Delete with confirmation
    const handleDeleteConfirm = (id: string, customerName: string) => {
        Modal.confirm({
            title: '¿Eliminar pedido?',
            content: `Se eliminará el pedido de ${customerName}. Esta acción se puede deshacer desde la base de datos.`,
            okText: 'Eliminar',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: () => onDelete(id),
        });
    };

    // Helper: get product text with flavor (#4)
    const getProductText = (item: Order) => {
        if (item.items && item.items.length > 0) {
            return item.items.map(i => `${i.quantity}x ${i.productNameAtSale} (${i.flavorNameAtSale})`).join(', ');
        }
        return `${item.quantity || 1}x ${item.productNameAtSale} (${item.flavorNameAtSale})`;
    };

    const columns = [
        {
            title: 'Cliente',
            dataIndex: 'customerName',
            key: 'customerName',
        },
        {
            title: 'Producto',
            key: 'product',
            render: (_: unknown, r: Order) => getProductText(r),
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            render: (val: number) => `$${val.toFixed(2)}`,
        },
        {
            title: 'Pago',
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (paymentStatus?: string) => {
                if (paymentStatus === 'Pagado') return <Tag color="success">Pagado</Tag>;
                if (paymentStatus === 'Pago Parcial') return <Tag color="warning">Pago Parcial</Tag>;
                return <Tag color="default">No Pagado</Tag>;
            },
        },
        {
            title: 'Entrega',
            dataIndex: 'deliveryDate',
            key: 'deliveryDate',
            render: (date: Order['deliveryDate']) => {
                const d = toDay(date);
                return d ? d.format('DD/MM/YYYY HH:mm') : '-';
            },
        },
        {
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color={status === 'Entregado' ? 'green' : 'blue'}>{status}</Tag>,
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: unknown, record: Order) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
                    <Button icon={<DeleteOutlined />} size="small" danger onClick={() => onDelete(record.id)} />
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Desktop: original search + filter */}
            {!isMobile && (
                <Space style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap' }}>
                    <Input placeholder="Buscar cliente..." onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} />
                    <Select
                        placeholder="Filtrar Estado"
                        allowClear
                        style={{ width: 150 }}
                        onChange={setStatusFilter}
                    >
                        {ORDER_STATUSES.map(s => (
                            <Select.Option key={s} value={s}>{s}</Select.Option>
                        ))}
                    </Select>
                </Space>
            )}

            {/* #1 — Mobile: compact search + status filter chips */}
            {isMobile && (
                <div style={{ marginBottom: 12 }}>
                    <Input
                        placeholder="Buscar pedido..."
                        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                        allowClear
                        onChange={e => setSearchText(e.target.value)}
                        style={{ marginBottom: 8, borderRadius: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                        <Tag
                            style={{
                                cursor: 'pointer',
                                borderRadius: 16,
                                padding: '2px 12px',
                                fontWeight: statusFilter === null ? 700 : 400,
                                background: statusFilter === null ? colorPrimary : colorFillAlter,
                                color: statusFilter === null ? 'white' : colorTextSecondary,
                                border: statusFilter === null ? `1px solid ${colorPrimary}` : `1px solid ${colorBorderSecondary}`,
                                flexShrink: 0,
                            }}
                            onClick={() => setStatusFilter(null)}
                        >
                            Todos
                        </Tag>
                        {MOBILE_FILTER_STATUSES.map(s => (
                            <Tag
                                key={s}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: 16,
                                    padding: '2px 12px',
                                    fontWeight: statusFilter === s ? 700 : 400,
                                    background: statusFilter === s ? colorPrimary : colorFillAlter,
                                    color: statusFilter === s ? 'white' : colorTextSecondary,
                                    border: statusFilter === s ? `1px solid ${colorPrimary}` : `1px solid ${colorBorderSecondary}`,
                                    flexShrink: 0,
                                }}
                                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                            >
                                {s === 'Listo para entregar' ? 'Listo' : s}
                            </Tag>
                        ))}
                    </div>
                </div>
            )}

            {isMobile ? (
                <SwipeableList threshold={0.3}>
                    <AntList
                        dataSource={filteredData}
                        locale={{ emptyText: 'No hay pedidos para mostrar' }}
                        renderItem={(item, index) => {
                            const currentIndex = ORDER_STATUSES.indexOf(item.status);
                            const nextStatusLabel = NEXT_STATUS_LABEL[item.status] || 'Siguiente';

                            // #5 — Section header for status group
                            const statusGroup = statusGroups.find(g => g.startIndex === index);
                            const groupCount = filteredData.filter(o => o.status === item.status).length;

                            const leadingActions = () => (
                                <LeadingActions>
                                    <SwipeAction onClick={() => {
                                        if (onStatusChange && currentIndex !== -1 && currentIndex < ORDER_STATUSES.length - 1) {
                                            onStatusChange(item.id, ORDER_STATUSES[currentIndex + 1] as OrderStatus);
                                        }
                                    }}>
                                        {/* #7 — Dynamic swipe label */}
                                        <div style={{ background: '#52c41a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0 24px', width: '100%', borderRadius: 8, marginBottom: 8 }}>
                                            <CheckOutlined style={{ fontSize: 24 }} /> <span style={{ marginLeft: 8, fontWeight: 'bold' }}>→ {nextStatusLabel}</span>
                                        </div>
                                    </SwipeAction>
                                </LeadingActions>
                            );

                            // #3 — Trailing actions with confirmation
                            const trailingActions = () => (
                                <TrailingActions>
                                    <SwipeAction destructive={false} onClick={() => handleDeleteConfirm(item.id, item.customerName || 'este cliente')}>
                                        <div style={{ background: '#ff4d4f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px', width: '100%', borderRadius: 8, marginBottom: 8 }}>
                                            <span style={{ marginRight: 8, fontWeight: 'bold' }}>Eliminar</span> <DeleteOutlined style={{ fontSize: 24 }} />
                                        </div>
                                    </SwipeAction>
                                </TrailingActions>
                            );

                            return (
                                <>
                                    {/* #5 — Status group separator */}
                                        {statusGroup && !statusFilter && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: '12px 4px 6px',
                                                    marginTop: index > 0 ? 8 : 0,
                                                }}>
                                                    <div style={{ height: 1, flex: 1, background: colorBorderSecondary }} />
                                                    <Text strong style={{ fontSize: 12, color: colorTextSecondary, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                                                        {statusGroup.status} ({groupCount})
                                                    </Text>
                                                    <div style={{ height: 1, flex: 1, background: colorBorderSecondary }} />
                                                </div>
                                            )}
                                    <SwipeableListItem
                                        leadingActions={item.status !== 'Entregado' ? leadingActions() : undefined}
                                        trailingActions={trailingActions()}
                                    >
                                        <Card 
                                            size="small" 
                                            style={{ 
                                                marginBottom: 8, 
                                                width: '100%', 
                                                borderRadius: 10, 
                                                boxShadow: 'none', 
                                                border: `1px solid ${colorBorderSecondary}`,
                                                background: colorBgContainer
                                            }}
                                            bodyStyle={{ padding: '12px 16px', cursor: 'pointer' }}
                                            onClick={() => onEdit(item)}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <strong style={{ fontSize: 16, color: colorText }}>{item.customerName}</strong>
                                                <strong style={{ fontSize: 16, color: colorText }}>${item.total.toFixed(2)}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13, color: colorTextSecondary }}>
                                                <div>{item.deliveryMethod === 'Envío' ? '🚚' : '🏪'} {toDay(item.deliveryDate)?.format('DD/MM HH:mm')}</div>
                                                {item.paymentStatus !== 'Pagado' ? (
                                                    <span style={{ color: item.paymentStatus === 'Pago Parcial' ? '#faad14' : '#ff4d4f', fontWeight: 500 }}>
                                                        {item.paymentStatus === 'Pago Parcial' ? '⏳ Parcial' : '❌ No Pago'}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#52c41a', fontWeight: 500 }}>✅ Pagado</span>
                                                )}
                                            </div>
                                            <div style={{ color: colorTextSecondary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <span style={{ opacity: 0.7, marginRight: 4 }}>📦</span>{getProductText(item)}
                                            </div>
                                            {item.notes && (
                                                <div style={{ fontSize: 12, color: colorTextSecondary, opacity: 0.8, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <span style={{ opacity: 0.7, marginRight: 4 }}>📝</span>{item.notes}
                                                </div>
                                            )}
                                        </Card>
                                    </SwipeableListItem>
                                </>
                            );
                        }}
                    />
                </SwipeableList>
            ) : (
                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    size="small"
                />
            )}
        </div>
    );
};
