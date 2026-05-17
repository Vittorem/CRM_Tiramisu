import { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, theme, Drawer, List } from 'antd';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
    UserOutlined,
    ShoppingOutlined,
    AppstoreOutlined,
    BarChartOutlined,
    InboxOutlined,
    SettingOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    MoreOutlined,
    SunOutlined,
    MoonOutlined,
    PlusOutlined,
    BookOutlined,
    SendOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth/AuthGate';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTheme } from '../../App';
import { GlobalAlerts } from './GlobalAlerts';

const { Header, Sider, Content } = Layout;

export const AppLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();


    const isMobile = useIsMobile();
    const { isDarkMode, toggleDarkMode } = useTheme();

    const {
        token: { colorBgContainer, borderRadiusLG, colorBorderSecondary, colorPrimary },
    } = theme.useToken();

    const menuItems = [
        { key: '/', icon: <AppstoreOutlined />, label: 'Dashboard' },
        { key: '/customers', icon: <UserOutlined />, label: 'Clientes' },
        { key: '/orders', icon: <ShoppingOutlined />, label: 'Pedidos' },
        { key: '/b2b-deliveries', icon: <SendOutlined />, label: 'Entregas B2B' },
        { key: '/inventory', icon: <InboxOutlined />, label: 'Inventario' },
        { key: '/recetario', icon: <BookOutlined />, label: 'Recetario' },
        { key: '/reports', icon: <BarChartOutlined />, label: 'Reportes' },
        { key: '/settings', icon: <SettingOutlined />, label: 'Configuración' },
    ];

    const mobileTabItems = [
        menuItems.find(i => i.key === '/'), // Dashboard
        menuItems.find(i => i.key === '/orders'), // Pedidos
        menuItems.find(i => i.key === '/customers'), // Clientes
    ].filter(Boolean) as any[];

    const userMenu = {
        items: [
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Cerrar Sesión',
                onClick: logout,
            },
        ],
    };

    return (
        <Layout style={{ minHeight: '100vh', paddingBottom: isMobile ? 65 : 0, overflowX: 'hidden' }}>
            {!isMobile && (
                <Sider 
                    trigger={null} 
                    collapsible 
                    collapsed={collapsed} 
                    breakpoint="xl" 
                    onBreakpoint={(broken) => {
                        if (broken) setCollapsed(true);
                    }}
                    width={200}
                    collapsedWidth={80}
                    style={{ 
                        overflow: 'auto', 
                        height: '100vh', 
                        position: 'fixed', 
                        left: 0, 
                        top: 0, 
                        bottom: 0, 
                        zIndex: 100 
                    }}
                >
                    <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: collapsed ? 10 : 14 }}>
                        {collapsed ? 'CRM' : 'REPOSTERÍA'}
                    </div>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={[location.pathname]}
                        items={menuItems}
                        onClick={({ key }) => navigate(key)}
                    />
                </Sider>
            )}

            <Layout style={{ 
                marginLeft: isMobile ? 0 : (collapsed ? 80 : 200), 
                transition: 'margin-left 0.2s', 
                minHeight: '100vh',
                width: '100%' 
            }}>
                <Header style={{ 
                    padding: isMobile ? '0 12px' : '0 24px', 
                    background: colorBgContainer, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    boxShadow: '0 1px 4px rgba(0,21,41,0.08)', 
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 10 
                }}>
                    {isMobile ? (
                        <div style={{ fontWeight: 800, fontSize: 18, color: colorPrimary }}>CRM Repostería</div>
                    ) : (
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ fontSize: '16px', width: 64, height: 64 }}
                        />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
                        <GlobalAlerts />
                        <Button type="text" onClick={toggleDarkMode} icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />} />
                        <span style={{ fontWeight: 500, display: isMobile ? 'none' : 'inline', color: isDarkMode ? '#e6e6e6' : 'inherit', fontSize: 14 }}>{user?.displayName}</span>
                        <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
                            <Avatar src={user?.photoURL} icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
                        </Dropdown>
                    </div>
                </Header>

                <Content
                    style={{
                        margin: isMobile ? '12px' : '16px',
                        padding: isMobile ? 12 : 20,
                        minHeight: 280,
                        background: colorBgContainer,
                        borderRadius: borderRadiusLG,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>

            {/* Bottom Navigation Bar for Mobile */}
            {isMobile && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: colorBgContainer, borderTop: `1px solid ${colorBorderSecondary}`, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '8px 0 6px 0', zIndex: 1000, boxShadow: '0 -2px 8px rgba(0,0,0,0.05)' }}>
                    {mobileTabItems.slice(0, 2).map(item => (
                        <div key={item.key} onClick={() => navigate(item.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: location.pathname === item.key ? colorPrimary : '#8c8c8c', width: '20%', cursor: 'pointer', height: 44 }}>
                            <div style={{ fontSize: 22, height: 26, display: 'flex', alignItems: 'center' }}>{item.icon}</div>
                            <div style={{ fontSize: 10, marginTop: 2, fontWeight: location.pathname === item.key ? 600 : 400 }}>{item.label}</div>
                        </div>
                    ))}

                    {/* FAB (Floating Action Button): Create New Order */}
                    <div style={{ width: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', height: 44 }}>
                        <div
                            onClick={() => navigate('/orders', { state: { createNew: true } })}
                            style={{
                                position: 'absolute',
                                top: -24,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: colorPrimary,
                                color: 'white',
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(212, 163, 115, 0.4)',
                                cursor: 'pointer',
                                fontSize: 24,
                                border: `4px solid ${colorBgContainer}`,
                                zIndex: 10
                            }}
                        >
                            <PlusOutlined />
                        </div>
                    </div>

                    {mobileTabItems.slice(2, 3).map(item => (
                        <div key={item.key} onClick={() => navigate(item.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: location.pathname === item.key ? colorPrimary : '#8c8c8c', width: '20%', cursor: 'pointer', height: 44 }}>
                            <div style={{ fontSize: 22, height: 26, display: 'flex', alignItems: 'center' }}>{item.icon}</div>
                            <div style={{ fontSize: 10, marginTop: 2, fontWeight: location.pathname === item.key ? 600 : 400 }}>{item.label}</div>
                        </div>
                    ))}

                    <div onClick={() => setMobileMenuOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#8c8c8c', width: '20%', cursor: 'pointer', height: 44 }}>
                        <div style={{ fontSize: 24, height: 26, display: 'flex', alignItems: 'center' }}><MoreOutlined /></div>
                        <div style={{ fontSize: 10, marginTop: 2 }}>Más</div>
                    </div>
                </div>
            )}

            {/* "More" Menu Drawer for Mobile */}
            <Drawer
                title="Menú Principal"
                placement="bottom"
                onClose={() => setMobileMenuOpen(false)}
                open={mobileMenuOpen}
                height="auto"
                styles={{ body: { padding: 0 } }}
            >
                <List
                    dataSource={menuItems}
                    renderItem={item => (
                        <List.Item
                            onClick={() => { navigate(item.key); setMobileMenuOpen(false); }}
                            style={{ padding: '16px 24px', cursor: 'pointer', background: location.pathname === item.key ? '#e6f4ff' : 'transparent' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: location.pathname === item.key ? '#1677ff' : 'inherit', fontWeight: location.pathname === item.key ? 600 : 400 }}>
                                <div style={{ fontSize: 20 }}>{item.icon}</div>
                                <div style={{ fontSize: 16 }}>{item.label}</div>
                            </div>
                        </List.Item>
                    )}
                />
            </Drawer>
        </Layout>
    );
};
