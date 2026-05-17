import { useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Statistic, DatePicker, Divider, Button, Drawer, List, Result, Segmented } from 'antd';
import {
    DollarOutlined,
    ShoppingCartOutlined,
    UserOutlined,
    RiseOutlined,
    FallOutlined,
    ExclamationCircleOutlined,
    TrophyOutlined,
    CarOutlined,
    CrownOutlined,
} from '@ant-design/icons';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useFirestoreSubscription } from '../../hooks/useFirestore';
import { Order, Customer, Recipe, Ingredient } from '../../types';
import { getOrderDate, getDeliveredOrdersInRange } from '../../utils/dateHelpers';
import { computeDemographics, getInactiveCustomers } from '../../utils/demographicsHelpers';
import { calculateOrderEstimatedCost } from '../../utils/costHelpers';
import {
    computeCustomerRFMScores,
    aggregateRFMSegments,
    formatRFMForChart,
    type RFMSegmentResult
} from '../../utils/rfmAnalysis';

// Removed unused IntelligentAlerts because they are now in Top App Bar
import { useIsMobile } from '../../hooks/useIsMobile';

const { RangePicker } = DatePicker;
const { Title } = Typography;
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// ─── Small sub-components ────────────────────────────────────────────────────

function KPICard(props: { title: string; value: string | number; prefix?: React.ReactNode; suffix?: React.ReactNode; color?: string }) {
    return (
        <Card bordered={false} style={{ borderTop: `3px solid ${props.color || '#1890ff'}`, borderRadius: 12 }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic 
                title={<span style={{ fontSize: 13, color: '#8c8c8c' }}>{props.title}</span>} 
                value={props.value} 
                prefix={props.prefix} 
                suffix={props.suffix} 
                valueStyle={{ fontSize: 20, fontWeight: 700 }}
            />
        </Card>
    );
}

interface CustomizedDotProps {
    cx?: number;
    cy?: number;
    value?: number;
}

function CustomizedDot({ cx = 0, cy = 0, value = 0 }: CustomizedDotProps) {
    const color = value > 0 ? '#52c41a' : '#ff4d4f';
    return <circle cx={cx} cy={cy} r={4} stroke={color} strokeWidth={2} fill={color} />;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const DashboardPage = () => {
    const isMobile = useIsMobile();

    const { data: orders } = useFirestoreSubscription<Order>('orders');
    const { data: customers } = useFirestoreSubscription<Customer>('customers');
    const { data: recipes } = useFirestoreSubscription<Recipe>('recipes');
    const { data: ingredients } = useFirestoreSubscription<Ingredient>('ingredients');

    const [segment, setSegment] = useState<'Todos' | 'B2C' | 'B2B'>('Todos');

    const filteredCustomers = useMemo(() => {
        if (segment === 'Todos') return customers;
        return customers.filter(c => c.type === segment);
    }, [customers, segment]);

    const filteredOrders = useMemo(() => {
        if (segment === 'Todos') return orders;
        const validCustomerIds = new Set(filteredCustomers.map(c => c.id));
        return orders.filter(o => o.customerId && validCustomerIds.has(o.customerId));
    }, [orders, filteredCustomers, segment]);

    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);
    const [inactiveModalOpen, setInactiveModalOpen] = useState(false);

    // ─── Derived data ─────────────────────────────────────────────────

    const deliveredOrders = useMemo(
        () => getDeliveredOrdersInRange(filteredOrders, dateRange[0], dateRange[1]),
        [filteredOrders, dateRange]
    );

    const metrics = useMemo(() => {
        const totalSales = deliveredOrders.reduce((acc, o) => acc + (o.total || 0), 0);
        
        // Calculate costs
        const totalOperationalCosts = deliveredOrders.reduce((acc, o) => {
            const estimatedCost = calculateOrderEstimatedCost(o, recipes, ingredients);
            return acc + estimatedCost;
        }, 0);
        
        const netProfit = totalSales - totalOperationalCosts;
        const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
        
        const totalShippingRevenue = deliveredOrders.reduce((acc, o) => {
            if (o.deliveryMethod === 'Envío' && o.shippingCost) {
                return acc + Number(o.shippingCost);
            }
            return acc;
        }, 0);
        
        const totalOrders = deliveredOrders.length;
        const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
        const uniqueCustomers = new Set(deliveredOrders.map(o => o.customerId)).size;

        // Top Customer
        const customerStats: Record<string, { name: string; qty: number; revenue: number }> = {};
        deliveredOrders.forEach(o => {
            if (!o.customerId) return;
            if (!customerStats[o.customerId]) {
                const cName = customers.find(c => c.id === o.customerId)?.fullName || o.customerName || 'Cliente';
                customerStats[o.customerId] = { name: cName, qty: 0, revenue: 0 };
            }
            customerStats[o.customerId].qty += 1;
            customerStats[o.customerId].revenue += o.total || 0;
        });
        const sortedCustomers = Object.values(customerStats).sort((a, b) => {
            if (b.qty !== a.qty) return b.qty - a.qty;
            return b.revenue - a.revenue;
        });
        const topCustomer = sortedCustomers.length > 0 ? sortedCustomers[0] : null;

        // Product ranking
        const productCount: Record<string, { qty: number; revenue: number }> = {};
        deliveredOrders.forEach(o => {
            if (o.items && o.items.length > 0) {
                o.items.forEach(item => {
                    const key = item.productNameAtSale || 'Sin Producto';
                    if (!productCount[key]) productCount[key] = { qty: 0, revenue: 0 };
                    productCount[key].qty += item.quantity || 1;
                    productCount[key].revenue += item.subtotal || 0;
                });
            } else {
                const key = o.productNameAtSale || 'Sin Producto';
                if (!productCount[key]) productCount[key] = { qty: 0, revenue: 0 };
                productCount[key].qty += o.quantity || 1;
                productCount[key].revenue += o.total || 0;
            }
        });
        const topProducts = Object.entries(productCount)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.qty - a.qty);

        // Daily trend
        const dailyMap: Record<string, number> = {};
        deliveredOrders.forEach(o => {
            const date = getOrderDate(o);
            if (date) {
                const key = date.format('DD/MM');
                dailyMap[key] = (dailyMap[key] || 0) + o.total;
            }
        });

        const dailyTrend = Object.entries(dailyMap)
            .map(([date, ventas]) => ({ date, ventas }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { 
            totalSales, 
            totalOperationalCosts,
            netProfit,
            profitMargin,
            totalShippingRevenue,
            totalOrders, 
            avgTicket, 
            uniqueCustomers, 
            topCustomer,
            topProducts, 
            dailyTrend 
        };
    }, [deliveredOrders, recipes, ingredients, customers]);

    const demographics = useMemo(
        () => computeDemographics(filteredCustomers, deliveredOrders),
        [filteredCustomers, deliveredOrders]
    );

    const inactiveCustomers = useMemo(
        () => getInactiveCustomers(filteredCustomers, filteredOrders, dateRange[1]),
        [filteredCustomers, filteredOrders, dateRange]
    );

    // ─── RFM Analysis ──────────────────────────────────────────────────

    const rfmScores = useMemo(
        () => computeCustomerRFMScores(customers, orders, dateRange[1]),
        [customers, orders, dateRange]
    );

    const rfmSegments = useMemo(
        () => aggregateRFMSegments(rfmScores),
        [rfmScores]
    );

    const rfmChartData = useMemo(
        () => formatRFMForChart(rfmSegments),
        [rfmSegments]
    );

    // ─── Alerts moved to Global Component ────────────────────────────

    // ─── Insights ─────────────────────────────────────────────────────

    const insights = useMemo(() => {
        const items: string[] = [];
        if (metrics.avgTicket > 0) items.push(`🎯 Ticket promedio: $${metrics.avgTicket.toFixed(0)}`);
        if (metrics.topProducts.length > 0) items.push(`🏆 Producto estrella: ${metrics.topProducts[0].name}`);
        if (inactiveCustomers.length > 0) items.push(`⚠️ ${inactiveCustomers.length} cliente(s) sin compra en 30 días`);
        if (demographics.genderData.length > 0) {
            const top = [...demographics.genderData].sort((a, b) => b.value - a.value)[0];
            items.push(`👥 Mayoría de compradores: ${top.name}`);
        }
        return items;
    }, [metrics, inactiveCustomers, demographics]);

    // ─── Tab Components ────────────────────────────────────────────────

    const rfmTabContent = (
        <Row gutter={[16, 16]}>
            <Col xs={24} md={10}>
                <Card title="Distribución de Segmentos" size="small">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={rfmChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label
                            >
                                {rfmChartData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </Col>
            <Col xs={24} md={14}>
                <Card title="Detalle por Segmento" size="small">
                    <List
                        dataSource={rfmSegments}
                        renderItem={(segment: RFMSegmentResult) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={`${segment.segment} (${segment.count} clientes)`}
                                    description={`Revenue: $${segment.totalRevenue.toFixed(2)} • Ticket Promedio: $${segment.avgOrderValue.toFixed(2)}`}
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            </Col>
        </Row>
    );

    // ─── Alerts Tab Removed ──────────────────────────────────────────

    // ─── Render ───────────────────────────────────────────────────────

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 24 }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>Dashboard</Title>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, width: isMobile ? '100%' : 'auto' }}>
                    <Segmented
                        options={['Todos', 'B2C', 'B2B']}
                        value={segment}
                        onChange={(value) => setSegment(value as any)}
                        style={{ width: isMobile ? '100%' : 'auto' }}
                    />
                    <RangePicker
                        style={{ width: isMobile ? '100%' : 'auto' }}
                        value={dateRange}
                        onChange={(vals) => {
                            if (vals?.[0] && vals?.[1]) setDateRange([vals[0], vals[1]]);
                        }}
                        format="DD/MM/YYYY"
                    />
                </div>
            </div>

            {/* KPIs */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Ventas Totales" value={`$${metrics.totalSales.toFixed(2)}`} prefix={<DollarOutlined />} color="#52c41a" />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Costo Operativo" value={`$${metrics.totalOperationalCosts.toFixed(2)}`} prefix={<FallOutlined />} color="#ff4d4f" />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Ganancia Neta" value={`$${metrics.netProfit.toFixed(2)}`} prefix={<RiseOutlined />} color="#faad14" />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Margen Beneficio" value={`${metrics.profitMargin.toFixed(1)}%`} prefix={<TrophyOutlined />} color={metrics.profitMargin >= 30 ? "#52c41a" : "#faad14"} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Ingresos por Envíos" value={`$${metrics.totalShippingRevenue.toFixed(2)}`} prefix={<CarOutlined />} color="#00C49F" />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Pedidos" value={metrics.totalOrders} prefix={<ShoppingCartOutlined />} color="#1890ff" />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Clientes Únicos" value={metrics.uniqueCustomers} prefix={<UserOutlined />} color="#722ed1" />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Mejor Cliente" 
                        value={metrics.topCustomer ? metrics.topCustomer.name.split(' ')[0] : 'N/A'} 
                        suffix={metrics.topCustomer ? `(${metrics.topCustomer.qty} ped.)` : ''} 
                        prefix={<CrownOutlined />} 
                        color="#eb2f96" 
                    />
                </Col>
            </Row>

            {/* Charts Row */}
            <Divider />
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card title="Tendencia de Ventas" size="small">
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={metrics.dailyTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="ventas" stroke="#1890ff" dot={<CustomizedDot />} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title={`Productos (${metrics.topProducts.length})`} size="small">
                        <ResponsiveContainer width="100%" height={Math.max(200, metrics.topProducts.length * 50)}>
                            <BarChart data={metrics.topProducts} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip formatter={(value: number | undefined) => [`${value} unidades`, 'Vendidos']} />
                                <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                                    {metrics.topProducts.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Demographics Row */}
            <Divider />
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <Card title="Género de Compradores" size="small">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={demographics.genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {demographics.genderData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card title="Rango de Edad" size="small">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={demographics.ageData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card title="Top Ocupaciones" size="small">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={demographics.topOccupations} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={80} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Insights */}
            <Divider />
            <Card title="✨ Insights" size="small">
                {insights.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {insights.map((insight, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>{insight}</li>
                        ))}
                    </ul>
                ) : (
                    <Result
                        icon={<ExclamationCircleOutlined />}
                        title="Sin datos suficientes"
                        subTitle="Registra pedidos entregados para ver insights."
                    />
                )}
                {inactiveCustomers.length > 0 && (
                    <Button type="link" icon={<FallOutlined />} onClick={() => setInactiveModalOpen(true)}>
                        Ver {inactiveCustomers.length} cliente(s) inactivos
                    </Button>
                )}
            </Card>

            {/* Análisis de Comportamiento RFM */}
            <Divider />
            <Card title="📊 Análisis de Comportamiento (RFM)" size="small" style={{ marginBottom: 16 }}>
                {rfmTabContent}
            </Card>

            {/* Inactive customers modal */}
            <Drawer
                title="Clientes Inactivos (30+ días sin compra)"
                placement={isMobile ? 'bottom' : 'right'}
                width={isMobile ? '100%' : 400}
                height={isMobile ? '80vh' : '100%'}
                open={inactiveModalOpen}
                onClose={() => setInactiveModalOpen(false)}
            >
                <List
                    dataSource={inactiveCustomers}
                    renderItem={c => (
                        <List.Item>
                            <List.Item.Meta title={c.fullName} description={c.phone} />
                            <div style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: 13 }}>30+ días inactivo</div>
                        </List.Item>
                    )}
                />
            </Drawer>
        </div>
    );
};
