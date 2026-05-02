import { useMemo } from 'react';
import { message, Tag } from 'antd';
import { B2BDeliverySchedule, DAYS_OF_WEEK, DayOfWeek, Order } from '../../../types';
import { B2BBusinessCard } from './B2BBusinessCard';
import { hasOrderForDayThisWeek, getTodayDayOfWeek, isScheduleDismissedForDay, getDateForDayThisWeek } from '../../../utils/b2bAlerts';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useFirestoreMutation } from '../../../hooks/useFirestore';
import { arrayUnion } from 'firebase/firestore';

interface B2BWeeklyCalendarProps {
    schedules: B2BDeliverySchedule[];
    orders: Order[];
    onSelectSchedule: (schedule: B2BDeliverySchedule) => void;
}

const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
    'Lunes': 'Lun',
    'Martes': 'Mar',
    'Miércoles': 'Mié',
    'Jueves': 'Jue',
    'Viernes': 'Vie',
    'Sábado': 'Sáb',
    'Domingo': 'Dom',
};

// Map DayOfWeek to JS day number (0=Sun) for comparison
const DAY_TO_JS_NUM: Record<DayOfWeek, number> = {
    'Domingo': 0,
    'Lunes': 1,
    'Martes': 2,
    'Miércoles': 3,
    'Jueves': 4,
    'Viernes': 5,
    'Sábado': 6,
};

export const B2BWeeklyCalendar = ({ schedules, orders, onSelectSchedule }: B2BWeeklyCalendarProps) => {
    const isMobile = useIsMobile();
    const today = getTodayDayOfWeek();
    const todayJsNum = new Date().getDay();
    const { update: updateSchedule } = useFirestoreMutation<B2BDeliverySchedule>('b2b_schedules');

    const handleDismiss = async (scheduleId: string, dayOfWeek: DayOfWeek) => {
        const targetDate = getDateForDayThisWeek(dayOfWeek);
        if (!targetDate) return;
        try {
            await updateSchedule(scheduleId, {
                dismissedDates: arrayUnion(targetDate.format('YYYY-MM-DD')) as unknown as string[]
            });
            message.success('Pedido omitido para esta semana');
        } catch (error) {
            console.error('Error al omitir', error);
            message.error('Error al omitir el pedido');
        }
    };

    // Group schedules by day
    const schedulesByDay = useMemo(() => {
        const map: Record<DayOfWeek, B2BDeliverySchedule[]> = {
            'Lunes': [], 'Martes': [], 'Miércoles': [], 'Jueves': [],
            'Viernes': [], 'Sábado': [], 'Domingo': [],
        };
        for (const s of schedules) {
            if (s.isActive === false) continue;
            for (const day of s.deliveryDays) {
                map[day].push(s);
            }
        }
        // Sort alphabetically within each day
        for (const day of DAYS_OF_WEEK) {
            map[day].sort((a, b) => a.customerName.localeCompare(b.customerName));
        }
        return map;
    }, [schedules]);

    return (
        <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8,
            minHeight: 200,
        }}>
            {DAYS_OF_WEEK.map(day => {
                const isToday = day === today;
                const dayJsNum = DAY_TO_JS_NUM[day];
                const isPast = dayJsNum < todayJsNum;
                const daySchedules = schedulesByDay[day];
                const count = daySchedules.length;

                return (
                    <div
                        key={day}
                        style={{
                            flex: isMobile ? '0 0 200px' : 1,
                            minWidth: isMobile ? 200 : 120,
                            background: isToday ? 'rgba(212, 163, 115, 0.06)' : '#fafafa',
                            border: isToday ? '2px solid #d4a373' : '1px solid #f0f0f0',
                            borderRadius: 12,
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.2s',
                        }}
                    >
                        {/* Day Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12,
                            paddingBottom: 8,
                            borderBottom: '1px solid #f0f0f0',
                        }}>
                            <span style={{
                                fontWeight: isToday ? 700 : 600,
                                fontSize: isMobile ? 14 : 13,
                                color: isToday ? '#d4a373' : '#333',
                            }}>
                                {isMobile ? DAY_ABBREVIATIONS[day] : day}
                            </span>
                            {count > 0 && (
                                <Tag
                                    color={isToday ? 'gold' : 'default'}
                                    style={{ fontSize: 11, padding: '0 6px', margin: 0, borderRadius: 10 }}
                                >
                                    {count}
                                </Tag>
                            )}
                            {isToday && (
                                <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', margin: 0, borderRadius: 4 }}>
                                    HOY
                                </Tag>
                            )}
                        </div>

                        {/* Cards */}
                        <div style={{ flex: 1 }}>
                            {daySchedules.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: '20px 0' }}>
                                    Sin entregas
                                </div>
                            ) : (
                                daySchedules.map(schedule => (
                                    <B2BBusinessCard
                                        key={`${schedule.id}-${day}`}
                                        schedule={schedule}
                                        hasOrder={hasOrderForDayThisWeek(orders, schedule.customerId, day)}
                                        isPast={isPast}
                                        isDismissed={isScheduleDismissedForDay(schedule, day)}
                                        onClick={() => onSelectSchedule(schedule)}
                                        onDismiss={() => handleDismiss(schedule.id, day)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
