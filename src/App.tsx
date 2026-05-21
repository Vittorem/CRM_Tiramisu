import { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import esES from 'antd/locale/es_ES';
import { AuthGate } from './components/auth/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';

import { SettingsPage } from './features/settings/SettingsPage';
import { CustomerList } from './features/customers/CustomerList';
import { OrdersPage } from './features/orders/OrdersPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { RecetarioPage } from './features/recetario/RecetarioPage';
import { BehaviorPage } from './features/behavior/BehaviorPage';


const queryClient = new QueryClient();

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

    const toggleDarkMode = () => {
        const nextMode = !isDarkMode;
        setIsDarkMode(nextMode);
        localStorage.setItem('crm_theme', nextMode ? 'dark' : 'light');
    };

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.style.setProperty('--color-cream', '#1a0f12');
            document.documentElement.style.setProperty('--color-espresso', '#f3e8eb');
            document.body.style.backgroundColor = '#1a0f12';
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.style.setProperty('--color-cream', '#fff5f6');
            document.documentElement.style.setProperty('--color-espresso', '#3f2b2f');
            document.body.style.backgroundColor = '#fff5f6';
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
            <ConfigProvider
                locale={esES}
                theme={{
                    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                    token: {
                        colorPrimary: '#db2777', // Vibrant Wildberry Rose - elegant general pastry palette
                        colorInfo: '#db2777',
                        borderRadius: 12, // Softer curves for premium feel
                        fontFamily: '"Outfit", system-ui, Avenir, Helvetica, Arial, sans-serif',
                        controlHeight: 40,
                        controlHeightLG: 48,
                        fontSize: 14, // Standard CRM font size for better density
                        boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)', // Soft diffuse shadows
                        colorBgBase: isDarkMode ? '#1a0f12' : '#fff5f6', // Sweet vanilla light cream / elegant plum dark
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
                }}
            >
                <QueryClientProvider client={queryClient}>
                    <ErrorBoundary>
                        <AuthGate>
                            <BrowserRouter>
                                <Routes>
                                    <Route path="/" element={<AppLayout />}>
                                        <Route index element={<DashboardPage />} />
                                        <Route path="customers" element={<CustomerList />} />
                                        <Route path="orders" element={<OrdersPage />} />

                                        <Route path="reports" element={<ReportsPage />} />
                                        <Route path="behavior" element={<BehaviorPage />} />
                                        <Route path="inventory" element={<InventoryPage />} />
                                        <Route path="recetario" element={<RecetarioPage />} />
                                        <Route path="settings" element={<SettingsPage />} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Route>
                                </Routes>
                            </BrowserRouter>
                        </AuthGate>
                    </ErrorBoundary>
                </QueryClientProvider>
            </ConfigProvider>
        </ThemeContext.Provider>
    );
}

export default App;
