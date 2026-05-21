import { useState, useMemo } from 'react';
import { Table, Button, Drawer, Form, Input, InputNumber, Select, Tag, Space, message, Card, Tabs, List as AntList, Typography, Divider, Row, Col, Skeleton, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { InventoryItem, Order } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

const { Title, Text } = Typography;

// ─── Inventory List ──────────────────────────────────────────────────────────

function InventoryList({ items, onEdit, onDelete, onMovement }: {
    items: InventoryItem[];
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    onMovement: (item: InventoryItem, type: 'IN' | 'OUT') => void;
}) {
    const { token: { colorTextSecondary } } = theme.useToken();
    const columns = [
        { title: 'Nombre', dataIndex: 'name', key: 'name' },
        { title: 'Categoría', dataIndex: 'category', key: 'category' },
        {
            title: 'Stock (paquetes)',
            dataIndex: 'stockPackages',
            key: 'stockPackages',
            render: (val: number, r: InventoryItem) => {
                const isLow = val <= r.minPackages;
                return <Tag color={isLow ? 'red' : 'green'}>{val}</Tag>;
            },
        },
        { title: 'Mínimo', dataIndex: 'minPackages', key: 'minPackages' },
        { title: 'Unidad', dataIndex: 'purchaseUnitLabel', key: 'purchaseUnitLabel' },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: unknown, record: InventoryItem) => (
                <Space>
                    <Button icon={<ArrowUpOutlined />} size="small" onClick={() => onMovement(record, 'IN')} title="Entrada" />
                    <Button icon={<ArrowDownOutlined />} size="small" onClick={() => onMovement(record, 'OUT')} title="Salida" />
                    <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(record)} />
                    <Button icon={<DeleteOutlined />} size="small" danger onClick={() => onDelete(record.id)} />
                </Space>
            ),
        },
    ];

    const isMobile = useIsMobile();

    return isMobile ? (
        <AntList
            dataSource={items}
            renderItem={item => {
                const isLow = item.stockPackages <= item.minPackages;
                return (
                    <Card size="small" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <strong style={{ fontSize: 16 }}>{item.name}</strong>
                            <Tag color={isLow ? 'red' : 'green'}>{item.stockPackages} / {item.minPackages} {item.purchaseUnitLabel}</Tag>
                        </div>
                        <div style={{ color: colorTextSecondary, fontSize: 13, margin: '8px 0' }}>📂 {item.category}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                                <Button icon={<ArrowUpOutlined />} onClick={() => onMovement(item, 'IN')} />
                                <Button icon={<ArrowDownOutlined />} onClick={() => onMovement(item, 'OUT')} />
                            </Space>
                            <Space>
                                <Button icon={<EditOutlined />} onClick={() => onEdit(item)} />
                                <Button icon={<DeleteOutlined />} danger onClick={() => onDelete(item.id)} />
                            </Space>
                        </div>
                    </Card>
                );
            }}
        />
    ) : (
        <Table dataSource={items} columns={columns} rowKey="id" size="small" />
    );
}

// ─── Planning Calculator ─────────────────────────────────────────────────────

