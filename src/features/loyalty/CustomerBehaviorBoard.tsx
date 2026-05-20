import { useState, useMemo } from 'react';
import { Card, Tabs, Table, Tag, Input, Empty, Badge, Tooltip, Segmented, Space, Checkbox, Modal, Button, Typography } from 'antd';
import { 
    SearchOutlined, 
    CalendarOutlined, 
    UserOutlined, 
    ShopOutlined,
    TrophyFilled,
    DollarCircleFilled,
    ClockCircleFilled,
    InfoCircleOutlined,
    WhatsAppOutlined,
    SendOutlined
} from '@ant-design/icons';
import { Customer, Order } from '../../types';
import {
    classifyCustomers,
    ClassifiedCustomer,
    B2C_CATEGORIES,
    B2B_CATEGORIES,
} from '../../utils/customerBehavior';
import { useIsMobile } from '../../hooks/useIsMobile';
import dayjs from 'dayjs';

interface Props {
    customers: Customer[];
    orders: Order[];
}

// ─── Formatter helpers ───────────────────────────────────────────────

const fmt = (n: number) =>
    n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d: dayjs.Dayjs | null) => (d ? d.format('DD MMM YYYY') : '—');

// ─── Badge Renderer ──────────────────────────────────────────────────

const BadgeDisplay = ({ badges }: { badges: ClassifiedCustomer['badges'] }) => (
    <Space size={4} style={{ display: 'flex', flexWrap: 'wrap' }}>
        {badges.isHighValue && (
            <Tooltip title="Alto Valor (Gasto ≥ $900 en 4 meses)">
                <Tag color="gold" icon={<TrophyFilled />} style={{ borderRadius: 4, margin: 0 }}>Valor</Tag>
            </Tooltip>
        )}
        {badges.isHighTicket && (
            <Tooltip title="Ticket Alto (Promedio ≥ $250)">
                <Tag color="green" icon={<DollarCircleFilled />} style={{ borderRadius: 4, margin: 0 }}>Ticket</Tag>
            </Tooltip>
        )}
        {badges.isRecent && (
            <Tooltip title="Reciente (Compra en últimos 30 días)">
                <Tag color="blue" icon={<ClockCircleFilled />} style={{ borderRadius: 4, margin: 0 }}>Reciente</Tag>
            </Tooltip>
        )}
    </Space>
);

// ─── Component ───────────────────────────────────────────────────────

