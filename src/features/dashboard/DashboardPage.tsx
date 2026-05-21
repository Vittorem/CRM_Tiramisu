import { useMemo, useState } from 'react';
import { Row, Col, Card, Typography, DatePicker, Divider, Segmented, theme } from 'antd';
import { useTheme } from '../../App';
import {
    DollarOutlined,
    ShoppingCartOutlined,
    UserOutlined,
    RiseOutlined,
    FallOutlined,
    TrophyOutlined,
    CarOutlined,
    CrownOutlined,
} from '@ant-design/icons';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    Cell, BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useFirestoreSubscription } from '../../hooks/useFirestore';
import { Order, Customer, Recipe, Ingredient } from '../../types';
import { getOrderDate, getDeliveredOrdersInRange } from '../../utils/dateHelpers';
import { calculateOrderEstimatedCost } from '../../utils/costHelpers';

// Removed unused IntelligentAlerts because they are now in Top App Bar
import { useIsMobile } from '../../hooks/useIsMobile';

const { RangePicker } = DatePicker;
const { Title } = Typography;
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// ─── Small sub-components ────────────────────────────────────────────────────

function KPICard(props: { title: string; value: string | number; prefix?: React.ReactNode; suffix?: React.ReactNode; color?: string; isDarkMode?: boolean }) {
    const isDark = props.isDarkMode;
    return (
        <Card 
            bordered={false} 
            style={{ 
                borderRadius: 16, 
                background: isDark 
                    ? 'linear-gradient(135deg, rgba(38, 22, 26, 0.9) 0%, rgba(20, 10, 12, 0.9) 100%)' 
                    : 'linear-gradient(135deg, #ffffff 0%, #fffcfc 100%)',
                boxShadow: isDark
                    ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                    : '0 8px 32px 0 rgba(219, 39, 119, 0.04)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(219, 39, 119, 0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                overflow: 'hidden',
                position: 'relative'
            }} 
            styles={{ body: { padding: '20px 24px' } }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: 12, color: isDark ? '#b3a1a5' : '#8c7a7e', display: 'block', marginBottom: 6, fontWeight: 600, letterSpacing: '0.5px' }}>
                        {props.title.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: isDark ? '#fff' : '#3f2b2f', letterSpacing: '-0.5px' }}>
                        {props.value} {props.suffix && <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#8c7a7e' : '#b3a1a5' }}>{props.suffix}</span>}
                    </span>
                </div>
                <div style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 12, 
                    background: props.color ? `${props.color}15` : '#db277715', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: props.color || '#db2777',
                    fontSize: 22
                }}>
                    {props.prefix}
                </div>
            </div>
            <div style={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: props.color || '#db2777',
                opacity: 0.02,
                bottom: -30,
                right: -30,
                filter: 'blur(20px)'
            }} />
        </Card>
    );
}

interface CustomizedDotProps {
    cx?: number;
    cy?: number;
    value?: number;
}

function CustomizedDot({ cx = 0, cy = 0, value = 0 }: CustomizedDotProps) {
    const color = value > 0 ? '#10b981' : '#ef4444';
    return <circle cx={cx} cy={cy} r={4} stroke={color} strokeWidth={2} fill={color} />;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const DashboardPage = () => {
    const isMobile = useIsMobile();
    const { isDarkMode } = useTheme();
    const { token: { colorBgContainer, colorBorderSecondary, colorTextSecondary, colorText } } = theme.useToken();

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



    // ─── Tab Components ────────────────────────────────────────────────


    // ─── Alerts Tab Removed ──────────────────────────────────────────

    // ─── Render ───────────────────────────────────────────────────────

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 28 }}>
                <div>
                    <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Dashboard</Title>
                    <span style={{ color: colorTextSecondary, fontSize: 13 }}>Resumen general de tu CRM de Repostería</span>
                </div>
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
                    <KPICard title="Ventas Totales" value={`$${metrics.totalSales.toFixed(2)}`} prefix={<DollarOutlined />} color="#10b981" isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Costo Operativo" value={`$${metrics.totalOperationalCosts.toFixed(2)}`} prefix={<FallOutlined />} color="#ef4444" isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Ganancia Neta" value={`$${metrics.netProfit.toFixed(2)}`} prefix={<RiseOutlined />} color="#f59e0b" isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Margen Beneficio" value={`${metrics.profitMargin.toFixed(1)}%`} prefix={<TrophyOutlined />} color={metrics.profitMargin >= 30 ? "#10b981" : "#f59e0b"} isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Ingresos por Envíos" value={`$${metrics.totalShippingRevenue.toFixed(2)}`} prefix={<CarOutlined />} color="#06b6d4" isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Pedidos" value={metrics.totalOrders} prefix={<ShoppingCartOutlined />} color="#3b82f6" isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard title="Clientes Únicos" value={metrics.uniqueCustomers} prefix={<UserOutlined />} color="#8b5cf6" isDarkMode={isDarkMode} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Mejor Cliente" 
                        value={metrics.topCustomer ? metrics.topCustomer.name.split(' ')[0] : 'N/A'} 
                        suffix={metrics.topCustomer ? `(${metrics.topCustomer.qty} ped.)` : ''} 
                        prefix={<CrownOutlined />} 
                        color="#ec4899" 
                        isDarkMode={isDarkMode}
                    />
                </Col>
            </Row>

            {/* Charts Row */}
            <Divider />
            <Row gutter={[24, 24]}>
                <Col xs={24}>
                    <Card 
                        title={<span style={{ fontWeight: 700 }}>🏆 Top Productos Vendidos</span>} 
                        size="default" 
                        style={{ 
                            borderRadius: 16, 
                            borderTop: '4px solid #ec4899',
                            boxShadow: isDarkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.2)' : '0 8px 32px 0 rgba(0,0,0,0.02)',
                            background: colorBgContainer
                        }}
                    >
                        <ResponsiveContainer width="100%" height={Math.max(350, metrics.topProducts.length * 50)}>
                            <BarChart data={metrics.topProducts} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSecondary} />
                                <XAxis type="number" tick={{ fill: colorTextSecondary }} />
                                <YAxis dataKey="name" type="category" width={150} fontSize={13} fontWeight={500} tick={{ fill: colorTextSecondary }} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: colorBgContainer, borderColor: colorBorderSecondary, color: colorText, borderRadius: 8 }} 
                                    formatter={(value: number | undefined) => [`${value} unidades`, 'Vendidos']} 
                                />
                                <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                                    {metrics.topProducts.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24}>
                    <Card 
                        title={<span style={{ fontWeight: 700 }}>📈 Tendencia de Ventas</span>} 
                        size="small" 
                        style={{ 
                            borderRadius: 16, 
                            borderTop: '4px solid #3b82f6',
                            boxShadow: isDarkMode ? '0 8px 32px 0 rgba(0, 0, 0, 0.2)' : '0 8px 32px 0 rgba(0,0,0,0.02)',
                            background: colorBgContainer
                        }}
                    >
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={metrics.dailyTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSecondary} />
                                <XAxis dataKey="date" tick={{ fill: colorTextSecondary }} />
                                <YAxis tick={{ fill: colorTextSecondary }} />
                                <Tooltip contentStyle={{ backgroundColor: colorBgContainer, borderColor: colorBorderSecondary, color: colorText, borderRadius: 8 }} />
                                <Legend wrapperStyle={{ color: colorText }} />
                                <Line type="monotone" dataKey="ventas" stroke="#3b82f6" dot={<CustomizedDot />} strokeWidth={3} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};
