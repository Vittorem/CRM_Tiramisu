import { useEffect, useState } from 'react';
import { Drawer, Form, Select, DatePicker, InputNumber, Radio, Divider, Input, Button, Space, Typography, Row, Col, Grid, TimePicker } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useFirestoreSubscription } from '../../../hooks/useFirestore';
import { Customer, Product, Flavor, Channel, Order, ORDER_STATUSES, OrderItem, PAYMENT_STATUSES } from '../../../types';
import dayjs from 'dayjs';

interface OrderFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: Partial<Order>) => Promise<void>;
    initialValues?: Order | null;
    loading?: boolean;
    prefillCustomerId?: string | null;
}

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

export const OrderForm = ({ open, onClose, onSubmit, initialValues, loading, prefillCustomerId }: OrderFormProps) => {
    const [form] = Form.useForm();

    const { useBreakpoint } = Grid;
    const screens = useBreakpoint();
    const isMobile = screens.md === false;

    // Catalogs & Data
    const { data: customers } = useFirestoreSubscription<Customer>('customers');
    const { data: products } = useFirestoreSubscription<Product>('catalog_products');
    const { data: flavors } = useFirestoreSubscription<Flavor>('catalog_flavors');
    const { data: channels } = useFirestoreSubscription<Channel>('catalog_channels');
    // Local state for calculations
    const [totals, setTotals] = useState({ subtotal: 0, discount: 0, total: 0, qty: 0 });

    useEffect(() => {
        if (open) {
            form.resetFields();
            if (initialValues) {
                const deliveryDate = initialValues.deliveryDate
                    ? dayjs(initialValues.deliveryDate.toDate())
                    : null;

                // Backwards compatibility for old orders without items payload
                let initialItems = initialValues.items || [];
                if (initialItems.length === 0 && initialValues.productId) {
                    initialItems = [{
                        id: Date.now().toString(),
                        productId: initialValues.productId,
                        productNameAtSale: initialValues.productNameAtSale || '',
                        flavorId: initialValues.flavorId || '',
                        flavorNameAtSale: initialValues.flavorNameAtSale || '',
                        quantity: initialValues.quantity || 1,
                        unitPriceAtSale: initialValues.unitPriceAtSale || 0,
                        subtotal: (initialValues.quantity || 1) * (initialValues.unitPriceAtSale || 0)
                    } as any];
                }

                form.setFieldsValue({
                    ...initialValues,
                    deliveryDate,
                    deliveryTime: deliveryDate,
                    items: initialItems,
                });
                calculateTotals(form.getFieldsValue());
            } else {
                form.setFieldsValue({
                    status: 'Pendiente',
                    paymentStatus: 'No Pagado',
                    items: [{ quantity: 1, unitPriceAtSale: 0 }],
                    shippingCost: 0,
                    discountValue: 0,
                    extraCharges: 0,
                    deliveryMethod: 'Recoge',
                    discountType: 'AMOUNT',
                    deliveryDate: dayjs(),
                    deliveryTime: dayjs(),
                    ...(prefillCustomerId ? { customerId: prefillCustomerId } : {}),
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialValues, form]);

    const calculateTotals = (values: Record<string, any>) => {
        const items = values.items || [];
        const shipping = (values.shippingCost as number) || 0;
        const extra = (values.extraCharges as number) || 0;
        const discountVal = (values.discountValue as number) || 0;
        const discountType = (values.discountType as string) || 'AMOUNT';

        let subtotal = 0;
        let totalQty = 0;

        // Sum basic subtotals
        items.forEach((item: any) => {
            const qty = (item?.quantity as number) || 0;
            const price = (item?.unitPriceAtSale as number) || 0;
            subtotal += qty * price;
            totalQty += qty;
        });

        const discountAmount = discountType === 'PERCENT'
            ? (subtotal * discountVal) / 100
            : discountVal;

        const total = subtotal + shipping + extra - discountAmount;
        setTotals({ subtotal, discount: discountAmount, total, qty: totalQty });
    };

    const handleProductChange = (val: string, index: number) => {
        const prod = products.find(p => p.id === val);
        if (prod) {
            const items = form.getFieldValue('items') || [];
            items[index] = {
                ...items[index],
                productNameAtSale: prod.name,
                unitPriceAtSale: prod.price
            };
            form.setFieldsValue({ items });
            calculateTotals(form.getFieldsValue());
        }
    };

    const onValuesChange = (_: unknown, allValues: Record<string, unknown>) => {
        calculateTotals(allValues);
    };

    const handleFinish = async () => {
        try {
            const values = await form.validateFields();
            const customer = customers.find(c => c.id === values.customerId);

            const items = values.items || [];

            const structuredItems: OrderItem[] = items.map((item: any, i: number) => {
                const pId = item.productId;
                const fId = item.flavorId;
                const prod = products.find(p => p.id === pId);
                const flav = flavors.find(f => f.id === fId);

                return {
                    id: Date.now().toString() + i,
                    productId: pId,
                    productNameAtSale: prod?.name || item.productNameAtSale || 'Desconocido',
                    flavorId: fId,
                    flavorNameAtSale: flav?.name || item.flavorNameAtSale || 'Desconocido',
                    quantity: item.quantity || 1,
                    unitPriceAtSale: item.unitPriceAtSale || 0,
                    subtotal: (item.quantity || 1) * (item.unitPriceAtSale || 0)
                };
            });

            const finalDate = values.deliveryDate.hour(values.deliveryTime ? values.deliveryTime.hour() : 0).minute(values.deliveryTime ? values.deliveryTime.minute() : 0).toDate();

            const { deliveryTime, ...restValues } = values as Record<string, any>;

            const payload: Partial<Order> = {
                ...restValues,
                customerName: customer?.fullName || 'Desconocido',
                deliveryDate: finalDate,
                items: structuredItems,
                productId: structuredItems[0]?.productId || '',
                productNameAtSale: structuredItems[0]?.productNameAtSale || '',
                flavorId: structuredItems[0]?.flavorId || '',
                flavorNameAtSale: structuredItems[0]?.flavorNameAtSale || '',
                quantity: structuredItems.reduce((acc, curr) => acc + curr.quantity, 0),
                unitPriceAtSale: structuredItems[0]?.unitPriceAtSale || 0,
                subtotal: totals.subtotal,
                discountAmount: totals.discount,
                total: totals.total,
            };

            await onSubmit(payload);
            onClose();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Drawer
            title={initialValues ? 'Editar Pedido' : 'Nuevo Pedido'}
            width={isMobile ? '100%' : 640}
            placement={isMobile ? 'bottom' : 'right'}
            height={isMobile ? '90vh' : '100%'}
            onClose={onClose}
            open={open}
            extra={
                !isMobile && (
                    <Space>
                        <Button onClick={onClose}>Cancelar</Button>
                        <Button type="primary" onClick={handleFinish} loading={loading}>Guardar</Button>
                    </Space>
                )
            }
            footer={
                isMobile && (
                    <div style={{ display: 'flex', gap: '8px', padding: '8px' }}>
                        <Button onClick={onClose} style={{ flex: 1 }} size="large">
                            Cancelar
                        </Button>
                        <Button type="primary" onClick={handleFinish} loading={loading} style={{ flex: 1 }} size="large">
                            Guardar
                        </Button>
                    </div>
                )
            }
        >
            <Form form={form} layout="vertical" onValuesChange={onValuesChange} requiredMark={false}>
                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item name="customerId" label="Cliente" rules={[{ required: true }]}>
                            <Select showSearch optionFilterProp="children" placeholder="Selecciona Cliente">
                                {customers.filter(c => c.isActive !== false).map(c => (
                                    <Option key={c.id} value={c.id}>{c.fullName} - {c.phone}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item name="channelId" label="Canal de Venta" rules={[{ required: true }]}>
                            <Select placeholder="Selecciona Canal">
                                {channels.filter(c => c.isActive).map(c => (
                                    <Option key={c.id} value={c.id}>{c.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left">Carrito de Productos</Divider>

                <Form.List name="items">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }, index) => (
                                <div key={key} style={{ background: '#fafafa', padding: '16px 16px 0', marginBottom: 16, borderRadius: 8, border: '1px solid #f0f0f0', position: 'relative' }}>
                                    <Row gutter={16}>
                                        <Col xs={24} md={8}>
                                            <Form.Item {...restField} name={[name, 'productId']} label="Producto" rules={[{ required: true }]}>
                                                <Select onChange={(val) => handleProductChange(val, index)} placeholder="Producto">
                                                    {products.filter(p => p.isActive).map(p => (
                                                        <Option key={p.id} value={p.id}>{p.name} (${p.price})</Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'productNameAtSale']} hidden><Input /></Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item {...restField} name={[name, 'flavorId']} label="Sabor" rules={[{ required: true }]}>
                                                <Select placeholder="Sabor">
                                                    {flavors.filter(f => f.isActive).map(f => (
                                                        <Option key={f.id} value={f.id}>{f.name}</Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'flavorNameAtSale']} hidden><Input /></Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item {...restField} name={[name, 'quantity']} label="Cantidad" rules={[{ required: true }]}>
                                                <InputNumber min={1} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row gutter={16}>
                                        <Col xs={24} md={8}>
                                            <Form.Item {...restField} name={[name, 'unitPriceAtSale']} label="Precio Unitario">
                                                <InputNumber prefix="$" style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            {fields.length > 1 && (
                                                <div style={{ textAlign: 'right', marginTop: 32 }}>
                                                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(name)}>
                                                        Remover
                                                    </Button>
                                                </div>
                                            )}
                                        </Col>
                                    </Row>
                                </div>
                            ))}
                            <Form.Item>
                                <Button type="dashed" onClick={() => add({ quantity: 1, unitPriceAtSale: 0 })} block icon={<PlusOutlined />}>
                                    Añadir otro producto al carrito
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>

                <Row gutter={16}>
                    <Col xs={24}>
                        <div style={{ padding: '0 0 24px', textAlign: 'right' }}>
                            <Text strong>Subtotal Bruto: ${totals.subtotal.toFixed(2)}</Text>
                        </div>
                    </Col>
                </Row>

                <Divider orientation="left">Entrega & Cobro</Divider>

                <Row gutter={16}>
                    <Col xs={24} md={8} style={{ display: isMobile ? 'none' : 'block' }}>
                        <Form.Item label="Fecha y Hora Entrega" required style={{ marginBottom: 0 }}>
                            <Space wrap>
                                <Form.Item name="deliveryDate" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                    <DatePicker style={{ width: '100%', minWidth: 130 }} format="DD/MM/YYYY" placeholder="Fecha" />
                                </Form.Item>
                                <Form.Item name="deliveryTime" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                    <TimePicker style={{ width: '100%', minWidth: 100 }} format="HH:mm" placeholder="Hora" />
                                </Form.Item>
                            </Space>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item name="deliveryMethod" label="Método">
                            <Radio.Group>
                                <Radio value="Recoge">Recoge</Radio>
                                <Radio value="Envío">Envío</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item name="shippingCost" label="Costo Envío">
                            <InputNumber prefix="$" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} md={8} style={{ display: isMobile ? 'none' : 'block' }}>
                        <Form.Item name="discountType" label="Tipo Descuento">
                            <Select>
                                <Option value="AMOUNT">Monto ($)</Option>
                                <Option value="PERCENT">Porcentaje (%)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item name="discountValue" label="Valor Descuento">
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <div style={{ padding: '30px 0', color: 'red' }}>
                            Descuento Final: -${totals.discount.toFixed(2)}
                        </div>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} md={8}>
                        <Form.Item name="extraCharges" label="Cargos Extra">
                            <InputNumber prefix="$" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={16} style={{ display: isMobile ? 'none' : 'block' }}>
                        <Form.Item name="extraChargesReason" label="Motivo Cargo Extra">
                            <Input placeholder="Ej. Empaque especial" />
                        </Form.Item>
                    </Col>
                </Row>

                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'right' }}>
                    <Typography.Title level={3} style={{ margin: 0 }}>
                        Total: ${totals.total.toFixed(2)}
                    </Typography.Title>
                </div>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item name="status" label="Estado Inicial">
                            <Select>
                                {ORDER_STATUSES.map(s => (
                                    <Option key={s} value={s}>{s}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item name="paymentStatus" label="Estado de Pago">
                            <Select>
                                {PAYMENT_STATUSES.map(s => (
                                    <Option key={s} value={s}>{s}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="notes" label="Notas del Pedido">
                    <TextArea rows={3} />
                </Form.Item>
            </Form>
        </Drawer>
    );
};