export const CustomerBehaviorBoard = ({ customers, orders }: Props) => {
    const isMobile = useIsMobile();
    const [customerType, setCustomerType] = useState<'B2C' | 'B2B'>('B2C');
    const [searchText, setSearchText] = useState('');
    const [activeB2CTab, setActiveB2CTab] = useState<string>('Super Leal');
    const [activeB2BTab, setActiveB2BTab] = useState<string>('Cuenta Clave');

    // Classification
    const { b2c, b2b } = useMemo(
        () => classifyCustomers(customers, orders),
        [customers, orders],
    );

    const currentList = customerType === 'B2C' ? b2c : b2b;
    const currentCategories = customerType === 'B2C' ? B2C_CATEGORIES : B2B_CATEGORIES;
    const activeTab = customerType === 'B2C' ? activeB2CTab : activeB2BTab;
    
    // WhatsApp feature state
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isWhatsAppModalVisible, setIsWhatsAppModalVisible] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [sendingIndex, setSendingIndex] = useState(0);

    const setActiveTabAndClearSelection = (key: string) => {
        if (customerType === 'B2C') setActiveB2CTab(key);
        else setActiveB2BTab(key);
        setSelectedRowKeys([]);
    };

    const openWhatsAppModal = () => {
        const meta = currentCategories.find(c => c.key === activeTab);
        setWhatsappMessage(meta?.defaultMessage || '¡Hola {{nombre}}!');
        setSendingIndex(0);
        setIsWhatsAppModalVisible(true);
    };

    const handleSendNextWhatsApp = () => {
        if (sendingIndex >= selectedRowKeys.length) return;
        const customerId = selectedRowKeys[sendingIndex];
        const customerObj = filteredForTab.find(c => c.customer.id === customerId)?.customer;
        if (customerObj) {
            const firstName = customerObj.fullName.split(' ')[0] || customerObj.fullName;
            const text = whatsappMessage.replace(/{{nombre}}/g, firstName);
            let cleanPhone = customerObj.phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('044') || cleanPhone.startsWith('045')) {
                cleanPhone = cleanPhone.substring(3);
            }
            const phoneWithCountry = (cleanPhone.startsWith('52') && cleanPhone.length > 10) ? cleanPhone : `52${cleanPhone}`;
            const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        }
        setSendingIndex(prev => prev + 1);
    };

    // Group by category
    const grouped = useMemo(() => {
        const map = new Map<string, ClassifiedCustomer[]>();
        currentCategories.forEach(c => map.set(c.key, []));
        currentList.forEach(c => {
            const list = map.get(c.category) || [];
            list.push(c);
            map.set(c.category, list);
        });
        return map;
    }, [currentList, currentCategories]);

    // Filter by search
    const filteredForTab = useMemo(() => {
        const items = grouped.get(activeTab) || [];
        if (!searchText.trim()) return items;
        const q = searchText.toLowerCase();
        return items.filter(
            c =>
                c.customer.fullName.toLowerCase().includes(q) ||
                c.customer.phone.includes(q),
        );
    }, [grouped, activeTab, searchText]);

    // ─── Summary cards ──────────────────────────────────────

    const SummaryCards = () => (
        <div
            style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 8,
                marginBottom: 16,
                WebkitOverflowScrolling: 'touch',
            }}
        >
            {currentCategories.map(cat => {
                const count = grouped.get(cat.key)?.length || 0;
                const isActive = activeTab === cat.key;
                return (
                    <div
                        key={cat.key}
                        onClick={() => setActiveTabAndClearSelection(cat.key)}
                        style={{
                            minWidth: isMobile ? 120 : 150,
                            flex: isMobile ? '0 0 auto' : 1,
                            background: isActive ? cat.gradient : undefined,
                            border: isActive ? 'none' : '1px solid #f0f0f0',
                            borderRadius: 12,
                            padding: isMobile ? '10px 12px' : '14px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.25s ease',
                            boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                            transform: isActive ? 'translateY(-2px)' : 'none',
                        }}
                    >
                        <div style={{ fontSize: isMobile ? 20 : 24, marginBottom: 4 }}>{cat.emoji}</div>
                        <div
                            style={{
                                fontWeight: 700,
                                fontSize: isMobile ? 11 : 13,
                                color: isActive ? '#fff' : '#595959',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {cat.key}
                        </div>
                        <div
                            style={{
                                fontSize: isMobile ? 22 : 28,
                                fontWeight: 800,
                                color: isActive ? '#fff' : '#262626',
                                lineHeight: 1.1,
                                marginTop: 2,
                            }}
                        >
                            {count}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    // ─── Table columns (desktop) ────────────────────────────

    const columns = [
        {
            title: 'Cliente',
            dataIndex: ['customer', 'fullName'],
            key: 'fullName',
            render: (text: string, record: ClassifiedCustomer) => (
                <div>
                    <strong>{text}</strong>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.customer.phone}</div>
                </div>
            ),
        },
        {
            title: 'Badges',
            key: 'badges',
            width: 200,
            render: (_: unknown, record: ClassifiedCustomer) => <BadgeDisplay badges={record.badges} />,
        },
        {
            title: 'Compras (4m)',
            dataIndex: 'totalOrders',
            key: 'totalOrders',
            sorter: (a: ClassifiedCustomer, b: ClassifiedCustomer) => a.totalOrders - b.totalOrders,
            width: 110,
            align: 'center' as const,
            render: (v: number) => <strong>{v}</strong>,
        },
        {
            title: 'Gasto Total',
            dataIndex: 'totalSpent',
            key: 'totalSpent',
            sorter: (a: ClassifiedCustomer, b: ClassifiedCustomer) => a.totalSpent - b.totalSpent,
            width: 130,
            align: 'right' as const,
            render: (v: number) => <span style={{ fontWeight: 600 }}>{fmt(v)}</span>,
        },
        {
            title: 'Ticket Prom.',
            dataIndex: 'avgTicket',
            key: 'avgTicket',
            width: 120,
            align: 'right' as const,
            render: (v: number) => fmt(v),
        },
        {
            title: 'Última Compra',
            dataIndex: 'lastOrderDate',
            key: 'lastOrderDate',
            width: 140,
            render: (d: dayjs.Dayjs | null) => (
                <span style={{ color: '#8c8c8c', fontSize: 13 }}>{fmtDate(d)}</span>
            ),
        },
    ];

    // ─── Mobile card ────────────────────────────────────────

    const handleSelectRow = (id: string, checked: boolean) => {
        setSelectedRowKeys(prev =>
            checked ? [...prev, id] : prev.filter(k => k !== id)
        );
    };

    const MobileCustomerCard = ({ item }: { item: ClassifiedCustomer }) => {
        const catMeta = currentCategories.find(c => c.key === item.category)!;
        const isSelected = selectedRowKeys.includes(item.customer.id);
        
        return (
            <div
                style={{
                    background: isSelected ? '#e6f4ff' : '#fff',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 10,
                    border: `1px solid ${isSelected ? '#1677ff' : '#f0f0f0'}`,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                onClick={() => handleSelectRow(item.customer.id, !isSelected)}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <Checkbox 
                            checked={isSelected} 
                            onClick={e => e.stopPropagation()} 
                            onChange={e => handleSelectRow(item.customer.id, e.target.checked)}
                            style={{ marginTop: 2 }}
                        />
                        <div>
                            <strong style={{ fontSize: 15, display: 'block' }}>{item.customer.fullName}</strong>
                            <span style={{ color: '#8c8c8c', fontSize: 12 }}>📱 {item.customer.phone}</span>
                        </div>
                    </div>
                    <Tag color={catMeta.color} style={{ margin: 0, fontSize: 11 }}>
                        {catMeta.emoji} {catMeta.key}
                    </Tag>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <BadgeDisplay badges={item.badges} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 13, background: '#fafafa', padding: 8, borderRadius: 8 }}>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Pedidos: </span>
                        <strong>{item.totalOrders}</strong>
                    </div>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Total: </span>
                        <strong>{fmt(item.totalSpent)}</strong>
                    </div>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Ticket: </span>
                        <strong>{fmt(item.avgTicket)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#bfbfbf', fontSize: 11 }}>{fmtDate(item.lastOrderDate)}</span>
                    </div>
                </div>
            </div>
        );
    };

    // ─── Tab items ──────────────────────────────────────────

    const tabItems = currentCategories.map(cat => {
        const count = grouped.get(cat.key)?.length || 0;
        return {
            key: cat.key,
            label: (
                <span>
                    {cat.emoji} {!isMobile && cat.key}{' '}
                    <Badge
                        count={count}
                        style={{
                            backgroundColor: count > 0 ? undefined : '#d9d9d9',
                            marginLeft: 4,
                            fontSize: 11,
                        }}
                        overflowCount={999}
                        size="small"
                    />
                </span>
            ),
        };
    });

    // ─── Render ──────────────────────────────────────────────

    return (
        <div>
            {/* Top Selector: B2C vs B2B */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
                <Segmented
                    value={customerType}
                    onChange={v => setCustomerType(v as 'B2C' | 'B2B')}
                    options={[
                        { label: 'Clientes Finales (B2C)', value: 'B2C', icon: <UserOutlined /> },
                        { label: 'Negocios (B2B)', value: 'B2B', icon: <ShopOutlined /> },
                    ]}
                    block={isMobile}
                    size="large"
                    style={{ padding: 4, borderRadius: 12 }}
                />
            </div>

            {/* Analysis period and stats */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    marginBottom: 16,
                    gap: 8,
                }}
            >
                <div style={{ fontSize: 14, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined />
                    Análisis: <strong style={{ color: '#595959' }}>Últimos 4 meses</strong>
                    <Tooltip title="Basado en pedidos Entregados. B2C y B2B tienen reglas distintas.">
                        <InfoCircleOutlined style={{ fontSize: 12 }} />
                    </Tooltip>
                </div>
                <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                    Mostrando <strong>{currentList.length}</strong> {customerType === 'B2C' ? 'clientes B2C' : 'negocios B2B'}
                </div>
            </div>

            {/* Summary cards */}
            <SummaryCards />

            {/* Tabs + content */}
            <Card
                size="small"
                styles={{ body: { padding: isMobile ? '8px 0' : '12px 16px' } }}
                style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none' }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={k => setActiveTabAndClearSelection(k)}
                    items={tabItems}
                    size={isMobile ? 'small' : 'middle'}
                    style={{ marginBottom: 0 }}
                />

                {/* Category description */}
                {(() => {
                    const meta = currentCategories.find(c => c.key === activeTab);
                    return meta ? (
                        <div
                            style={{
                                padding: isMobile ? '8px 12px' : '10px 0',
                                fontSize: 12,
                                color: '#8c8c8c',
                                marginBottom: 8,
                                background: isMobile ? '#fdfdfd' : 'transparent',
                                borderLeft: `3px solid ${meta.color}`,
                                paddingLeft: 12,
                                margin: isMobile ? '0 12px 12px' : '0 0 12px',
                            }}
                        >
                            <strong>Criterio:</strong> {meta.description}
                        </div>
                    ) : null;
                })()}

                {/* Search & Actions */}
                <div style={{ padding: isMobile ? '0 12px 12px' : '0 0 16px', display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between' }}>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por nombre o teléfono…"
                        allowClear
                        size="large"
                        style={{ width: isMobile ? '100%' : 350, borderRadius: 10, flexShrink: 0 }}
                        onChange={e => setSearchText(e.target.value)}
                        value={searchText}
                    />
                    
                    {selectedRowKeys.length > 0 && (
                        <Button 
                            type="primary" 
                            size="large"
                            icon={<WhatsAppOutlined />}
                            style={{ backgroundColor: '#25D366', borderRadius: 10 }}
                            onClick={openWhatsAppModal}
                        >
                            Enviar a {selectedRowKeys.length} seleccionados
                        </Button>
                    )}
                </div>

                {/* Content */}
                {filteredForTab.length === 0 ? (
                    <Empty
                        description="No hay clientes en esta categoría"
                        style={{ padding: 48 }}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                ) : isMobile ? (
                    <div style={{ padding: '0 12px 12px', maxHeight: '60vh', overflowY: 'auto' }}>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                            <Checkbox 
                                indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < filteredForTab.length}
                                checked={selectedRowKeys.length === filteredForTab.length && filteredForTab.length > 0}
                                onChange={e => {
                                    if (e.target.checked) setSelectedRowKeys(filteredForTab.map(c => c.customer.id));
                                    else setSelectedRowKeys([]);
                                }}
                            >
                                Seleccionar Todos
                            </Checkbox>
                        </div>
                        {filteredForTab.map(item => (
                            <MobileCustomerCard key={item.customer.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <Table
                        rowSelection={{
                            selectedRowKeys,
                            onChange: (keys) => setSelectedRowKeys(keys)
                        }}
                        dataSource={filteredForTab}
                        columns={columns}
                        rowKey={r => r.customer.id}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        size="middle"
                        style={{ fontSize: 13 }}
                    />
                )}
            </Card>

            {/* WhatsApp Send Modal */}
            <Modal
                title={
                    <span>
                        <WhatsAppOutlined style={{ color: '#25D366', marginRight: 8 }} />
                        Enviar Mensaje ({sendingIndex}/{selectedRowKeys.length})
                    </span>
                }
                open={isWhatsAppModalVisible}
                onCancel={() => setIsWhatsAppModalVisible(false)}
                footer={null}
                destroyOnClose
            >
                <div style={{ marginBottom: 16 }}>
                    <Typography.Text type="secondary">
                        Revisa el mensaje. Puedes usar <Tag>{"{{nombre}}"}</Tag> para personalizarlo.
                        El navegador no permite abrir múltiples pestañas, por lo que deberás hacer clic en "Enviar y Continuar" por cada cliente.
                    </Typography.Text>
                </div>
                
                <Input.TextArea
                    rows={6}
                    value={whatsappMessage}
                    onChange={e => setWhatsappMessage(e.target.value)}
                    style={{ marginBottom: 20 }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography.Text strong>
                        {sendingIndex < selectedRowKeys.length ? (
                            <>
                                Siguiente: {filteredForTab.find(c => c.customer.id === selectedRowKeys[sendingIndex])?.customer.fullName}
                            </>
                        ) : (
                            <span style={{ color: '#52c41a' }}>¡Todos los mensajes enviados!</span>
                        )}
                    </Typography.Text>
                    
                    {sendingIndex < selectedRowKeys.length ? (
                        <Button 
                            type="primary" 
                            icon={<SendOutlined />}
                            onClick={handleSendNextWhatsApp}
                        >
                            Enviar y Continuar
                        </Button>
                    ) : (
                        <Button onClick={() => {
                            setIsWhatsAppModalVisible(false);
                            setSelectedRowKeys([]);
                        }}>
                            Terminar
                        </Button>
                    )}
                </div>
            </Modal>
        </div>
    );
};
