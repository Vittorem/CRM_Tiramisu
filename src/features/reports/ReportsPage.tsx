import { useState, useMemo } from 'react';
import { Card, DatePicker, Space, Button, Divider, Typography, message, Empty, Row, Col, Statistic, Progress, Tag, theme } from 'antd';
import {
    FileExcelOutlined,
    FilePdfOutlined,
    FileTextOutlined,
    TeamOutlined,
    DollarOutlined,
    ShoppingCartOutlined,
    UserOutlined,
    ManOutlined,
    WomanOutlined,
    DownloadOutlined,
    PieChartOutlined,
} from '@ant-design/icons';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useFirestoreSubscription } from '../../hooks/useFirestore';
import { Order, Customer, Recipe, Ingredient } from '../../types';
import { getDeliveredOrdersInRange } from '../../utils/dateHelpers';
import { computeDemographics } from '../../utils/demographicsHelpers';
import {
    exportOrdersExcel,
    exportOrdersPDF,
    exportCustomersXML,
    exportDemographicsPDF,
    exportDemographicsXML,
} from '../../services/exportService';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export const ReportsPage = () => {
    const { token: { colorBgContainer, colorBorderSecondary, colorTextSecondary, colorText } } = theme.useToken();
    const { data: orders } = useFirestoreSubscription<Order>('orders');
    const { data: customers } = useFirestoreSubscription<Customer>('customers');
    const { data: recipes } = useFirestoreSubscription<Recipe>('recipes');
    const { data: ingredients } = useFirestoreSubscription<Ingredient>('ingredients');

    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);

    const filteredOrders = useMemo(
        () => getDeliveredOrdersInRange(orders, dateRange[0], dateRange[1]),
        [orders, dateRange]
    );

    const demographics = useMemo(
        () => computeDemographics(customers, filteredOrders),
        [customers, filteredOrders]
    );

    const totalSales = filteredOrders.reduce((a, o) => a + (o.total || 0), 0);
    const avgTicket = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;

    // ─── Handlers ─────────────────────────────────────────────────────

    const handleExcelExport = () => {
        exportOrdersExcel(filteredOrders, customers, recipes, ingredients);
        message.success('Archivo Excel generado');
    };

    const handlePdfExport = () => {
        exportOrdersPDF(filteredOrders, dateRange, recipes, ingredients);
        message.success('PDF generado');
    };

    const handleCustomerXML = () => {
        exportCustomersXML(customers);
        message.success('XML de clientes generado');
    };

    const handleDemoPDF = () => {
        exportDemographicsPDF(demographics, dateRange);
        message.success('PDF de demografía generado');
    };

    const handleDemoXML = () => {
        exportDemographicsXML(demographics, dateRange);
        message.success('XML de demografía generado');
    };

    // Compute gender percentages for visual display
    const totalGender = demographics.genderData.reduce((a, d) => a + d.value, 0);
    const getGenderPercent = (name: string) => {
        const item = demographics.genderData.find(d => d.name === name);
        return item && totalGender > 0 ? Math.round((item.value / totalGender) * 100) : 0;
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>📊 Reportes</Title>
                    <Text type="secondary">Analiza rendimiento y exporta datos del periodo seleccionado</Text>
                </div>
                <RangePicker
                    value={dateRange}
                    onChange={(vals) => {
                        if (vals?.[0] && vals?.[1]) setDateRange([vals[0], vals[1]]);
                    }}
                    format="DD/MM/YYYY"
                    style={{ borderRadius: 8 }}
                />
            </div>

            {/* KPI Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card
                        bordered={false}
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: 12,
                            color: 'white',
                        }}
                    >
                        <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>Venta Total</span>}
                            value={totalSales}
                            precision={2}
                            prefix={<DollarOutlined />}
                            valueStyle={{ color: 'white', fontWeight: 700, fontSize: 28 }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card
                        bordered={false}
                        style={{
                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                            borderRadius: 12,
                        }}
                    >
                        <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>Pedidos Entregados</span>}
                            value={filteredOrders.length}
                            prefix={<ShoppingCartOutlined />}
                            valueStyle={{ color: 'white', fontWeight: 700, fontSize: 28 }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card
                        bordered={false}
                        style={{
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            borderRadius: 12,
                        }}
                    >
                        <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>Ticket Promedio</span>}
                            value={avgTicket}
                            precision={2}
                            prefix="$"
                            valueStyle={{ color: 'white', fontWeight: 700, fontSize: 28 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Export Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card
                        title={<><DownloadOutlined /> Exportar Ventas</>}
                        bordered={false}
                        style={{ borderRadius: 12, height: '100%' }}
                        styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12 } }}
                    >
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={handleExcelExport}
                            type="primary"
                            block
                            size="large"
                            style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, height: 48 }}
                        >
                            Excel — Pedidos + Clientes
                        </Button>
                        <Button
                            icon={<FilePdfOutlined />}
                            onClick={handlePdfExport}
                            block
                            size="large"
                            danger
                            style={{ borderRadius: 8, height: 48 }}
                        >
                            PDF — Corte de Caja
                        </Button>
                        <Button
                            icon={<FileTextOutlined />}
                            onClick={handleCustomerXML}
                            block
                            size="large"
                            style={{ borderRadius: 8, height: 48 }}
                        >
                            XML — Base de Clientes
                        </Button>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card
                        title={<><TeamOutlined /> Exportar Demografía</>}
                        bordered={false}
                        style={{ borderRadius: 12, height: '100%' }}
                        styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12 } }}
                    >
                        <Button
                            icon={<FilePdfOutlined />}
                            onClick={handleDemoPDF}
                            block
                            size="large"
                            danger
                            style={{ borderRadius: 8, height: 48 }}
                        >
                            PDF — Reporte Demográfico
                        </Button>
                        <Button
                            icon={<FileTextOutlined />}
                            onClick={handleDemoXML}
                            block
                            size="large"
                            style={{ borderRadius: 8, height: 48 }}
                        >
                            XML — Datos Demográficos
                        </Button>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
                            <Space direction="vertical" align="center">
                                <UserOutlined style={{ fontSize: 28, color: '#d9d9d9' }} />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {demographics.totalActive} cliente(s) activos en periodo
                                </Text>
                            </Space>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Demographics Visual Section */}
            <Divider orientation="left"><PieChartOutlined /> Resumen Demográfico</Divider>

            {demographics.totalActive > 0 ? (
                <Row gutter={[16, 16]}>
                    {/* Gender Pie Chart */}
                    <Col xs={24} md={8}>
                        <Card
                            title="Distribución por Género"
                            bordered={false}
                            style={{ borderRadius: 12, textAlign: 'center' }}
                        >
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={demographics.genderData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={3}
                                    >
                                        {demographics.genderData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: colorBgContainer, borderColor: colorBorderSecondary, color: colorText, borderRadius: 8 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <Space size="large" style={{ marginTop: 8 }}>
                                <div>
                                    <WomanOutlined style={{ color: '#ec4899', fontSize: 18 }} />
                                    <div style={{ fontWeight: 600 }}>{getGenderPercent('Femenino')}%</div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Femenino</Text>
                                </div>
                                <div>
                                    <ManOutlined style={{ color: '#6366f1', fontSize: 18 }} />
                                    <div style={{ fontWeight: 600 }}>{getGenderPercent('Masculino')}%</div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Masculino</Text>
                                </div>
                                <div>
                                    <UserOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
                                    <div style={{ fontWeight: 600 }}>{getGenderPercent('Otro/ND')}%</div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Otro/ND</Text>
                                </div>
                            </Space>
                        </Card>
                    </Col>

                    {/* Age Bar Chart */}
                    <Col xs={24} md={8}>
                        <Card
                            title="Distribución por Edad"
                            bordered={false}
                            style={{ borderRadius: 12 }}
                        >
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={demographics.ageData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={colorBorderSecondary} />
                                    <XAxis dataKey="name" tick={{ fill: colorTextSecondary, fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fill: colorTextSecondary }} />
                                    <Tooltip contentStyle={{ backgroundColor: colorBgContainer, borderColor: colorBorderSecondary, color: colorText, borderRadius: 8 }} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                        {demographics.ageData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Clientes agrupados por rango de edad
                                </Text>
                            </div>
                        </Card>
                    </Col>

                    {/* Top Occupations */}
                    <Col xs={24} md={8}>
                        <Card
                            title="Top Ocupaciones"
                            bordered={false}
                            style={{ borderRadius: 12 }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 200, justifyContent: 'center' }}>
                                {demographics.topOccupations.map((occ, i) => {
                                    const maxVal = demographics.topOccupations[0]?.value || 1;
                                    const percent = Math.round((occ.value / maxVal) * 100);
                                    return (
                                        <div key={occ.name}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ fontSize: 13 }}>{occ.name}</Text>
                                                <Tag color={COLORS[i % COLORS.length]} style={{ margin: 0 }}>{occ.value}</Tag>
                                            </div>
                                            <Progress percent={percent} showInfo={false} strokeColor={COLORS[i % COLORS.length]} size="small" />
                                        </div>
                                    );
                                })}
                                {demographics.topOccupations.length === 0 && (
                                    <Text type="secondary" style={{ textAlign: 'center' }}>Sin datos de ocupación</Text>
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            ) : (
                <Card bordered={false} style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
                    <Empty
                        description={
                            <span>
                                Sin datos demográficos para <strong>{dateRange[0].format('DD/MM/YYYY')}</strong> — <strong>{dateRange[1].format('DD/MM/YYYY')}</strong>
                            </span>
                        }
                    />
                </Card>
            )}
        </div>
    );
};
