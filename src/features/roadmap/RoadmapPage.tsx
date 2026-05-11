import { useState, useMemo, useCallback } from 'react';
import { Typography, Button, Drawer, Form, Input, Select, Tag, Space, message, Empty, Col, Row, Popconfirm, Modal, Tooltip, Switch, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CompassOutlined, SubnodeOutlined, FireOutlined } from '@ant-design/icons';
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
    priority?: 'Baja' | 'Media' | 'Alta' | 'Urgente';
    immediacy: 'Corto plazo' | 'Mediano plazo' | 'Largo plazo';
    status: 'Pendiente' | 'En progreso' | 'Completado';
    parentId?: string;
    dependsOnId?: string;
    isImportant?: boolean;
}

interface LayoutNode {
    item: RoadmapStep;
    children: LayoutNode[];
    x: number;
    y: number;
    subtreeW: number;
    subtreeH: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITIES = ['Baja', 'Media', 'Alta', 'Urgente'];
const IMMEDIACIES = ['Corto plazo', 'Mediano plazo', 'Largo plazo'];
const STATUSES = ['Pendiente', 'En progreso', 'Completado'];

const NODE_W = 210;
const NODE_H = 68;
const H_GAP = 28;
const V_GAP = 48;
const PAD = 40;
const MAX_COLS = 4; // max children per row before wrapping

const PRIORITY_COLORS: Record<string, string> = { Baja: '#52c41a', Media: '#1677ff', Alta: '#fa8c16', Urgente: '#ff4d4f' };
const STATUS_META: Record<string, { color: string; label: string }> = {
    Pendiente: { color: '#8c8c8c', label: '○' },
    'En progreso': { color: '#1677ff', label: '◉' },
    Completado: { color: '#52c41a', label: '✓' },
};

// ─── Tree layout algorithm (grid-wrapping) ───────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function buildTree(items: RoadmapStep[]): LayoutNode[] {
    const map = new Map<string, LayoutNode>();
    items.forEach(it => map.set(it.id, { item: it, children: [], x: 0, y: 0, subtreeW: 0, subtreeH: 0 }));

    const roots: LayoutNode[] = [];
    map.forEach(node => {
        const pid = node.item.parentId || node.item.dependsOnId;
        const parent = pid ? map.get(pid) : undefined;
        if (parent) parent.children.push(node);
        else roots.push(node);
    });

    // Sort children: priority desc, then immediacy asc
    const priOrd: Record<string, number> = { Urgente: 0, Alta: 1, Media: 2, Baja: 3 };
    const immOrd: Record<string, number> = { 'Corto plazo': 0, 'Mediano plazo': 1, 'Largo plazo': 2 };
    const sortFn = (a: LayoutNode, b: LayoutNode) => {
        if (a.item.isImportant && !b.item.isImportant) return -1;
        if (!a.item.isImportant && b.item.isImportant) return 1;
        const pA = a.item.priority ? priOrd[a.item.priority] : 2;
        const pB = b.item.priority ? priOrd[b.item.priority] : 2;
        return pA - pB || immOrd[a.item.immediacy] - immOrd[b.item.immediacy];
    };
    const sortAll = (nodes: LayoutNode[]) => { nodes.sort(sortFn); nodes.forEach(n => sortAll(n.children)); };
    sortAll(roots);

    return roots;
}

/** Calculate subtree width & height bottom-up, wrapping children into rows of MAX_COLS */
function calcDims(node: LayoutNode): void {
    if (node.children.length === 0) {
        node.subtreeW = NODE_W;
        node.subtreeH = NODE_H;
        return;
    }

    node.children.forEach(c => calcDims(c));

    const rows = chunk(node.children, MAX_COLS);

    // Width = widest row
    let maxRowW = 0;
    rows.forEach(row => {
        const rowW = row.reduce((s, c) => s + c.subtreeW, 0) + (row.length - 1) * H_GAP;
        maxRowW = Math.max(maxRowW, rowW);
    });

    // Height = this node + gap + sum of row heights (each row = tallest child in that row)
    let childrenH = 0;
    rows.forEach((row, i) => {
        childrenH += Math.max(...row.map(c => c.subtreeH));
        if (i < rows.length - 1) childrenH += V_GAP;
    });

    node.subtreeW = Math.max(NODE_W, maxRowW);
    node.subtreeH = NODE_H + V_GAP + childrenH;
}

