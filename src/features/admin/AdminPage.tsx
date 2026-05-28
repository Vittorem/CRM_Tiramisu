import { useState, useEffect, useMemo } from 'react';
import {
    Typography,
    Card,
    Table,
    Button,
    Tag,
    Space,
    Input,
    message,
    Row,
    Col,
    Popconfirm,
    theme,
    Select,
    Tooltip,
    Statistic,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    CrownOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    ReloadOutlined,
    UserOutlined,
    WarningOutlined,
    StopOutlined,
    CalendarOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../components/auth/AuthGate';
import { useLicense } from '../../contexts/LicenseContext';
import { useTheme } from '../../App';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
    License,
    fetchAllLicenses,
    authorizeLicense,
    revokeLicense,
} from '../../services/licenseService';
import { PlanType, PLAN_LABELS } from '../../lib/adminConstants';

const { Title, Text } = Typography;

// ─── Row type ─────────────────────────────────────────────────────────────────

interface LicenseRow extends License {
    uid: string;
    statusTag: 'active' | 'expired' | 'inactive';
    daysRemaining: number | null;
}

function computeRow(raw: License & { uid: string }): LicenseRow {
    const now = new Date();
    let statusTag: LicenseRow['statusTag'] = 'inactive';
    let daysRemaining: number | null = null;

    if (raw.isAuthorized) {
        if (raw.expiresAt) {
            const expiry = (raw.expiresAt as Timestamp).toDate();
            if (expiry > now) {
                statusTag = 'active';
                daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            } else {
                statusTag = 'expired';
            }
        } else {
            // unlimited
            statusTag = 'active';
        }
    }

    return { ...raw, statusTag, daysRemaining };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminPage = () => {
    const { user } = useAuth();
    const { isAdmin } = useLicense();
    const { isDarkMode } = useTheme();
    const isMobile = useIsMobile();
    const {
        token: { colorPrimary },
    } = theme.useToken();

    const [licenses, setLicenses] = useState<LicenseRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // ── Fetch licenses ───────────────────────────────────────────────────
    const loadLicenses = async () => {
        setLoading(true);
        try {
            const raw = await fetchAllLicenses();
            setLicenses(raw.map(computeRow));
        } catch (err) {
            console.error('Error fetching licenses:', err);
            message.error('Error al cargar las licencias.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) loadLicenses();
    }, [isAdmin]);

    // ── Filtered data ────────────────────────────────────────────────────
    const filteredData = useMemo(() => {
        let data = licenses;
        if (search) {
            const term = search.toLowerCase();
            data = data.filter(
                (l) =>
                    l.email.toLowerCase().includes(term) ||
                    l.displayName.toLowerCase().includes(term),
            );
        }
        if (statusFilter !== 'all') {
            data = data.filter((l) => l.statusTag === statusFilter);
        }
        return data;
    }, [licenses, search, statusFilter]);

    // ── Stats ────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = licenses.length;
        const active = licenses.filter((l) => l.statusTag === 'active').length;
        const expired = licenses.filter((l) => l.statusTag === 'expired').length;
        const expiringSoon = licenses.filter(
            (l) => l.statusTag === 'active' && l.daysRemaining !== null && l.daysRemaining <= 7,
        ).length;
        return { total, active, expired, expiringSoon };
    }, [licenses]);

    // ── Actions ──────────────────────────────────────────────────────────
    const handleAuthorize = async (uid: string, planType: PlanType) => {
        setActionLoading(uid);
        try {
            await authorizeLicense(uid, planType, user.uid);
            message.success(`Licencia habilitada (${PLAN_LABELS[planType]})`);
            await loadLicenses();
        } catch (err) {
            console.error(err);
            message.error('Error al autorizar.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevoke = async (uid: string) => {
        setActionLoading(uid);
        try {
            await revokeLicense(uid);
            message.success('Licencia revocada.');
            await loadLicenses();
        } catch (err) {
            console.error(err);
            message.error('Error al revocar.');
        } finally {
            setActionLoading(null);
        }
    };

    // ── Guard ────────────────────────────────────────────────────────────
    if (!isAdmin) {
        return (
            <div style={{ textAlign: 'center', padding: 80 }}>
                <StopOutlined style={{ fontSize: 48, color: '#ef4444' }} />
                <Title level={4} style={{ marginTop: 16 }}>
                    Acceso denegado
                </Title>
                <Text type="secondary">
                    Esta sección es exclusiva para el administrador del sistema.
                </Text>
            </div>
        );
    }

    // ── Status tag renderer ──────────────────────────────────────────────
    const renderStatus = (row: LicenseRow) => {
        switch (row.statusTag) {
            case 'active':
                return (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                        Activo
                        {row.daysRemaining !== null ? ` (${row.daysRemaining}d)` : ' (∞)'}
                    </Tag>
                );
            case 'expired':
                return (
                    <Tag icon={<ClockCircleOutlined />} color="error">
                        Expirado
                    </Tag>
                );
            default:
                return (
                    <Tag icon={<CloseCircleOutlined />} color="default">
                        Sin activar
                    </Tag>
                );
        }
    };

    // ── Table columns ────────────────────────────────────────────────────
    const columns: ColumnsType<LicenseRow> = [
        {
            title: 'Usuario',
            key: 'user',
            width: isMobile ? 180 : 280,
            render: (_, row) => (
                <div>
                    <Text strong style={{ fontSize: 14, display: 'block' }}>
                        {row.displayName || '—'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {row.email}
                    </Text>
                </div>
            ),
            sorter: (a, b) => a.email.localeCompare(b.email),
        },
        {
            title: 'Estado',
            key: 'status',
            width: 160,
            render: (_, row) => renderStatus(row),
            filters: [
                { text: 'Activo', value: 'active' },
                { text: 'Expirado', value: 'expired' },
                { text: 'Sin activar', value: 'inactive' },
            ],
            onFilter: (value, row) => row.statusTag === value,
        },
        {
            title: 'Plan',
            dataIndex: 'planType',
            key: 'plan',
            width: 120,
            render: (plan: PlanType | null) =>
                plan ? (
                    <Tag color="purple">{PLAN_LABELS[plan]}</Tag>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
        {
            title: 'Activado',
            key: 'authorizedAt',
            width: 130,
            responsive: ['lg'],
            render: (_, row) => {
                if (!row.authorizedAt) return <Text type="secondary">—</Text>;
                const date = (row.authorizedAt as Timestamp).toDate();
                return (
                    <Text style={{ fontSize: 13 }}>
                        {date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                );
            },
        },
        {
            title: 'Expira',
            key: 'expiresAt',
            width: 130,
            responsive: ['lg'],
            render: (_, row) => {
                if (!row.expiresAt) {
                    return row.isAuthorized ? (
                        <Tag color="blue">Indefinido</Tag>
                    ) : (
                        <Text type="secondary">—</Text>
                    );
                }
                const date = (row.expiresAt as Timestamp).toDate();
                const isExpired = date <= new Date();
                return (
                    <Text style={{ fontSize: 13, color: isExpired ? '#ef4444' : undefined }}>
                        {date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                );
            },
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: isMobile ? 120 : 300,
            fixed: 'right' as const,
            render: (_, row) => {
                const isLoading = actionLoading === row.uid;
                return (
                    <Space wrap size={4}>
                        <Tooltip title="Habilitar 30 días">
                            <Button
                                size="small"
                                type={row.statusTag === 'active' && row.planType === '30d' ? 'primary' : 'default'}
                                icon={<CalendarOutlined />}
                                loading={isLoading}
                                onClick={() => handleAuthorize(row.uid, '30d')}
                            >
                                {!isMobile && '30d'}
                            </Button>
                        </Tooltip>
                        <Tooltip title="Habilitar 1 año">
                            <Button
                                size="small"
                                type={row.statusTag === 'active' && row.planType === '1y' ? 'primary' : 'default'}
                                icon={<CalendarOutlined />}
                                loading={isLoading}
                                onClick={() => handleAuthorize(row.uid, '1y')}
                            >
                                {!isMobile && '1 Año'}
                            </Button>
                        </Tooltip>
                        <Tooltip title="Habilitar indefinido">
                            <Button
                                size="small"
                                type={row.statusTag === 'active' && row.planType === 'unlimited' ? 'primary' : 'default'}
                                icon={<ThunderboltOutlined />}
                                loading={isLoading}
                                onClick={() => handleAuthorize(row.uid, 'unlimited')}
                            >
                                {!isMobile && '∞'}
                            </Button>
                        </Tooltip>
                        {row.isAuthorized && (
                            <Popconfirm
                                title="¿Revocar acceso?"
                                description="El usuario perderá acceso a las funciones del CRM."
                                onConfirm={() => handleRevoke(row.uid)}
                                okText="Revocar"
                                cancelText="Cancelar"
                                okButtonProps={{ danger: true }}
                            >
                                <Button
                                    size="small"
                                    danger
                                    icon={<StopOutlined />}
                                    loading={isLoading}
                                >
                                    {!isMobile && 'Revocar'}
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: 16,
                    marginBottom: 24,
                }}
            >
                <div>
                    <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
                        <CrownOutlined style={{ marginRight: 8, color: colorPrimary }} />
                        Panel de Administración
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Gestiona las licencias y suscripciones de los usuarios del CRM
                    </Text>
                </div>
                <Button icon={<ReloadOutlined />} onClick={loadLicenses} loading={loading}>
                    Actualizar
                </Button>
            </div>

            {/* Stats cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            background: isDarkMode
                                ? 'linear-gradient(135deg, rgba(38, 22, 26, 0.9) 0%, rgba(20, 10, 12, 0.9) 100%)'
                                : 'linear-gradient(135deg, #ffffff 0%, #fffcfc 100%)',
                            boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(219, 39, 119, 0.05)',
                        }}
                        styles={{ body: { padding: '16px 20px' } }}
                    >
                        <Statistic
                            title={<span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL USUARIOS</span>}
                            value={stats.total}
                            prefix={<UserOutlined style={{ color: '#8b5cf6' }} />}
                            valueStyle={{ fontSize: 28, fontWeight: 800 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            background: isDarkMode
                                ? 'linear-gradient(135deg, rgba(38, 22, 26, 0.9) 0%, rgba(20, 10, 12, 0.9) 100%)'
                                : 'linear-gradient(135deg, #ffffff 0%, #fffcfc 100%)',
                            boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(219, 39, 119, 0.05)',
                        }}
                        styles={{ body: { padding: '16px 20px' } }}
                    >
                        <Statistic
                            title={<span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>ACTIVOS</span>}
                            value={stats.active}
                            prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                            valueStyle={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            background: isDarkMode
                                ? 'linear-gradient(135deg, rgba(38, 22, 26, 0.9) 0%, rgba(20, 10, 12, 0.9) 100%)'
                                : 'linear-gradient(135deg, #ffffff 0%, #fffcfc 100%)',
                            boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(219, 39, 119, 0.05)',
                        }}
                        styles={{ body: { padding: '16px 20px' } }}
                    >
                        <Statistic
                            title={<span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>EXPIRADOS</span>}
                            value={stats.expired}
                            prefix={<ClockCircleOutlined style={{ color: '#ef4444' }} />}
                            valueStyle={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            background: isDarkMode
                                ? 'linear-gradient(135deg, rgba(38, 22, 26, 0.9) 0%, rgba(20, 10, 12, 0.9) 100%)'
                                : 'linear-gradient(135deg, #ffffff 0%, #fffcfc 100%)',
                            boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(219, 39, 119, 0.05)',
                        }}
                        styles={{ body: { padding: '16px 20px' } }}
                    >
                        <Statistic
                            title={<span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>POR EXPIRAR</span>}
                            value={stats.expiringSoon}
                            prefix={<WarningOutlined style={{ color: '#f59e0b' }} />}
                            valueStyle={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    marginBottom: 16,
                    boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '16px 20px' } }}
            >
                <Space wrap size={12} style={{ width: '100%' }}>
                    <Input
                        placeholder="Buscar por email o nombre..."
                        prefix={<SearchOutlined />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: isMobile ? '100%' : 280, borderRadius: 8 }}
                        allowClear
                    />
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: 160 }}
                        options={[
                            { value: 'all', label: 'Todos los estados' },
                            { value: 'active', label: 'Activos' },
                            { value: 'expired', label: 'Expirados' },
                            { value: 'inactive', label: 'Sin activar' },
                        ]}
                    />
                </Space>
            </Card>

            {/* Table */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: isDarkMode ? '0 4px 16px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.03)',
                    overflow: 'hidden',
                }}
                styles={{ body: { padding: 0 } }}
            >
                <Table<LicenseRow>
                    dataSource={filteredData}
                    columns={columns}
                    rowKey="uid"
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 900 }}
                    size="middle"
                    locale={{
                        emptyText: 'No hay licencias registradas aún.',
                    }}
                />
            </Card>
        </div>
    );
};
