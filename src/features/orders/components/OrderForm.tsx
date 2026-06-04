import { useEffect, useState } from 'react';
import { Drawer, Form, Select, DatePicker, InputNumber, Radio, Divider, Input, Button, Space, Typography, Row, Col, Grid, TimePicker, Checkbox, theme, Tag } from 'antd';
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
    const deliveryMethod = Form.useWatch('deliveryMethod', form);
    const hasDiscount = Form.useWatch('hasDiscount', form);
    const hasExtraCharges = Form.useWatch('hasExtraCharges', form);

    const { useBreakpoint } = Grid;
    const screens = useBreakpoint();
    const isMobile = screens.md === false;
    const { token } = theme.useToken();

    // Catalogs & Data
    const { data: customers } = useFirestoreSubscription<Customer>('customers');
    const { data: products } = useFirestoreSubscription<Product>('catalog_products');
    const { data: flavors } = useFirestoreSubscription<Flavor>('catalog_flavors');
    const { data: channels } = useFirestoreSubscription<Channel>('catalog_channels');

    const customerId = Form.useWatch('customerId', form);
    const selectedCustomer = customers.find(c => c.id === customerId);

    // Local state for calculations
    const [totals, setTotals] = useState({ subtotal: 0, discount: 0, total: 0, qty: 0 });

    const prefillCustomerData = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const updates: Record<string, any> = {};

        // 1. Prefill Sale Channel based on mainContactMethod or type
        let matchedChannel;
        if (customer.type === 'B2B') {
            matchedChannel = channels.find(
                c => c.name.toLowerCase().includes('b2b') || c.name.toLowerCase().includes('mayoreo')
            );
        }
        if (!matchedChannel && customer.mainContactMethod) {
            matchedChannel = channels.find(
                c => c.name.toLowerCase().includes(customer.mainContactMethod.toLowerCase())
            );
        }
        if (matchedChannel) {
            updates.channelId = matchedChannel.id;
        }

        // 2. Prefill Delivery Method based on customer type
        if (customer.type === 'B2C') {
            updates.deliveryMethod = 'Recoge';
            updates.shippingCost = 0;
        } else if (customer.type === 'B2B') {
            updates.deliveryMethod = 'Envío';
            updates.shippingCost = 0;
        }

        form.setFieldsValue(updates);
    };

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
                    hasDiscount: (initialValues.discountValue || 0) > 0,
                    hasExtraCharges: (initialValues.extraCharges || 0) > 0,
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
                    hasDiscount: false,
                    hasExtraCharges: false,
                    ...(prefillCustomerId ? { customerId: prefillCustomerId } : {}),
                });
                if (prefillCustomerId) {
                    prefillCustomerData(prefillCustomerId);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialValues, form]);

    const calculateTotals = (values: Record<string, any>) => {
        const items = values.items || [];
        const isShipping = values.deliveryMethod === 'Envío';
        const shipping = isShipping ? ((values.shippingCost as number) || 0) : 0;
        const extra = values.hasExtraCharges ? ((values.extraCharges as number) || 0) : 0;
        const discountVal = values.hasDiscount ? ((values.discountValue as number) || 0) : 0;
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

    const onValuesChange = (changedValues: Record<string, any>) => {
        if ('customerId' in changedValues) {
            prefillCustomerData(changedValues.customerId);
        }
        if ('deliveryMethod' in changedValues && changedValues.deliveryMethod === 'Recoge') {
            form.setFieldsValue({ shippingCost: 0 });
        }
        if ('hasDiscount' in changedValues && !changedValues.hasDiscount) {
            form.setFieldsValue({ discountValue: 0 });
        }
        if ('hasExtraCharges' in changedValues && !changedValues.hasExtraCharges) {
            form.setFieldsValue({ extraCharges: 0, extraChargesReason: '' });
        }
        calculateTotals(form.getFieldsValue());
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

            const { deliveryTime, hasDiscount, hasExtraCharges, ...restValues } = values as Record<string, any>;

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
                shippingCost: values.deliveryMethod === 'Envío' ? (values.shippingCost || 0) : 0,
                discountValue: values.hasDiscount ? (values.discountValue || 0) : 0,
                discountType: values.hasDiscount ? (values.discountType || 'AMOUNT') : 'AMOUNT',
                extraCharges: values.hasExtraCharges ? (values.extraCharges || 0) : 0,
                extraChargesReason: values.hasExtraCharges ? (values.extraChargesReason || '') : '',
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
                        <Form.Item name="customerId" label={<span>Cliente {selectedCustomer && <Tag color={selectedCustomer.type === 'B2B' ? 'blue' : 'green'} style={{ marginLeft: 8 }}>{selectedCustomer.type}</Tag>}</span>} rules={[{ required: true }]}>
                            <Select showSearch optionFilterProp="children" placeholder="Selecciona Cliente">
                                {customers.filter(c => c.isActive !== false).map(c => (
                                    <Option key={c.id} value={c.id}>{c.fullName} - {c.phone} ({c.type})</Option>
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
                                <div key={key} style={{ background: token.colorFillAlter, padding: '16px 16px 0', marginBottom: 16, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, position: 'relative' }}>
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
                        <Form.Item label="Fecha y Hora Entrega" required>
                            <Space wrap>
                                <Form.Item name="deliveryDate" rules={[{ required: true }]} noStyle>
                                    <DatePicker style={{ width: 130 }} format="DD/MM/YYYY" placeholder="Fecha" />
                                </Form.Item>
                                <Form.Item name="deliveryTime" rules={[{ required: true }]} noStyle>
                                    <TimePicker style={{ width: 100 }} format="HH:mm" placeholder="Hora" />
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
                    {deliveryMethod === 'Envío' && (
                        <Col xs={24} md={8}>
                            <Form.Item name="shippingCost" label="Costo Envío">
                                <InputNumber prefix="$" min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    )}
                </Row>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <div style={{ background: token.colorFillAlter, padding: 16, borderRadius: 8, marginBottom: 16, border: `1px solid ${token.colorBorderSecondary}` }}>
                            <Form.Item name="hasDiscount" valuePropName="checked" style={{ marginBottom: hasDiscount ? 16 : 0 }}>
                                <Checkbox style={{ fontWeight: 500 }}>Aplicar Descuento</Checkbox>
                            </Form.Item>
                            
                            {hasDiscount && (
                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item name="discountType" label="Tipo" style={{ marginBottom: 0 }}>
                                            <Select>
                                                <Option value="AMOUNT">Monto ($)</Option>
                                                <Option value="PERCENT">Porcentaje (%)</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="discountValue" label="Valor" style={{ marginBottom: 0 }}>
                                            <InputNumber min={0} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <div style={{ marginTop: 8, color: token.colorError, textAlign: 'right', fontWeight: 500 }}>
                                            Descuento Final: -${totals.discount.toFixed(2)}
                                        </div>
                                    </Col>
                                </Row>
                            )}
                        </div>
                    </Col>

                    <Col xs={24} md={12}>
                        <div style={{ background: token.colorFillAlter, padding: 16, borderRadius: 8, marginBottom: 16, border: `1px solid ${token.colorBorderSecondary}` }}>
                            <Form.Item name="hasExtraCharges" valuePropName="checked" style={{ marginBottom: hasExtraCharges ? 16 : 0 }}>
                                <Checkbox style={{ fontWeight: 500 }}>Cargos Adicionales</Checkbox>
                            </Form.Item>

                            {hasExtraCharges && (
                                <Row gutter={8}>
                                    <Col span={10}>
                                        <Form.Item name="extraCharges" label="Monto" style={{ marginBottom: 0 }}>
                                            <InputNumber prefix="$" min={0} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={14}>
                                        <Form.Item name="extraChargesReason" label="Motivo" style={{ marginBottom: 0 }}>
                                            <Input placeholder="Ej. Empaque" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>
                    </Col>
                </Row>

                <div style={{ background: token.colorFillAlter, padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'right' }}>
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
