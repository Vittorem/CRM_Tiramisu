import { useState, useMemo } from 'react';
import { Card, Tabs, Table, Tag, Input, Empty, Badge, Tooltip } from 'antd';
import { SearchOutlined, CalendarOutlined } from '@ant-design/icons';
import { Customer, Order } from '../../types';
import {
    classifyCustomers,
    ClassifiedCustomer,
    BEHAVIOR_CATEGORIES,
    BehaviorCategory,
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

const monthLabel = (d: dayjs.Dayjs) =>
    d.format('MMM YYYY').replace(/^./, s => s.toUpperCase());

// ─── Component ───────────────────────────────────────────────────────

export const CustomerBehaviorBoard = ({ customers, orders }: Props) => {
    const isMobile = useIsMobile();
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState<BehaviorCategory>('Super Leal');

    // Classification
    const { classified, period } = useMemo(
        () => classifyCustomers(customers, orders),
        [customers, orders],
    );

    const periodLabel = `${monthLabel(period.start)} – ${monthLabel(period.end.subtract(1, 'day'))}`;

    // Group by category
    const grouped = useMemo(() => {
        const map = new Map<BehaviorCategory, ClassifiedCustomer[]>();
        BEHAVIOR_CATEGORIES.forEach(c => map.set(c.key, []));
        classified.forEach(c => map.get(c.category)!.push(c));
        return map;
    }, [classified]);

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

    const totalClassified = classified.length;

    const SummaryCards = () => (
        <div
            style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 4,
                marginBottom: 16,
                WebkitOverflowScrolling: 'touch',
            }}
        >
            {BEHAVIOR_CATEGORIES.map(cat => {
                const count = grouped.get(cat.key)?.length || 0;
                const pct = totalClassified > 0 ? Math.round((count / totalClassified) * 100) : 0;
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
                        <div
                            style={{
                                fontSize: 11,
                                color: isActive ? 'rgba(255,255,255,0.85)' : '#8c8c8c',
                                marginTop: 2,
                            }}
                        >
                            {pct}% del total
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
            title: 'Compras',
            dataIndex: 'totalOrders',
            key: 'totalOrders',
            sorter: (a: ClassifiedCustomer, b: ClassifiedCustomer) => a.totalOrders - b.totalOrders,
            width: 100,
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
            title: 'Prom. Mensual',
            dataIndex: 'avgSpentPerMonth',
            key: 'avgSpentPerMonth',
            width: 130,
            align: 'right' as const,
            render: (v: number) => fmt(v),
        },
        {
            title: 'Meses Activos',
            dataIndex: 'monthsWithOrders',
            key: 'monthsWithOrders',
            width: 120,
            align: 'center' as const,
            render: (v: number) => (
                <Tooltip title={`${v} de 4 meses con al menos 1 compra`}>
                    <span>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <span
                                key={i}
                                style={{
                                    display: 'inline-block',
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: i < v ? '#52c41a' : '#f0f0f0',
                                    marginRight: 3,
                                }}
                            />
                        ))}
                    </span>
                </Tooltip>
            ),
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
        const catMeta = BEHAVIOR_CATEGORIES.find(c => c.key === item.category)!;
        return (
            <div
                style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 8,
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
            >
                {/* Row 1: name + badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 15 }}>{item.customer.fullName}</strong>
                    <Tag color={catMeta.color} style={{ margin: 0, fontSize: 11 }}>
                        {catMeta.emoji} {catMeta.key}
                    </Tag>
                </div>

                {/* Row 2: phone */}
                <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 8 }}>📱 {item.customer.phone}</div>

                {/* Row 3: metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 13 }}>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Compras: </span>
                        <strong>{item.totalOrders}</strong>
                    </div>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Gasto: </span>
                        <strong>{fmt(item.totalSpent)}</strong>
                    </div>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Prom/mes: </span>
                        <strong>{fmt(item.avgSpentPerMonth)}</strong>
                    </div>
                    <div>
                        <span style={{ color: '#8c8c8c' }}>Meses: </span>
                        <strong>{item.monthsWithOrders}/4</strong>
                    </div>
                </div>

                {/* Row 4: last order */}
                <div style={{ fontSize: 12, color: '#bfbfbf', marginTop: 6, textAlign: 'right' }}>
                    Última compra: {fmtDate(item.lastOrderDate)}
                </div>
            </div>
        );
    };

    // ─── Tab items ──────────────────────────────────────────

    const tabItems = BEHAVIOR_CATEGORIES.map(cat => {
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
            {/* Period indicator */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 16,
                    fontSize: isMobile ? 13 : 14,
                    color: '#8c8c8c',
                }}
            >
                <CalendarOutlined />
                Periodo de análisis: <strong style={{ color: '#595959' }}>{periodLabel}</strong>
                <span style={{ marginLeft: 4 }}>
                    — <strong>{totalClassified}</strong> clientes con compras
                </span>
            </div>

            {/* Summary cards */}
            <SummaryCards />

            {/* Tabs + content */}
            <Card
                size="small"
                styles={{ body: { padding: isMobile ? '8px 0' : '12px 16px' } }}
                style={{ borderRadius: 12 }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={k => setActiveTab(k as BehaviorCategory)}
                    items={tabItems}
                    size={isMobile ? 'small' : 'middle'}
                    style={{ marginBottom: 0 }}
                />

                {/* Category description */}
                {(() => {
                    const meta = BEHAVIOR_CATEGORIES.find(c => c.key === activeTab);
                    return meta ? (
                        <div
                            style={{
                                padding: isMobile ? '6px 12px' : '6px 0',
                                fontSize: 12,
                                color: '#8c8c8c',
                                marginBottom: 8,
                            }}
                        >
                            {meta.description}
                        </div>
                    ) : null;
                })()}

                {/* Search */}
                <div style={{ padding: isMobile ? '0 12px 8px' : '0 0 12px', }}>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por nombre o teléfono…"
                        allowClear
                        style={{ width: isMobile ? '100%' : 300, borderRadius: 8 }}
                        onChange={e => setSearchText(e.target.value)}
                        value={searchText}
                    />
                </div>

                {/* Content */}
                {filteredForTab.length === 0 ? (
                    <Empty
                        description="No hay clientes en esta categoría"
                        style={{ padding: 32 }}
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
                        pagination={false}
                        size="small"
                        scroll={{ y: 500 }}
                        style={{ fontSize: 13 }}
                    />
                )}
            </Card>
        </div>
    );
};
