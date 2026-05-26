import { useEffect, useState } from 'react';
import { Drawer, Form, Input, Select, Button, Space, Divider, Checkbox, Row, Col, Tag, Card, Timeline, Tabs } from 'antd';
import { PlusOutlined, MinusCircleOutlined, WhatsAppOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { B2BDeliverySchedule, Customer, DAYS_OF_WEEK, DayOfWeek, Order } from '../../../types';
import { useIsMobile } from '../../../hooks/useIsMobile';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

interface B2BScheduleFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: Partial<B2BDeliverySchedule>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    initialValues?: B2BDeliverySchedule | null;
    b2bCustomers: Customer[];
    customerOrders: Order[];
    loading?: boolean;
}

const DAY_COLORS: Record<DayOfWeek, string> = {
    'Lunes': '#1890ff',
    'Martes': '#52c41a',
    'Miércoles': '#722ed1',
    'Jueves': '#fa8c16',
    'Viernes': '#eb2f96',
    'Sábado': '#13c2c2',
    'Domingo': '#f5222d',
};

export const B2BScheduleForm = ({
    open, onClose, onSubmit, onDelete, initialValues, b2bCustomers, customerOrders, loading
}: B2BScheduleFormProps) => {
    const [form] = Form.useForm();
    const isMobile = useIsMobile();
    const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);

    useEffect(() => {
        if (open) {
            form.resetFields();
            if (initialValues) {
                form.setFieldsValue({
                    customerId: initialValues.customerId,
                    deliveryDays: initialValues.deliveryDays,
                    preferredTime: initialValues.preferredTime,
                    contacts: initialValues.contacts?.length ? initialValues.contacts : [{ name: '', phone: '', isWhatsApp: true, isPrimary: true }],
                    deliveryAddress: initialValues.deliveryAddress,
                    deliveryNotes: initialValues.deliveryNotes,
                    notes: initialValues.notes,
                    isActive: initialValues.isActive,
                });
                setSelectedDays(initialValues.deliveryDays || []);
            } else {
                form.setFieldsValue({
                    isActive: true,
                    contacts: [{ name: '', phone: '', isWhatsApp: true, isPrimary: true }],
                    deliveryDays: [],
                });
                setSelectedDays([]);
            }
        }
    }, [open, initialValues, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (selectedDays.length === 0) return;
            const customer = b2bCustomers.find(c => c.id === values.customerId);
            await onSubmit({
                ...values,
                customerName: customer?.fullName || initialValues?.customerName || '',
                deliveryDays: selectedDays,
                isActive: values.isActive ?? true,
            });
            onClose();
        } catch (error) {
            console.error('Validate Failed:', error);
        }
    };

    const toggleDay = (day: DayOfWeek) => {
        setSelectedDays(prev => {
            const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
            form.setFieldValue('deliveryDays', next);
            return next;
        });
    };

    // Orders for the selected customer (for history tab)
    const selectedCustomerId = Form.useWatch('customerId', form);
    const relatedOrders = selectedCustomerId
        ? customerOrders.filter(o => o.customerId === selectedCustomerId)
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt as unknown as string);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt as unknown as string);
                return dateB.valueOf() - dateA.valueOf();
            })
            .slice(0, 20)
        : [];

    const formContent = (
        <Form layout="vertical" form={form} requiredMark={false}>
            <Form.Item name="isActive" hidden>
                <Input />
            </Form.Item>
            <Form.Item name="deliveryDays" hidden>
                <Input />
            </Form.Item>

            {/* Customer Selection */}
            <Form.Item
                name="customerId"
                label="Negocio (Cliente B2B)"
                rules={[{ required: true, message: 'Selecciona un negocio' }]}
            >
                <Select
                    showSearch
                    placeholder="Buscar negocio B2B..."
                    optionFilterProp="children"
                    disabled={!!initialValues}
                    filterOption={(input, option) =>
                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {b2bCustomers.map(c => (
                        <Option key={c.id} value={c.id}>{c.fullName}</Option>
                    ))}
                </Select>
            </Form.Item>

            {/* Day Selection — visual chips */}
            <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Días de Entrega <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {DAYS_OF_WEEK.map(day => {
                        const isSelected = selectedDays.includes(day);
                        return (
                            <div
                                key={day}
                                onClick={() => toggleDay(day)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 20,
                                    cursor: 'pointer',
                                    fontWeight: isSelected ? 600 : 400,
                                    fontSize: 13,
                                    background: isSelected ? DAY_COLORS[day] : '#f5f5f5',
                                    color: isSelected ? '#fff' : '#666',
                                    border: isSelected ? `2px solid ${DAY_COLORS[day]}` : '2px solid #e8e8e8',
                                    transition: 'all 0.2s ease',
                                    userSelect: 'none',
                                }}
                            >
                                {day}
                            </div>
                        );
                    })}
                </div>
                {selectedDays.length === 0 && (
                    <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>Selecciona al menos un día</div>
                )}
            </div>

            {/* Preferred Time */}
            <Form.Item name="preferredTime" label="Horario Preferido de Entrega">
                <Input placeholder="Ej. 9:00 - 11:00 AM" prefix={<ClockCircleOutlined />} />
            </Form.Item>

            <Divider plain>Contactos del Negocio</Divider>

            {/* Dynamic Contacts List */}
            <Form.List name="contacts">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <Card
                                key={key}
                                size="small"
                                style={{ marginBottom: 12, borderRadius: 8, background: '#fafafa' }}
                                styles={{ body: { padding: 12 } }}
                            >
                                <Row gutter={12}>
                                    <Col xs={12} md={8}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'name']}
                                            label="Nombre"
                                            rules={[{ required: true, message: 'Nombre requerido' }]}
                                            style={{ marginBottom: 8 }}
                                        >
                                            <Input placeholder="Nombre del contacto" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} md={8}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'phone']}
                                            label="Teléfono"
                                            rules={[{ required: true, message: 'Teléfono requerido' }]}
                                            style={{ marginBottom: 8 }}
                                        >
                                            <Input placeholder="55 1234 5678" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} md={8}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'role']}
                                            label="Rol"
                                            style={{ marginBottom: 8 }}
                                        >
                                            <Input placeholder="Ej. Encargado de compras" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Space size="middle">
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'isWhatsApp']}
                                            valuePropName="checked"
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Checkbox>
                                                <WhatsAppOutlined style={{ color: '#25D366' }} /> WhatsApp
                                            </Checkbox>
                                        </Form.Item>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'isPrimary']}
                                            valuePropName="checked"
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Checkbox>Principal</Checkbox>
                                        </Form.Item>
                                    </Space>
                                    {fields.length > 1 && (
                                        <Button
                                            type="text"
                                            danger
                                            icon={<MinusCircleOutlined />}
                                            onClick={() => remove(name)}
                                            size="small"
                                        />
                                    )}
                                </div>
                            </Card>
                        ))}
                        <Button
                            type="dashed"
                            onClick={() => add({ name: '', phone: '', isWhatsApp: true, isPrimary: false })}
                            block
                            icon={<PlusOutlined />}
                            style={{ marginBottom: 16 }}
                        >
                            Agregar Contacto
                        </Button>
                    </>
                )}
            </Form.List>

            <Divider plain>Logística y Notas</Divider>

            <Form.Item name="deliveryAddress" label="Dirección de Entrega">
                <TextArea rows={2} placeholder="Dirección completa del negocio" />
            </Form.Item>

            <Form.Item name="deliveryNotes" label="Notas de Entrega">
                <TextArea rows={2} placeholder="Ej. Entrar por la puerta trasera, preguntar por Juan" />
            </Form.Item>

            <Form.Item name="notes" label="Notas Generales">
                <TextArea rows={3} placeholder="Notas adicionales sobre el negocio..." />
            </Form.Item>
        </Form>
    );

    const historyContent = (
        <div style={{ padding: '16px 0' }}>
            {selectedCustomerId && (
                <Card size="small" style={{ marginBottom: 24, borderRadius: 12, border: 'none', background: '#fcfcfc', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <Row gutter={16} align="middle">
                        <Col span={8} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'gray' }}>Pedidos</div>
                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{relatedOrders.length}</div>
                        </Col>
                        <Col span={8} style={{ textAlign: 'center', borderLeft: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }}>
                            <div style={{ fontSize: 12, color: 'gray' }}>Total Histórico</div>
                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                                ${relatedOrders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
                            </div>
                        </Col>
                        <Col span={8} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'gray' }}>Entregados</div>
                            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                                {relatedOrders.filter(o => o.status === 'Entregado').length}
                            </div>
                        </Col>
                    </Row>
                </Card>
            )}

            {relatedOrders.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'gray', padding: 40 }}>
                    Este negocio aún no tiene historial de pedidos.
                </div>
            ) : (
                <Timeline
                    items={relatedOrders.map(o => ({
                        color: o.status === 'Entregado' ? 'green' : o.status === 'Cancelado' ? 'red' : 'blue',
                        children: (
                            <div style={{ paddingBottom: 12 }}>
                                <div style={{ fontWeight: 'bold' }}>
                                    {dayjs(o.createdAt?.toDate?.() || o.createdAt).format('DD MMM YYYY, HH:mm')}
                                </div>
                                <div style={{ color: 'gray', fontSize: 13, marginBottom: 4 }}>
                                    {o.items?.map(i => `${i.quantity}x ${i.productNameAtSale}`).join(', ') || `${o.quantity || 1}x ${o.productNameAtSale}`}
                                </div>
                                <div style={{ fontWeight: 500, color: '#333' }}>
                                    Total: ${o.total.toFixed(2)} — <Tag color={o.status === 'Entregado' ? 'green' : 'blue'}>{o.status}</Tag>
                                </div>
                            </div>
                        ),
                    }))}
                />
            )}
        </div>
    );

    const drawerContent = initialValues ? (
        <Tabs defaultActiveKey="config" items={[
            { key: 'config', label: 'Configuración', children: formContent },
            { key: 'history', label: 'Historial de Pedidos', children: historyContent },
        ]} />
    ) : formContent;

    return (
        <Drawer
            title={initialValues ? `Editar — ${initialValues.customerName}` : 'Nueva Programación B2B'}
            width={isMobile ? '100%' : 640}
            placement={isMobile ? 'bottom' : 'right'}
            height={isMobile ? '92vh' : '100%'}
            onClose={onClose}
            open={open}
            styles={{ body: { paddingBottom: 80 } }}
            extra={
                <Space>
                    {initialValues && onDelete && (
                        <Button danger onClick={() => { onDelete(initialValues.id); onClose(); }}>
                            Eliminar
                        </Button>
                    )}
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} type="primary" loading={loading}>
                        Guardar
                    </Button>
                </Space>
            }
        >
            {drawerContent}
        </Drawer>
    );
};
