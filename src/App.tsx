import { createContext, useContext, useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, theme } from 'antd';
import esES from 'antd/locale/es_ES';
import { AuthGate } from './components/auth/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { LicenseProvider } from './contexts/LicenseContext';

// Route-level code splitting
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const CustomerList = lazy(() => import('./features/customers/CustomerList').then(m => ({ default: m.CustomerList })));
const OrdersPage = lazy(() => import('./features/orders/OrdersPage').then(m => ({ default: m.OrdersPage })));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const RecetarioPage = lazy(() => import('./features/recetario/RecetarioPage').then(m => ({ default: m.RecetarioPage })));
const BehaviorPage = lazy(() => import('./features/behavior/BehaviorPage').then(m => ({ default: m.BehaviorPage })));
const RoadmapPage = lazy(() => import('./features/roadmap/RoadmapPage').then(m => ({ default: m.RoadmapPage })));
const B2BDeliveriesPage = lazy(() => import('./features/b2b-deliveries/B2BDeliveriesPage').then(m => ({ default: m.B2BDeliveriesPage })));
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(m => ({ default: m.AdminPage })));

const PageLoader = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280, width: '100%' }}>
        <Spin size="large" />
    </div>
);

const ThemeContext = createContext({
    isDarkMode: false,
    toggleDarkMode: () => { },
});
export const useTheme = () => useContext(ThemeContext);

function App() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('crm_theme');
        return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const toggleDarkMode = useCallback(() => {
        setIsDarkMode(prev => {
            const nextMode = !prev;
            localStorage.setItem('crm_theme', nextMode ? 'dark' : 'light');
            return nextMode;
        });
    }, []);

    useEffect(() => {
        const bgColor = isDarkMode ? '#1a0f12' : '#fff5f6';
        const fgColor = isDarkMode ? '#f3e8eb' : '#3f2b2f';

        document.documentElement.style.setProperty('--color-cream', bgColor);
        document.documentElement.style.setProperty('--color-espresso', fgColor);
        document.body.style.backgroundColor = bgColor;
        document.documentElement.classList.toggle('dark', isDarkMode);

        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
            themeMeta.setAttribute('content', bgColor);
        }
    }, [isDarkMode]);

    const themeContextValue = useMemo(
        () => ({ isDarkMode, toggleDarkMode }),
        [isDarkMode, toggleDarkMode]
    );

    const antdThemeConfig = useMemo(() => ({
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
            colorPrimary: '#db2777',
            colorInfo: '#db2777',
            borderRadius: 12,
            fontFamily: '"Outfit", system-ui, Avenir, Helvetica, Arial, sans-serif',
            controlHeight: 40,
            controlHeightLG: 48,
            fontSize: 14,
            boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
            colorBgBase: isDarkMode ? '#1a0f12' : '#fff5f6',
        },
        components: {
            Card: {
                colorBgContainer: isDarkMode ? '#26161a' : '#ffffff',
            },
            Layout: {
                bodyBg: isDarkMode ? '#1a0f12' : '#fff5f6',
                headerBg: isDarkMode ? '#26161a' : '#ffffff',
            }
        }
    }), [isDarkMode]);

    return (
        <ThemeContext.Provider value={themeContextValue}>
            <ConfigProvider locale={esES} theme={antdThemeConfig}>
                <ErrorBoundary>
                    <AuthGate>
                        <LicenseProvider>
                            <BrowserRouter>
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
                                        <Route path="/" element={<AppLayout />}>
                                            <Route index element={<DashboardPage />} />
                                            <Route path="customers" element={<CustomerList />} />
                                            <Route path="orders" element={<OrdersPage />} />
                                            <Route path="b2b-deliveries" element={<B2BDeliveriesPage />} />
                                            <Route path="reports" element={<ReportsPage />} />
                                            <Route path="behavior" element={<BehaviorPage />} />
                                            <Route path="inventory" element={<InventoryPage />} />
                                            <Route path="recetario" element={<RecetarioPage />} />
                                            <Route path="roadmap" element={<RoadmapPage />} />
                                            <Route path="settings" element={<SettingsPage />} />
                                            <Route path="admin" element={<AdminPage />} />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Route>
                                    </Routes>
                                </Suspense>
                            </BrowserRouter>
                        </LicenseProvider>
                    </AuthGate>
                </ErrorBoundary>
            </ConfigProvider>
        </ThemeContext.Provider>
    );
}

export default App;