/** Assign x,y positions top-down, placing children in wrapped rows */
function assignPos(node: LayoutNode, x: number, y: number) {
    node.x = x + node.subtreeW / 2 - NODE_W / 2;
    node.y = y;

    if (node.children.length === 0) return;

    const rows = chunk(node.children, MAX_COLS);
    let curY = y + NODE_H + V_GAP;

    rows.forEach(row => {
        const rowW = row.reduce((s, c) => s + c.subtreeW, 0) + (row.length - 1) * H_GAP;
        let cx = x + (node.subtreeW - rowW) / 2; // center row under parent

        let rowH = 0;
        row.forEach(c => {
            assignPos(c, cx, curY);
            cx += c.subtreeW + H_GAP;
            rowH = Math.max(rowH, c.subtreeH);
        });
        curY += rowH + V_GAP;
    });
}

function layoutForest(roots: LayoutNode[]): { nodes: LayoutNode[]; w: number; h: number } {
    roots.forEach(r => calcDims(r));
    let sx = PAD;
    roots.forEach(r => { assignPos(r, sx, PAD); sx += r.subtreeW + H_GAP * 2; });

    const all: LayoutNode[] = [];
    const collect = (n: LayoutNode) => { all.push(n); n.children.forEach(collect); };
    roots.forEach(collect);

    let maxX = 0, maxY = 0;
    all.forEach(n => { maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + NODE_H); });
    return { nodes: all, w: maxX + PAD, h: maxY + PAD };
}

function getEdges(roots: LayoutNode[]): { x1: number; y1: number; x2: number; y2: number }[] {
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const walk = (n: LayoutNode) => {
        n.children.forEach(c => {
            edges.push({ x1: n.x + NODE_W / 2, y1: n.y + NODE_H, x2: c.x + NODE_W / 2, y2: c.y });
            walk(c);
        });
    };
    roots.forEach(walk);
    return edges;
}

// ─── Concept Map Component ───────────────────────────────────────────────────

