import { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Space } from 'antd';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <Result
                    status="error"
                    title="Algo salió mal"
                    subTitle="Ha ocurrido un error inesperado. Puedes reintentar o recargar la aplicación."
                    extra={
                        <Space>
                            <Button onClick={this.handleReset}>Reintentar</Button>
                            <Button type="primary" onClick={this.handleReload}>
                                Recargar aplicación
                            </Button>
                        </Space>
                    }
                />
            );
        }
        return this.props.children;
    }
}
