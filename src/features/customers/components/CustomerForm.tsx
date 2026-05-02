import { useEffect } from 'react';
import { Drawer, Form, Input, Select, Button, InputNumber, Row, Col, Space, Divider, Switch, Tabs, Timeline, Card, Tag } from 'antd';
import { Customer, Order } from '../../../types';
import { useFirestoreSubscription } from '../../../hooks/useFirestore';
import dayjs from 'dayjs';
import { useIsMobile } from '../../../hooks/useIsMobile';

interface CustomerFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: Partial<Customer>) => Promise<void>;
    initialValues?: Customer | null;
    loading?: boolean;
}

const { Option } = Select;
const { TextArea } = Input;

export const CustomerForm = ({ open, onClose, onSubmit, initialValues, loading }: CustomerFormProps) => {
    const [form] = Form.useForm();
    const isMobile = useIsMobile();

    const { data: orders } = useFirestoreSubscription<Order>('orders');

    // Sort logic
    const customerOrders = initialValues
        ? orders.filter(o => o.customerId === initialValues.id).sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt as any);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt as any);
            return dateB.valueOf() - dateA.valueOf();
        })
        : [];

    useEffect(() => {
        if (open) {
            form.resetFields();
            if (initialValues) {
                form.setFieldsValue(initialValues);
            } else {
                form.setFieldsValue({ isActive: true, type: 'B2C', mainContactMethod: 'WhatsApp', loyaltyPoints: 0 });
            }
        }
    }, [open, initialValues, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            await onSubmit(values);
            onClose();
        } catch (error) {
            console.error('Validate Failed:', error);
        }
    };

    const formContent = (
        <Form layout="vertical" form={form} requiredMark={false}>
            <Form.Item name="isActive" valuePropName="checked" hidden>
                <Switch />
            </Form.Item>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="fullName" label="Nombre Completo" rules={[{ required: true, message: 'Ingresa el nombre' }]}>
                        <Input placeholder="Ej. Ana Pérez" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="phone" label="Teléfono" rules={[{ required: true, message: 'Ingresa el teléfono' }]}>
                        <Input placeholder="55 1234 5678" />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="loyaltyPoints" label="Puntos Lealtad (Bambinos)">
                        <InputNumber style={{ width: '100%' }} disabled />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="mainContactMethod" label="Medio de contacto principal" rules={[{ required: true }]}>
                        <Select>
                            <Option value="Instagram">Instagram</Option>
                            <Option value="WhatsApp">WhatsApp</Option>
                            <Option value="Facebook">Facebook</Option>
                            <Option value="Otro">Otro</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="type" label="Tipo de Cliente" rules={[{ required: true }]}>
                        <Select>
                            <Option value="B2C">Individual (B2C)</Option>
                            <Option value="B2B">Negocio (B2B)</Option>
                        </Select>
                    </Form.Item>
                </Col>
            </Row>

            <Divider plain>Perfil Demográfico</Divider>

            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item name="gender" label="Género">
                        <Select allowClear>
                            <Option value="F">Femenino</Option>
                            <Option value="M">Masculino</Option>
                            <Option value="Otro">Otro</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="age" label="Edad">
                        <InputNumber style={{ width: '100%' }} min={0} max={120} />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="civilStatus" label="Estado Civil">
                        <Select allowClear>
                            <Option value="Soltero/a">Soltero/a</Option>
                            <Option value="Casado/a">Casado/a</Option>
                            <Option value="Divorciado/a">Divorciado/a</Option>
                        </Select>
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="occupation" label="Ocupación">
                        <Input placeholder="Ej. Abogada" />
                    </Form.Item>
                </Col>
                {!isMobile && (
                    <Col span={12}>
                        <Form.Item name="email" label="Email (Opcional)">
                            <Input type="email" />
                        </Form.Item>
                    </Col>
                )}
            </Row>

            <Divider plain>Redes & Ubicación</Divider>

            {!isMobile && (
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="instagramHandle" label="Instagram User">
                            <Input prefix="@" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="facebookLink" label="Facebook Link">
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>
            )}
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="colonia" label="Colonia">
                        <Input />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="city" label="Ciudad">
                        <Input />
                    </Form.Item>
                </Col>
            </Row>

            {!isMobile && (
                <>
                    <Divider plain>Notas y Etiquetas</Divider>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name="tags" label="Etiquetas">
                                <Select mode="tags" style={{ width: '100%' }} placeholder="Ej. VIP, Alérgico a nuez" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name="notes" label="Notas Internas">
                                <TextArea rows={4} />
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )}
        </Form>
    );

    return (
        <Drawer
            title={initialValues ? 'Perfil de Cliente' : 'Nuevo Cliente'}
            width={isMobile ? '100%' : 720}
            placement={isMobile ? 'bottom' : 'right'}
            height={isMobile ? '90vh' : '100%'}
            onClose={onClose}
            open={open}
            styles={{ body: { paddingBottom: 80 } }}
            extra={
                !isMobile && (
                    <Space>
                        <Button onClick={onClose}>Cancelar</Button>
                        <Button onClick={handleSubmit} type="primary" loading={loading}>
                            Guardar
                        </Button>
                    </Space>
                )
            }
            footer={
                isMobile && (
                    <div style={{ display: 'flex', gap: '8px', padding: '8px' }}>
                        <Button onClick={onClose} style={{ flex: 1 }} size="large">
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} type="primary" loading={loading} style={{ flex: 1 }} size="large">
                            Guardar
                        </Button>
                    </div>
                )
            }
        >
            {initialValues ? (
                <Tabs defaultActiveKey="info" items={[
                    {
                        key: 'info',
                        label: 'Información',
                        children: formContent,
                    },
                    {
                        key: 'timeline',
                        label: 'Muro Histórico',
                        children: (
                            <div style={{ padding: '16px 0' }}>
                                <Card size="small" style={{ marginBottom: 24, borderRadius: 12, border: 'none', background: '#fcfcfc', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <Row gutter={16} align="middle">
                                        <Col span={8} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 12, color: 'gray' }}>Pedidos</div>
                                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{customerOrders.length}</div>
                                        </Col>
                                        <Col span={8} style={{ textAlign: 'center', borderLeft: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }}>
                                            <div style={{ fontSize: 12, color: 'gray' }}>Ticket Histórico</div>
                                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>${customerOrders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}</div>
                                        </Col>
                                        <Col span={8} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 12, color: 'gray' }}>Puntos Lealtad</div>
                                            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#d4a373' }}>{initialValues.loyaltyPoints || 0}</div>
                                        </Col>
                                    </Row>
                                </Card>
                                {customerOrders.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'gray', padding: 40 }}>Este cliente aún no tiene historial de compras.</div>
                                ) : (
                                    <Timeline
                                        items={customerOrders.map(o => ({
                                            color: o.status === 'Entregado' ? 'green' : o.status === 'Cancelado' ? 'red' : 'blue',
                                            children: (
                                                <div style={{ paddingBottom: 12 }}>
                                                    <div style={{ fontWeight: 'bold' }}>{dayjs(o.createdAt?.toDate?.() || o.createdAt).format('DD MMM YYYY, HH:mm')}</div>
                                                    <div style={{ color: 'gray', fontSize: 13, marginBottom: 4 }}>
                                                        {o.items?.map(i => `${i.quantity}x ${i.productNameAtSale}`).join(', ') || `${o.quantity || 1}x ${o.productNameAtSale}`}
                                                    </div>
                                                    <div style={{ fontWeight: 500, color: '#333' }}>Total: ${o.total.toFixed(2)} — <Tag color={o.status === 'Entregado' ? 'green' : 'blue'}>{o.status}</Tag></div>
                                                </div>
                                            )
                                        }))}
                                    />
                                )}
                            </div>
                        ),
                    }
                ]} />
            ) : formContent}
        </Drawer>
    );
};