function ConceptMap({ items, onEdit, onDelete, onAddChild, isDark }: {
    items: RoadmapStep[];
    onEdit: (item: RoadmapStep) => void;
    onDelete: (id: string) => void;
    onAddChild: (parentId: string) => void;
    isDark: boolean;
}) {
    const roots = useMemo(() => buildTree(items), [items]);
    const { nodes, w, h } = useMemo(() => layoutForest(roots), [roots]);
    const edges = useMemo(() => getEdges(roots), [roots]);

    if (items.length === 0) return null; // handled by parent

    return (
        <div style={{ overflow: 'auto', borderRadius: 12, border: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`, background: isDark ? '#1a1a1a' : '#fafafa', position: 'relative' }}>
            <div style={{ position: 'relative', minWidth: w, minHeight: h }}>
                {/* SVG connections */}
                <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    <defs>
                        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill={isDark ? '#555' : '#bfbfbf'} />
                        </marker>
                    </defs>
                    {edges.map((e, i) => {
                        const midY = (e.y1 + e.y2) / 2;
                        return (
                            <path
                                key={i}
                                d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                                fill="none"
                                stroke={isDark ? '#555' : '#d9d9d9'}
                                strokeWidth={2}
                                markerEnd="url(#arrowhead)"
                            />
                        );
                    })}
                </svg>

                {/* Nodes */}
                {nodes.map(n => {
                    const s = STATUS_META[n.item.status];
                    const pc = n.item.priority ? PRIORITY_COLORS[n.item.priority] : '#d9d9d9';
                    const completed = n.item.status === 'Completado';
                    const isImp = !!n.item.isImportant;
                    
                    return (
                        <div
                            key={n.item.id}
                            className="roadmap-node"
                            style={{
                                position: 'absolute',
                                left: n.x,
                                top: n.y,
                                width: NODE_W,
                                height: NODE_H,
                                borderRadius: 10,
                                background: isImp ? (isDark ? '#361516' : '#fff1f0') : (isDark ? '#262626' : '#fff'),
                                border: `2px solid ${isImp ? '#ff4d4f' : completed ? '#52c41a' : isDark ? '#404040' : '#e8e8e8'}`,
                                borderLeft: `4px solid ${isImp ? '#ff4d4f' : pc}`,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                padding: '8px 12px',
                                boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
                                opacity: completed ? 0.6 : 1,
                                transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onClick={() => onEdit(n.item)}
                        >
                            {/* Title row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ color: s.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{s.label}</span>
                                {isImp && <FireOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
                                <span style={{
                                    fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap', color: isImp ? '#ff4d4f' : (isDark ? '#e6e6e6' : '#262626'),
                                    textDecoration: completed ? 'line-through' : 'none',
                                }}>{n.item.title}</span>
                            </div>
                            {/* Meta row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {n.item.priority && <Tag color={pc} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{n.item.priority}</Tag>}
                                    <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{n.item.immediacy}</Tag>
                                </div>
                                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                                    <Tooltip title="Agregar sub-paso">
                                        <Button type="text" size="small" icon={<SubnodeOutlined />} style={{ fontSize: 12, width: 22, height: 22 }} onClick={() => onAddChild(n.item.id)} />
                                    </Tooltip>
                                    <Popconfirm title="¿Eliminar?" onConfirm={() => onDelete(n.item.id)} okText="Sí" cancelText="No">
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 12, width: 22, height: 22 }} />
                                    </Popconfirm>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Inject hover styles */}
            <style>{`
                .roadmap-node:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; z-index: 5; }
            `}</style>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export const RoadmapPage = () => {
    const isMobile = useIsMobile();
    const { isDarkMode } = useTheme();
    const { token: { colorPrimary } } = theme.useToken();

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

    const openStepDrawer = useCallback((parentId?: string) => {
        setEditingStep(null);
        form.resetFields();
        form.setFieldsValue({ scopeId: currentTab, priority: 'Media', immediacy: 'Mediano plazo', status: 'Pendiente', parentId: parentId || undefined, isImportant: false });
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
            if (!values.parentId) delete values.parentId;
            
            // Clean up dependsOnId to use parentId for consistency moving forward
            if (values.dependsOnId) {
                values.parentId = values.dependsOnId;
                delete values.dependsOnId;
            }
            
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
        // Promote children to root (remove their parentId)
        const children = steps.filter(s => s.parentId === id);
        await Promise.all(children.map(c => updateStep(c.id, { parentId: '' } as any)));
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
                    <Text type="secondary" style={{ fontSize: 15 }}>Organiza próximos pasos conectados como mapa conceptual.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openStepDrawer()} size="large" disabled={sortedScopes.length === 0}>
                    Nuevo Paso
                </Button>
            </div>

            {/* Tabs with scope management */}
            {sortedScopes.length === 0 ? (
                <Empty description="Crea tu primera pestaña para empezar a construir tu roadmap." style={{ marginTop: 60 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddScope} size="large">Crear Pestaña</Button>
                </Empty>
            ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
                                        background: isActive ? (isDarkMode ? '#2a2215' : '#fff7ed') : 'transparent',
                                        color: isActive ? colorPrimary : (isDarkMode ? '#bfbfbf' : '#595959'),
                                        border: `1px solid ${isActive ? colorPrimary : (isDarkMode ? '#303030' : '#e8e8e8')}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {scope.name}
                                    <EditOutlined
                                        style={{ fontSize: 11, color: '#8c8c8c' }}
                                        onClick={e => { e.stopPropagation(); handleEditScope(scope); }}
                                    />
                                    <Popconfirm title={`¿Eliminar "${scope.name}" y sus pasos?`} onConfirm={() => handleDeleteScope(scope.id)} okText="Sí" cancelText="No">
                                        <DeleteOutlined
                                            style={{ fontSize: 11, color: '#ff4d4f' }}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </Popconfirm>
                                </div>
                            );
                        })}
                        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddScope} style={{ borderRadius: 8 }}>
                            Nueva Pestaña
                        </Button>
                    </div>

                    {/* Concept Map */}
                    {currentTab && (
                        stepsForTab.length === 0 ? (
                            <Empty description={`No hay pasos en esta pestaña`} style={{ marginTop: 60 }}>
                                <Button type="primary" onClick={() => openStepDrawer()}>Agregar el primero</Button>
                            </Empty>
                        ) : (
                            <ConceptMap
                                items={stepsForTab}
                                onEdit={handleEditStep}
                                onDelete={handleDeleteStep}
                                onAddChild={(pid) => openStepDrawer(pid)}
                                isDark={isDarkMode}
                            />
                        )
                    )}
                </div>
            )}

            {/* ─── Scope Modal ─────────────────────────────────────────── */}
            <Modal
                title={scopeModal.editing ? 'Renombrar Pestaña' : 'Nueva Pestaña'}
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
                        <Input placeholder="Ej. Remodelar el mostrador" size="large" />
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
                            <Form.Item name="priority" label="Prioridad">
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

                    <Form.Item name="parentId" label="Conectar debajo de (opcional)">
                        <Select
                            allowClear
                            placeholder="Raíz (sin conexión)"
                            size="large"
                            options={stepsForTab
                                .filter(s => s.id !== editingStep?.id)
                                .map(s => ({ value: s.id, label: s.title }))}
                        />
                    </Form.Item>

                    <Form.Item name="description" label="Notas (opcional)">
                        <Input.TextArea rows={3} placeholder="Detalles breves..." size="large" />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
};
