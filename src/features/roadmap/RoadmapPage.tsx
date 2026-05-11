import { useState, useMemo, useCallback } from 'react';
import { Typography, Button, Drawer, Form, Input, Select, Tag, Space, message, Empty, Col, Row, Popconfirm, Modal, Switch, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CompassOutlined, WarningOutlined, FireOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { BaseEntity } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTheme } from '../../App';

const { Title, Text, Paragraph } = Typography;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RoadmapScope extends BaseEntity {
    name: string;
}

export interface RoadmapStep extends BaseEntity {
    title: string;
    scopeId: string;
    description?: string;
    immediacy: 'Corto plazo' | 'Mediano plazo' | 'Largo plazo';
    status: 'Pendiente' | 'En progreso' | 'Completado';
    isImportant?: boolean;
    dependsOnId?: string; // ID of the task this depends on
}

// ─── Constants ───────────────────────────────────────────────────────────────

const IMMEDIACIES = ['Corto plazo', 'Mediano plazo', 'Largo plazo'];
const STATUSES = ['Pendiente', 'En progreso', 'Completado'];

// ─── Kanban Board Component ──────────────────────────────────────────────────

function RoadmapKanban({ items, onEdit, onDelete, isDark }: {
    items: RoadmapStep[];
    onEdit: (item: RoadmapStep) => void;
    onDelete: (id: string) => void;
    isDark: boolean;
}) {
    const columns = [
        { title: 'Pendiente', status: 'Pendiente', color: isDark ? '#1f1f1f' : '#f0f2f5', headerColor: '#8c8c8c' },
        { title: 'En progreso', status: 'En progreso', color: isDark ? '#142032' : '#e6f4ff', headerColor: '#1677ff' },
        { title: 'Completado', status: 'Completado', color: isDark ? '#17261a' : '#f6ffed', headerColor: '#52c41a' },
    ];

    const getDependencyTitle = (id?: string) => {
        if (!id) return null;
        const dep = items.find(i => i.id === id);
        return dep ? dep.title : 'Tarea eliminada';
    };

    const checkDependencyCompleted = (id?: string) => {
        if (!id) return true;
        const dep = items.find(i => i.id === id);
        return dep ? dep.status === 'Completado' : true;
    };

    return (
        <Row gutter={[16, 16]} style={{ minHeight: '60vh' }}>
            {columns.map(col => {
                const colItems = items.filter(i => i.status === col.status).sort((a, b) => {
                    // Sort by importance, then immediacy
                    if (a.isImportant && !b.isImportant) return -1;
                    if (!a.isImportant && b.isImportant) return 1;
                    const immOrd: Record<string, number> = { 'Corto plazo': 0, 'Mediano plazo': 1, 'Largo plazo': 2 };
                    return immOrd[a.immediacy] - immOrd[b.immediacy];
                });

                return (
                    <Col xs={24} md={8} key={col.status}>
                        <div style={{
                            background: col.color,
                            borderRadius: 12,
                            padding: 16,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 16, color: col.headerColor }}>{col.title}</Text>
                                <Tag bordered={false}>{colItems.length}</Tag>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                {colItems.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#8c8c8c', fontStyle: 'italic' }}>
                                        Sin tareas
                                    </div>
                                ) : (
                                    colItems.map(item => {
                                        const depTitle = getDependencyTitle(item.dependsOnId);
                                        const isDepCompleted = checkDependencyCompleted(item.dependsOnId);
                                        const isBlocked = !!depTitle && !isDepCompleted && item.status !== 'Completado';

                                        return (
                                            <Card
                                                key={item.id}
                                                size="small"
                                                hoverable
                                                onClick={() => onEdit(item)}
                                                style={{
                                                    borderRadius: 8,
                                                    borderLeft: item.isImportant ? '4px solid #ff4d4f' : `1px solid ${isDark ? '#434343' : '#f0f0f0'}`,
                                                    background: item.isImportant ? (isDark ? '#361516' : '#fff1f0') : (isDark ? '#262626' : '#ffffff'),
                                                    opacity: item.status === 'Completado' ? 0.6 : 1,
                                                }}
                                                bodyStyle={{ padding: 12 }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1, marginRight: 8 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                            {item.isImportant && <FireOutlined style={{ color: '#ff4d4f' }} />}
                                                            <Text strong style={{ fontSize: 14, color: item.isImportant ? '#ff4d4f' : 'inherit', textDecoration: item.status === 'Completado' ? 'line-through' : 'none' }}>
                                                                {item.title}
                                                            </Text>
                                                        </div>
                                                        {item.description && (
                                                            <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 12, color: isDark ? '#a6a6a6' : '#595959', marginBottom: 8, lineHeight: '1.4' }}>
                                                                {item.description}
                                                            </Paragraph>
                                                        )}
                                                        
                                                        {isBlocked && (
                                                            <div style={{ background: isDark ? '#2b2111' : '#fffbe6', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${isDark ? '#d48806' : '#ffe58f'}`, marginBottom: 8 }}>
                                                                <WarningOutlined style={{ color: '#faad14', fontSize: 12 }} />
                                                                <Text style={{ fontSize: 11, color: isDark ? '#e6c88e' : '#d46b08' }}>
                                                                    Esperando a: {depTitle}
                                                                </Text>
                                                            </div>
                                                        )}
                                                        
                                                        {!isBlocked && depTitle && (
                                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                                                                ✓ Dependía de: {depTitle}
                                                            </Text>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: `1px dashed ${isDark ? '#434343' : '#f0f0f0'}` }}>
                                                    <Tag color={
                                                        item.immediacy === 'Corto plazo' ? 'error' : 
                                                        item.immediacy === 'Mediano plazo' ? 'warning' : 'default'
                                                    } style={{ margin: 0, fontSize: 10 }}>
                                                        {item.immediacy}
                                                    </Tag>
                                                    
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <Popconfirm title="¿Eliminar paso?" onConfirm={() => onDelete(item.id)} okText="Sí" cancelText="No">
                                                            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                                        </Popconfirm>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </Col>
                );
            })}
        </Row>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export const RoadmapPage = () => {
    const isMobile = useIsMobile();
    const { isDarkMode } = useTheme();

    // Data
    const { data: scopes } = useFirestoreSubscription<RoadmapScope>('roadmap_scopes');
    const { add: addScope, update: updateScope, softDelete: deleteScope } = useFirestoreMutation<RoadmapScope>('roadmap_scopes');
    const { data: steps } = useFirestoreSubscription<RoadmapStep>('roadmap_steps');
    const { add: addStep, update: updateStep, softDelete: deleteStep } = useFirestoreMutation<RoadmapStep>('roadmap_steps');

    // UI state
    const [activeTab, setActiveTab] = useState<string>('');
    const [stepDrawer, setStepDrawer] = useState(false);
    const [editingStep, setEditingStep] = useState<RoadmapStep | null>(null);
    const [scopeModal, setScopeModal] = useState<{ open: boolean; editing?: RoadmapScope }>({ open: false });
    const [scopeName, setScopeName] = useState('');
    const [form] = Form.useForm();

    // Derived: auto-select first tab if none active
    const sortedScopes = useMemo(() => [...scopes].sort((a, b) => a.name.localeCompare(b.name)), [scopes]);
    const currentTab = activeTab && sortedScopes.find(s => s.id === activeTab) ? activeTab : sortedScopes[0]?.id || '';

    const stepsForTab = useMemo(() => steps.filter(s => s.scopeId === currentTab), [steps, currentTab]);

    // The module is hidden in navigation for mobile
    if (isMobile) {
        return (
            <div style={{ padding: 24, textAlign: 'center', marginTop: 100 }}>
                <Title level={4}>Módulo no disponible</Title>
                <Paragraph>El Roadmap está diseñado para visualizarse únicamente en dispositivos de escritorio.</Paragraph>
                <Button type="primary" onClick={() => window.history.back()}>Volver</Button>
            </div>
        );
    }

    // ─── Scope Handlers ──────────────────────────────────────────────

    const handleAddScope = () => {
        setScopeModal({ open: true });
        setScopeName('');
    };

    const handleEditScope = (scope: RoadmapScope) => {
        setScopeModal({ open: true, editing: scope });
        setScopeName(scope.name);
    };

    const handleSaveScope = async () => {
        if (!scopeName.trim()) { message.warning('Escribe un nombre'); return; }
        try {
            if (scopeModal.editing) {
                await updateScope(scopeModal.editing.id, { name: scopeName.trim() } as any);
                message.success('Pestaña renombrada');
            } else {
                const newDoc = await addScope({ name: scopeName.trim() } as any);
                setActiveTab(newDoc.id);
                message.success('Pestaña creada');
            }
            setScopeModal({ open: false });
        } catch {
            message.error('Error al guardar');
        }
    };

    const handleDeleteScope = async (scopeId: string) => {
        await deleteScope(scopeId);
        // Also soft-delete steps in this scope
        const related = steps.filter(s => s.scopeId === scopeId);
        await Promise.all(related.map(s => deleteStep(s.id)));
        message.success('Pestaña eliminada');
        if (currentTab === scopeId) setActiveTab('');
    };

    // ─── Step Handlers ───────────────────────────────────────────────

    const openStepDrawer = useCallback(() => {
        setEditingStep(null);
        form.resetFields();
        form.setFieldsValue({ 
            scopeId: currentTab, 
            immediacy: 'Mediano plazo', 
            status: 'Pendiente', 
            isImportant: false 
        });
        setStepDrawer(true);
    }, [currentTab, form]);

    const handleEditStep = (step: RoadmapStep) => {
        setEditingStep(step);
        form.setFieldsValue(step);
        setStepDrawer(true);
    };

    const handleSaveStep = async () => {
        try {
            const values = await form.validateFields();
            if (!values.dependsOnId) delete values.dependsOnId;
            if (editingStep) {
                await updateStep(editingStep.id, values);
                message.success('Paso actualizado');
            } else {
                await addStep(values);
                message.success('Paso creado');
            }
            setStepDrawer(false);
        } catch {
            message.error('Error al guardar');
        }
    };

    const handleDeleteStep = async (id: string) => {
        // Remove dependency references
        const dependentSteps = steps.filter(s => s.dependsOnId === id);
        await Promise.all(dependentSteps.map(s => updateStep(s.id, { dependsOnId: '' } as any)));
        await deleteStep(id);
        message.success('Paso eliminado');
    };

    // ─── Render ──────────────────────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}><CompassOutlined /> Roadmap Estratégico</Title>
                    <Text type="secondary" style={{ fontSize: 15 }}>Gestión de próximos pasos y dependencias mediante tableros.</Text>
                </div>
            </div>

            {/* Tabs with scope management */}
            {sortedScopes.length === 0 ? (
                <Empty description="Crea tu primer tablero para empezar a construir tu roadmap." style={{ marginTop: 60 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddScope} size="large">Crear Tablero</Button>
                </Empty>
            ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {sortedScopes.map(scope => {
                                const isActive = scope.id === currentTab;
                                return (
                                    <div
                                        key={scope.id}
                                        onClick={() => setActiveTab(scope.id)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            fontWeight: isActive ? 700 : 500,
                                            fontSize: 14,
                                            background: isActive ? (isDarkMode ? '#333' : '#e6f4ff') : 'transparent',
                                            color: isActive ? (isDarkMode ? '#fff' : '#1677ff') : (isDarkMode ? '#bfbfbf' : '#595959'),
                                            border: `1px solid ${isActive ? (isDarkMode ? '#555' : '#91caff') : (isDarkMode ? '#303030' : '#e8e8e8')}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {scope.name}
                                        <EditOutlined
                                            style={{ fontSize: 11, color: isActive ? 'inherit' : '#8c8c8c' }}
                                            onClick={e => { e.stopPropagation(); handleEditScope(scope); }}
                                        />
                                        <Popconfirm title={`¿Eliminar tablero y sus pasos?`} onConfirm={() => handleDeleteScope(scope.id)} okText="Sí" cancelText="No">
                                            <DeleteOutlined
                                                style={{ fontSize: 11, color: '#ff4d4f' }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </Popconfirm>
                                    </div>
                                );
                            })}
                            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddScope} style={{ borderRadius: 8 }}>
                                Nuevo Tablero
                            </Button>
                        </div>
                        
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openStepDrawer()} size="large" style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(212,163,115,0.3)' }}>
                            Nuevo Paso
                        </Button>
                    </div>

                    {/* Kanban Board */}
                    {currentTab && (
                        <RoadmapKanban
                            items={stepsForTab}
                            onEdit={handleEditStep}
                            onDelete={handleDeleteStep}
                            isDark={isDarkMode}
                        />
                    )}
                </div>
            )}

            {/* ─── Scope Modal ─────────────────────────────────────────── */}
            <Modal
                title={scopeModal.editing ? 'Renombrar Tablero' : 'Nuevo Tablero'}
                open={scopeModal.open}
                onOk={handleSaveScope}
                onCancel={() => setScopeModal({ open: false })}
                okText="Guardar"
                cancelText="Cancelar"
                destroyOnClose
            >
                <Input
                    placeholder="Ej. Marketing Digital"
                    value={scopeName}
                    onChange={e => setScopeName(e.target.value)}
                    onPressEnter={handleSaveScope}
                    size="large"
                    autoFocus
                    style={{ marginTop: 12 }}
                />
            </Modal>

            {/* ─── Step Drawer ─────────────────────────────────────────── */}
            <Drawer
                title={editingStep ? 'Editar Paso' : 'Nuevo Paso'}
                placement="right"
                width={480}
                open={stepDrawer}
                onClose={() => setStepDrawer(false)}
                destroyOnClose
                extra={
                    <Space>
                        <Button onClick={() => setStepDrawer(false)}>Cancelar</Button>
                        <Button type="primary" onClick={handleSaveStep}>Guardar</Button>
                    </Space>
                }
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label="Título del paso" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Ej. Contratar repartidor" size="large" />
                    </Form.Item>

                    <Form.Item name="scopeId" hidden>
                        <Input />
                    </Form.Item>

                    <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                        <Col span={12}>
                            <Form.Item name="isImportant" valuePropName="checked" style={{ margin: 0 }}>
                                <Switch checkedChildren="Importante" unCheckedChildren="Normal" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="immediacy" label="Inmediatez" rules={[{ required: true }]}>
                                <Select options={IMMEDIACIES.map(i => ({ value: i, label: i }))} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="status" label="Estado" rules={[{ required: true }]}>
                                <Select options={STATUSES.map(s => ({ value: s, label: s }))} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="dependsOnId" label="Depende de la tarea: (Opcional)">
                        <Select
                            allowClear
                            placeholder="Selecciona una tarea que debe completarse primero"
                            size="large"
                            options={stepsForTab
                                .filter(s => s.id !== editingStep?.id)
                                .map(s => ({ value: s.id, label: s.title }))}
                        />
                    </Form.Item>

                    <Form.Item name="description" label="Notas (opcional)">
                        <Input.TextArea rows={4} placeholder="Detalles breves..." size="large" />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};
