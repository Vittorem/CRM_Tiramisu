import { useState, useMemo } from 'react';
import { Button, Segmented, message, Input, Table, Tag, Space, Popconfirm, Skeleton, Card, Empty } from 'antd';
import { PlusOutlined, CalendarOutlined, UnorderedListOutlined, SearchOutlined, EditOutlined, DeleteOutlined, WhatsAppOutlined, PhoneOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { B2BDeliverySchedule, Customer, Order, DayOfWeek } from '../../types';
import { B2BScheduleForm } from './components/B2BScheduleForm';
import { B2BWeeklyCalendar } from './components/B2BWeeklyCalendar';
import { useIsMobile } from '../../hooks/useIsMobile';

const DAY_TAG_COLORS: Record<DayOfWeek, string> = {
    'Lunes': 'blue',
    'Martes': 'green',
    'Miércoles': 'purple',
    'Jueves': 'orange',
    'Viernes': 'magenta',
    'Sábado': 'cyan',
    'Domingo': 'red',
};

export const B2BDeliveriesPage = () => {
    const { data: schedules, loading: loadingSchedules } = useFirestoreSubscription<B2BDeliverySchedule>('b2b_schedules');
    const { data: customers } = useFirestoreSubscription<Customer>('customers');
    const { data: orders } = useFirestoreSubscription<Order>('orders');
    const { add, update, softDelete } = useFirestoreMutation('b2b_schedules');

    const isMobile = useIsMobile();

    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<B2BDeliverySchedule | null>(null);
    const [searchText, setSearchText] = useState('');

    // Only B2B customers
    const b2bCustomers = useMemo(() =>
        customers.filter(c => c.type === 'B2B' && c.isActive !== false),
        [customers]
    );

    // Filter active schedules
    const activeSchedules = useMemo(() =>
        schedules.filter(s => s.isActive !== false),
        [schedules]
    );

    // Filtered for list view
    const filteredSchedules = useMemo(() =>
        activeSchedules.filter(s =>
            s.customerName.toLowerCase().includes(searchText.toLowerCase())
        ),
        [activeSchedules, searchText]
    );

    const handleCreate = () => {
        setEditingSchedule(null);
        setIsFormOpen(true);
    };

    const handleEdit = (schedule: B2BDeliverySchedule) => {
        setEditingSchedule(schedule);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await softDelete(id);
            message.success('Programación eliminada');
            if (navigator.vibrate) navigator.vibrate(50);
        } catch {
            message.error('Error al eliminar');
        }
    };

    const handleSubmit = async (values: Partial<B2BDeliverySchedule>) => {
        try {
            if (editingSchedule) {
                await update(editingSchedule.id, values);
                message.success('Programación actualizada');
            } else {
                await add(values);
                message.success('Programación creada');
            }
            if (navigator.vibrate) navigator.vibrate(50);
        } catch {
            message.error('Error al guardar');
        }
    };

    const columns = [
        {
            title: 'Negocio',
            dataIndex: 'customerName',
            key: 'customerName',
            render: (text: string) => <span style={{ fontWeight: 600 }}>{text}</span>,
        },
        {
            title: 'Días de Entrega',
            dataIndex: 'deliveryDays',
            key: 'deliveryDays',
            render: (days: DayOfWeek[]) => (
                <Space size={4} wrap>
                    {days?.map(day => (
                        <Tag key={day} color={DAY_TAG_COLORS[day]}>{day}</Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: 'Horario',
            dataIndex: 'preferredTime',
            key: 'preferredTime',
            render: (time: string) => time || <span style={{ color: '#ccc' }}>—</span>,
        },
        {
            title: 'Contacto Principal',
            key: 'contact',
            render: (_: unknown, record: B2BDeliverySchedule) => {
                const primary = record.contacts?.find(c => c.isPrimary) || record.contacts?.[0];
                if (!primary) return <span style={{ color: '#ccc' }}>—</span>;
                return (
                    <Space>
                        <span>{primary.name}</span>
                        {primary.phone && (
                            <Tag icon={<PhoneOutlined />} color="default" style={{ fontSize: 11 }}>
                                {primary.phone}
                            </Tag>
                        )}
                    </Space>
                );
            },
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 120,
            render: (_: unknown, record: B2BDeliverySchedule) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
                    <Popconfirm
                        title="¿Eliminar programación?"
                        description="El cliente no será eliminado, solo su programación de entregas."
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // Mobile list view
    const mobileListView = (
        <div>
            {filteredSchedules.length === 0 ? (
                <Empty description="No hay programaciones configuradas" style={{ padding: 40 }} />
            ) : (
                filteredSchedules.map(schedule => {
                    const primary = schedule.contacts?.find(c => c.isPrimary) || schedule.contacts?.[0];
                    return (
                        <div
                            key={schedule.id}
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: 16, color: '#333' }}>{schedule.customerName}</strong>
                                <Space size="small">
                                    <Button type="text" style={{ padding: 0, color: '#1890ff' }} icon={<EditOutlined />} onClick={() => handleEdit(schedule)} />
                                    <Popconfirm title="¿Eliminar?" onConfirm={() => handleDelete(schedule.id)}>
                                        <Button type="text" style={{ padding: 0 }} icon={<DeleteOutlined />} danger />
                                    </Popconfirm>
                                </Space>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {schedule.deliveryDays?.map(day => (
                                    <Tag key={day} color={DAY_TAG_COLORS[day]} style={{ fontSize: 11, margin: 0 }}>{day}</Tag>
                                ))}
                            </div>
                            {(primary || schedule.preferredTime) && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                    <span style={{ color: '#666', fontSize: 13 }}>
                                        {schedule.preferredTime && `🕐 ${schedule.preferredTime}`}
                                        {primary && schedule.preferredTime && ' · '}
                                        {primary && `📞 ${primary.name}`}
                                    </span>
                                    {primary?.isWhatsApp && primary?.phone && (
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<WhatsAppOutlined />}
                                            style={{ color: '#25D366' }}
                                            onClick={() => {
                                                const phone = primary.phone.replace(/\D/g, '');
                                                window.open(`https://wa.me/52${phone}`, '_blank', 'noopener,noreferrer');
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div style={{ height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {!isMobile && <h2 style={{ margin: 0 }}>Entregas B2B</h2>}
                    <Segmented<string>
                        options={[
                            { label: 'Calendario', value: 'calendar', icon: <CalendarOutlined /> },
                            { label: 'Lista', value: 'list', icon: <UnorderedListOutlined /> },
                        ]}
                        value={viewMode}
                        onChange={(val) => setViewMode(val as 'calendar' | 'list')}
                    />
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ width: isMobile ? '100%' : 'auto' }}>
                    Agregar Negocio
                </Button>
            </div>

            {/* Summary badges */}
            {!loadingSchedules && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <Tag color="gold" style={{ fontSize: 13, padding: '4px 12px' }}>
                        {activeSchedules.length} negocio{activeSchedules.length !== 1 ? 's' : ''} programado{activeSchedules.length !== 1 ? 's' : ''}
                    </Tag>
                    <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
                        {b2bCustomers.length} cliente{b2bCustomers.length !== 1 ? 's' : ''} B2B total{b2bCustomers.length !== 1 ? 'es' : ''}
                    </Tag>
                </div>
            )}

            {/* Content */}
            {loadingSchedules ? (
                <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></div>
            ) : viewMode === 'calendar' ? (
                <B2BWeeklyCalendar
                    schedules={activeSchedules}
                    orders={orders}
                    onSelectSchedule={handleEdit}
                />
            ) : (
                <Card bodyStyle={{ padding: isMobile ? 0 : 24 }} bordered={!isMobile} style={{ background: isMobile ? 'transparent' : '#fff', boxShadow: 'none' }}>
                    <div style={{ marginBottom: 16, padding: isMobile ? '0 16px' : 0 }}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Buscar negocio..."
                            style={{ width: isMobile ? '100%' : 300 }}
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>

                    {isMobile ? mobileListView : (
                        <Table
                            dataSource={filteredSchedules}
                            columns={columns}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: 'max-content' }}
                        />
                    )}
                </Card>
            )}

            {/* Form Drawer */}
            <B2BScheduleForm
                open={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleSubmit}
                onDelete={handleDelete}
                initialValues={editingSchedule}
                b2bCustomers={b2bCustomers}
                customerOrders={orders}
            />
        </div>
    );
};
