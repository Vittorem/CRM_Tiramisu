import { useState, useMemo } from 'react';
import { Card, Typography, Tabs, Button, Drawer, Form, Input, Select, Tag, Space, message, Empty, Col, Row, Popconfirm, AutoComplete } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CompassOutlined, PictureOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { BaseEntity } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

const { Title, Text, Paragraph } = Typography;

export interface RoadmapItem extends BaseEntity {
    title: string;
    scope: string; // e.g., "Global", "Cocina", "Marketing Local"
    imageUrl?: string;
    description?: string;
    priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
    immediacy: 'Corto plazo' | 'Mediano plazo' | 'Largo plazo';
    status: 'Pendiente' | 'En progreso' | 'Completado';
}

const DEFAULT_SCOPES = ['Global', 'Cocina', 'Marketing Local', 'Expansión'];
const PRIORITIES = ['Baja', 'Media', 'Alta', 'Urgente'];
const IMMEDIACIES = ['Corto plazo', 'Mediano plazo', 'Largo plazo'];
const STATUSES = ['Pendiente', 'En progreso', 'Completado'];

export const RoadmapPage = () => {
    const isMobile = useIsMobile();
    const { data: items } = useFirestoreSubscription<RoadmapItem>('roadmaps');
    const { add, update, softDelete } = useFirestoreMutation<RoadmapItem>('roadmaps');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
    const [activeTab, setActiveTab] = useState<string>('Global');
    const [form] = Form.useForm();

    // The module is hidden in navigation for mobile. If accessed directly:
    if (isMobile) {
        return (
            <div style={{ padding: 24, textAlign: 'center', marginTop: 100 }}>
                <Title level={4}>Módulo no disponible</Title>
                <Paragraph>El Roadmap está diseñado para visualizarse únicamente en dispositivos de escritorio debido a la complejidad del tablero.</Paragraph>
                <Button type="primary" onClick={() => window.history.back()}>Volver</Button>
            </div>
        );
    }

    const scopes = useMemo(() => {
        const uniqueScopes = new Set(DEFAULT_SCOPES);
        items.forEach(item => {
            if (item.scope) uniqueScopes.add(item.scope);
        });
        return Array.from(uniqueScopes).sort();
    }, [items]);

    const itemsByScope = useMemo(() => {
        const grouped: Record<string, RoadmapItem[]> = {};
        scopes.forEach(s => grouped[s] = []);
        items.forEach(item => {
            if (!grouped[item.scope]) grouped[item.scope] = [];
            grouped[item.scope].push(item);
        });
        
        // Sort items inside by status (Pendiente > En progreso > Completado) 
        // We can do a more complex sort if needed, for now just returning them
        for (const scope in grouped) {
            grouped[scope].sort((a, b) => {
                const statusOrder: Record<string, number> = { 'Pendiente': 0, 'En progreso': 1, 'Completado': 2 };
                return statusOrder[a.status] - statusOrder[b.status];
            });
        }
        
        return grouped;
    }, [items, scopes]);

    const handleAdd = () => {
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({ 
            scope: activeTab, 
            priority: 'Media', 
            immediacy: 'Mediano plazo',
            status: 'Pendiente' 
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item: RoadmapItem) => {
        setEditingItem(item);
        form.setFieldsValue(item);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (editingItem) {
                await update(editingItem.id, values);
                message.success('Paso actualizado');
            } else {
                await add(values);
                message.success('Nuevo paso agregado');
            }
            setIsModalOpen(false);
        } catch {
            message.error('Error al guardar el paso del roadmap');
        }
    };

    const handleDelete = async (id: string) => {
        await softDelete(id);
        message.success('Paso eliminado');
    };

    const priorityColors: Record<string, string> = {
        'Baja': 'default',
        'Media': 'blue',
        'Alta': 'orange',
        'Urgente': 'red',
    };

    const statusColors: Record<string, string> = {
        'Pendiente': 'default',
        'En progreso': 'processing',
        'Completado': 'success',
    };

    const renderBoard = (scope: string) => {
        const scopeItems = itemsByScope[scope] || [];
        
        if (scopeItems.length === 0) {
            return (
                <Empty 
                    description={`No hay próximos pasos en el ámbito "${scope}"`} 
                    style={{ marginTop: 40 }}
                >
                    <Button type="primary" onClick={handleAdd}>Agregar el primero</Button>
                </Empty>
            );
        }

        return (
            <Row gutter={[24, 24]}>
                {scopeItems.map(item => (
                    <Col xs={24} sm={12} md={8} lg={6} xl={6} key={item.id}>
                        <Card
                            hoverable
                            cover={
                                item.imageUrl ? (
                                    <div style={{ height: 180, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
                                        <img alt={item.title} src={item.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ) : (
                                    <div style={{ height: 180, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d9d9d9' }}>
                                        <PictureOutlined style={{ fontSize: 48 }} />
                                    </div>
                                )
                            }
                            actions={[
                                <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                                <Popconfirm title="¿Eliminar este paso?" onConfirm={() => handleDelete(item.id)}>
                                    <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                                </Popconfirm>
                            ]}
                            style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, opacity: item.status === 'Completado' ? 0.7 : 1 }}
                            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <Tag color={statusColors[item.status]} style={{ margin: 0 }}>{item.status}</Tag>
                                <Tag color={priorityColors[item.priority]} style={{ margin: 0 }}>{item.priority}</Tag>
                                <Tag style={{ margin: 0 }}>{item.immediacy}</Tag>
                            </div>
                            <Card.Meta 
                                title={<span style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: 16 }}>{item.title}</span>} 
                                description={<span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 8 }}>{item.description}</span>}
                            />
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}><CompassOutlined /> Roadmap Estratégico</Title>
                    <Text type="secondary" style={{ fontSize: 15 }}>Gestiona los próximos pasos y metas visuales para alcanzar tus objetivos.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large" style={{ borderRadius: 8 }}>
                    Nuevo Paso
                </Button>
            </div>

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab} 
                type="card"
                size="large"
                items={scopes.map(scope => ({
                    key: scope,
                    label: scope,
                    children: <div style={{ padding: '16px 0' }}>{renderBoard(scope)}</div>
                }))}
            />

            <Drawer
                title={editingItem ? "Editar Paso" : "Nuevo Paso del Roadmap"}
                placement="right"
                width={500}
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                destroyOnClose
                extra={
                    <Space>
                        <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="primary" onClick={handleSave}>Guardar</Button>
                    </Space>
                }
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label="Título del Paso / Meta" rules={[{ required: true }]}>
                        <Input placeholder="Ej. Remodelar el mostrador" size="large" />
                    </Form.Item>
                    
                    <Form.Item name="scope" label="Ámbito (Tablero)" rules={[{ required: true }]}>
                        <AutoComplete
                            options={scopes.map(s => ({ value: s }))}
                            placeholder="Selecciona o escribe un nuevo ámbito"
                            filterOption={(inputValue, option) =>
                                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                            }
                            size="large"
                        />
                    </Form.Item>
                    
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
                                <Select options={PRIORITIES.map(p => ({ value: p, label: p }))} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="immediacy" label="Inmediatez" rules={[{ required: true }]}>
                                <Select options={IMMEDIACIES.map(i => ({ value: i, label: i }))} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="status" label="Estado" rules={[{ required: true }]}>
                        <Select options={STATUSES.map(s => ({ value: s, label: s }))} size="large" />
                    </Form.Item>

                    <Form.Item name="imageUrl" label="URL de Imagen (Opcional)">
                        <Input placeholder="https://ejemplo.com/imagen.jpg" size="large" />
                    </Form.Item>

                    <Form.Item name="description" label="Descripción / Pasos a seguir">
                        <Input.TextArea rows={5} placeholder="Detalles de lo que se necesita hacer..." size="large" />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};