function PlanningCalculator({ items, orders }: { items: InventoryItem[]; orders: Order[] }) {
    const activeOrders = orders.filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado');

    const suggestions = useMemo(() => {
        return items.filter(i => i.stockPackages <= i.minPackages).map(i => ({
            name: i.name,
            currentStock: i.stockPackages,
            minimum: i.minPackages,
            deficit: i.minPackages - i.stockPackages + 1,
        }));
    }, [items]);

    return (
        <Card>
            <Title level={4}><CalculatorOutlined /> Planificación de Compras</Title>
            <Text type="secondary">
                Items por debajo del mínimo • {activeOrders.length} pedido(s) activos en preparación
            </Text>
            <Divider />
            {suggestions.length === 0 ? (
                <Text type="success">✅ Todo el inventario está por encima del nivel mínimo</Text>
            ) : (
                <AntList
                    dataSource={suggestions}
                    renderItem={s => (
                        <AntList.Item>
                            <AntList.Item.Meta
                                title={s.name}
                                description={`Stock: ${s.currentStock} / Mín: ${s.minimum}`}
                            />
                            <Tag color="red">Comprar al menos {s.deficit}</Tag>
                        </AntList.Item>
                    )}
                />
            )}
        </Card>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export const InventoryPage = () => {
    const { data: items, loading } = useFirestoreSubscription<InventoryItem>('inventory');
    const { data: orders } = useFirestoreSubscription<Order>('orders');
    const { add, update, softDelete } = useFirestoreMutation('inventory');
    const movementsMutation = useFirestoreMutation('inventory_movements');

    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
    const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');

    const [itemForm] = Form.useForm();
    const [movementForm] = Form.useForm();

    // ─── Item Handlers ─────────────────────────────────────────────

    const handleAddItem = () => {
        setEditingItem(null);
        itemForm.resetFields();
        itemForm.setFieldsValue({ isActive: true, stockPackages: 0, minPackages: 1, packageSize: 1 });
        setIsItemModalOpen(true);
    };

    const handleEditItem = (item: InventoryItem) => {
        setEditingItem(item);
        itemForm.setFieldsValue(item);
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async () => {
        try {
            const values = await itemForm.validateFields();
            if (editingItem) {
                await update(editingItem.id, values);
                message.success('Item actualizado');
            } else {
                await add(values);
                message.success('Item creado');
            }
            if (navigator.vibrate) navigator.vibrate(50);
            setIsItemModalOpen(false);
        } catch {
            message.error('Error al guardar');
        }
    };

    const handleDeleteItem = async (id: string) => {
        await softDelete(id);
        message.success('Item eliminado');
        if (navigator.vibrate) navigator.vibrate(50);
    };

    // ─── Movement Handlers ──────────────────────────────────────────

    const handleOpenMovement = (item: InventoryItem, type: 'IN' | 'OUT') => {
        setMovementItem(item);
        setMovementType(type);
        movementForm.resetFields();
        setIsMovementModalOpen(true);
    };

    const handleSaveMovement = async () => {
        if (!movementItem) return;
        try {
            const values = await movementForm.validateFields();
            const qty = values.quantityPackages;
            const newStock = movementType === 'IN'
                ? movementItem.stockPackages + qty
                : Math.max(0, movementItem.stockPackages - qty);

            // Update stock on the item
            await update(movementItem.id, { stockPackages: newStock });

            // Log the movement
            await movementsMutation.add({
                itemId: movementItem.id,
                itemName: movementItem.name,
                type: movementType,
                quantityPackages: qty,
                date: new Date(),
                note: values.note || '',
            });

            message.success(`Movimiento registrado. Stock: ${newStock}`);
            if (navigator.vibrate) navigator.vibrate(50);
            setIsMovementModalOpen(false);
        } catch {
            message.error('Error al registrar movimiento');
        }
    };

    // ─── Tabs ────────────────────────────────────────────────────────

    const tabItems = [
        {
            key: 'items',
            label: 'Inventario',
            children: loading ? (
                <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem}>
                            Nuevo Item
                        </Button>
                    </div>
                    <InventoryList
                        items={items}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        onMovement={handleOpenMovement}
                    />
                </>
            ),
        },
        {
            key: 'planning',
            label: '🧮 Planificación',
            children: <PlanningCalculator items={items} orders={orders} />,
        },
    ];

    const isMobile = useIsMobile();

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 16 }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>Inventario</Title>
            </div>
            <Tabs items={tabItems} size={isMobile ? "small" : "middle"} />

            {/* New/Edit Item Modal */}
            <Drawer
                title={editingItem ? 'Editar Item' : 'Nuevo Item'}
                placement={isMobile ? 'bottom' : 'right'}
                width={isMobile ? '100%' : 600}
                height={isMobile ? '90vh' : '100%'}
                open={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                destroyOnClose
                extra={
                    <Space>
                        <Button onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
                        <Button type="primary" onClick={handleSaveItem}>Guardar</Button>
                    </Space>
                }
            >
                <Form form={itemForm} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="category" label="Categoría" rules={[{ required: true }]}>
                                <Select>
                                    <Select.Option value="Lácteos">Lácteos</Select.Option>
                                    <Select.Option value="Secos">Secos</Select.Option>
                                    <Select.Option value="Insumos">Insumos</Select.Option>
                                    <Select.Option value="Otro">Otro</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="purchaseUnitLabel" label="Unidad de Compra">
                                <Select>
                                    <Select.Option value="bolsa">Bolsa</Select.Option>
                                    <Select.Option value="caja">Caja</Select.Option>
                                    <Select.Option value="paquete">Paquete</Select.Option>
                                    <Select.Option value="cartera">Cartera</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="packageSize" label="Tamaño Paquete">
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="stockPackages" label="Stock Actual">
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="minPackages" label="Mínimo">
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="supplier" label="Proveedor">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="notes" label="Notas">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Drawer>

            {/* Movement Modal */}
            <Drawer
                title={`${movementType === 'IN' ? 'Entrada' : 'Salida'} — ${movementItem?.name}`}
                placement={isMobile ? 'bottom' : 'right'}
                width={isMobile ? '100%' : 400}
                height={isMobile ? '60vh' : '100%'}
                open={isMovementModalOpen}
                onClose={() => setIsMovementModalOpen(false)}
                destroyOnClose
                extra={
                    <Space>
                        <Button onClick={() => setIsMovementModalOpen(false)}>Cancelar</Button>
                        <Button type="primary" onClick={handleSaveMovement}>Guardar</Button>
                    </Space>
                }
            >
                <Form form={movementForm} layout="vertical">
                    <Form.Item name="quantityPackages" label="Cantidad (paquetes)" rules={[{ required: true }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="note" label="Nota">
                        <Input placeholder="Ej. Compra semanal" />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};
