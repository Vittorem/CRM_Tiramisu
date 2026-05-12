import { useState, useMemo } from 'react';
import { Card, Tabs, Table, Tag, Input, Empty, Badge, Tooltip, Segmented, Space } from 'antd';
import { 
    SearchOutlined, 
    CalendarOutlined, 
    UserOutlined, 
    ShopOutlined,
    TrophyFilled,
    DollarCircleFilled,
    ClockCircleFilled,
    InfoCircleOutlined
} from '@ant-design/icons';
import { Customer, Order } from '../../types';
import {
    classifyCustomers,
    ClassifiedCustomer,
    B2C_CATEGORIES,
    B2B_CATEGORIES,
    CategoryMeta,
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
    const setActiveTab = customerType === 'B2C' ? setActiveB2CTab : setActiveB2BTab;

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
                        onClick={() => setActiveTab(cat.key)}
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

    const MobileCustomerCard = ({ item }: { item: ClassifiedCustomer }) => {
        const catMeta = currentCategories.find(c => c.key === item.category)!;
        return (
            <div
                style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 10,
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                        <strong style={{ fontSize: 15, display: 'block' }}>{item.customer.fullName}</strong>
                        <span style={{ color: '#8c8c8c', fontSize: 12 }}>📱 {item.customer.phone}</span>
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
                    onChange={k => setActiveTab(k)}
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

                {/* Search */}
                <div style={{ padding: isMobile ? '0 12px 12px' : '0 0 16px', }}>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por nombre o teléfono…"
                        allowClear
                        size="large"
                        style={{ width: isMobile ? '100%' : 350, borderRadius: 10 }}
                        onChange={e => setSearchText(e.target.value)}
                        value={searchText}
                    />
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
                        {filteredForTab.map(item => (
                            <MobileCustomerCard key={item.customer.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <Table
                        dataSource={filteredForTab}
                        columns={columns}
                        rowKey={r => r.customer.id}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        size="middle"
                        style={{ fontSize: 13 }}
                    />
                )}
            </Card>
        </div>
    );
};
