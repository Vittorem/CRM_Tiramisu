import { Button, Tooltip, Popconfirm } from 'antd';
import { WhatsAppOutlined, PhoneOutlined, CheckCircleFilled, ClockCircleFilled, EnvironmentOutlined, StopOutlined } from '@ant-design/icons';
import { B2BDeliverySchedule } from '../../../types';

interface B2BBusinessCardProps {
    schedule: B2BDeliverySchedule;
    hasOrder: boolean;
    isPast: boolean;
    isDismissed?: boolean;
    onClick: () => void;
    onDismiss?: () => void;
}

export const B2BBusinessCard = ({ schedule, hasOrder, isPast, isDismissed, onClick, onDismiss }: B2BBusinessCardProps) => {
    const primaryContact = schedule.contacts?.find(c => c.isPrimary) || schedule.contacts?.[0];

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (primaryContact?.phone) {
            const phone = primaryContact.phone.replace(/\D/g, '');
            window.open(`https://wa.me/52${phone}`, '_blank', 'noopener,noreferrer');
        }
    };

    let borderColor = '#faad14'; // orange - pending
    let bgColor = '#fffbe6';
    let statusIcon = <ClockCircleFilled style={{ color: '#faad14', fontSize: 14 }} />;
    let statusText = 'Sin pedido';

    if (hasOrder) {
        borderColor = '#52c41a';
        bgColor = '#f6ffed';
        statusIcon = <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />;
        statusText = 'Pedido creado';
    } else if (isDismissed) {
        borderColor = '#d9d9d9';
        bgColor = '#f5f5f5';
        statusIcon = <StopOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />;
        statusText = 'Omitido';
    } else if (isPast) {
        borderColor = '#d9d9d9';
        bgColor = '#fafafa';
        statusIcon = <ClockCircleFilled style={{ color: '#bfbfbf', fontSize: 14 }} />;
        statusText = 'Sin pedido (pasado)';
    }

    return (
        <div
            onClick={onClick}
            style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 8px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
            }}
        >
            {/* Header: Name + Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {schedule.customerName}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!hasOrder && !isDismissed && onDismiss && (
                        <Popconfirm
                            title="¿Omitir pedido?"
                            description="Se quitará la alerta para esta semana"
                            onConfirm={(e) => {
                                e?.stopPropagation();
                                onDismiss();
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                        >
                            <Button
                                type="text"
                                size="small"
                                icon={<StopOutlined />}
                                style={{ color: '#bfbfbf', padding: '0 4px' }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </Popconfirm>
                    )}
                    <Tooltip title={statusText}>
                        {statusIcon}
                    </Tooltip>
                </div>
            </div>

            {/* Preferred time */}
            {schedule.preferredTime && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ClockCircleFilled style={{ fontSize: 10 }} />
                    {schedule.preferredTime}
                </div>
            )}

            {/* Address snippet */}
            {schedule.deliveryAddress && (
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <EnvironmentOutlined style={{ fontSize: 10 }} />
                    {schedule.deliveryAddress}
                </div>
            )}

            {/* Contact + WhatsApp */}
            {primaryContact && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PhoneOutlined style={{ fontSize: 10 }} />
                        {primaryContact.name || primaryContact.phone}
                    </span>
                    {primaryContact.isWhatsApp !== false && primaryContact.phone && (
                        <Button
                            type="text"
                            size="small"
                            icon={<WhatsAppOutlined />}
                            onClick={handleWhatsApp}
                            style={{ color: '#25D366', padding: '0 4px', fontSize: 16 }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
