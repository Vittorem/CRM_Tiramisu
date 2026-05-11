import dayjs from 'dayjs';
import { Customer, Order } from '../types';
import { getOrderDate } from './dateHelpers';

// --- Category definitions ---

export type BehaviorCategory =
    | 'Super Leal'
    | 'Leal'
    | 'Ocasional'
    | 'Esporádico'
    | 'Único';

export interface CategoryMeta {
    key: BehaviorCategory;
    emoji: string;
    color: string;        // Ant Design tag color
    gradient: string;     // CSS gradient for card accent
    description: string;
}

export const BEHAVIOR_CATEGORIES: CategoryMeta[] = [
    {
        key: 'Super Leal',
        emoji: '👑',
        color: 'gold',
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
        description: '≥3 compras/mes ó ≥$900 gasto mensual',
    },
    {
        key: 'Leal',
        emoji: '⭐',
        color: 'blue',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
        description: '≥2 compras/mes ó ≥$650 gasto mensual',
    },
    {
        key: 'Ocasional',
        emoji: '🔄',
        color: 'green',
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        description: 'Compra todos los meses',
    },
    {
        key: 'Esporádico',
        emoji: '💤',
        color: 'orange',
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
        description: 'Al menos 2 compras en 4 meses',
    },
    {
        key: 'Único',
        emoji: '1️⃣',
        color: 'default',
        gradient: 'linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)',
        description: 'Solo 1 compra en 4 meses',
    },
];

// --- Enriched customer record ---

export interface ClassifiedCustomer {
    customer: Customer;
    category: BehaviorCategory;
    totalOrders: number;
    totalSpent: number;
    avgOrdersPerMonth: number;
    avgSpentPerMonth: number;
    monthsWithOrders: number;
    lastOrderDate: dayjs.Dayjs | null;
}

// --- Helper: get the analysis period ---

export function getAnalysisPeriod(now: dayjs.Dayjs = dayjs()): { start: dayjs.Dayjs; end: dayjs.Dayjs; months: dayjs.Dayjs[] } {
    // End = last day of the previous month
    const end = now.startOf('month'); // exclusive upper bound (start of current month)
    // Start = first day, 4 months back from end
    const start = end.subtract(4, 'month');

    const months: dayjs.Dayjs[] = [];
    let cursor = start;
    while (cursor.isBefore(end)) {
        months.push(cursor);
        cursor = cursor.add(1, 'month');
    }

    return { start, end, months };
}

// --- Main classification ---

export function classifyCustomers(
    customers: Customer[],
    orders: Order[],
    now?: dayjs.Dayjs,
): { classified: ClassifiedCustomer[]; period: { start: dayjs.Dayjs; end: dayjs.Dayjs; months: dayjs.Dayjs[] } } {
    const period = getAnalysisPeriod(now);
    const { start, end, months } = period;

    // Pre-filter delivered orders in the analysis window
    const deliveredOrders = orders.filter(o => {
        if (o.isDeleted) return false;
        if (o.status !== 'Entregado') return false;
        const d = getOrderDate(o);
        if (!d) return false;
        return (d.isAfter(start) || d.isSame(start, 'day')) && d.isBefore(end);
    });

    // Group orders by customerId
    const ordersByCustomer = new Map<string, Order[]>();
    deliveredOrders.forEach(o => {
        const list = ordersByCustomer.get(o.customerId) || [];
        list.push(o);
        ordersByCustomer.set(o.customerId, list);
    });

    const classified: ClassifiedCustomer[] = [];

    for (const customer of customers) {
        if (customer.isDeleted) continue;

        const custOrders = ordersByCustomer.get(customer.id);
        if (!custOrders || custOrders.length === 0) continue; // no orders → inactive, skip

        const totalOrders = custOrders.length;
        const totalSpent = custOrders.reduce((acc, o) => acc + (o.total || 0), 0);

        // Count distinct months with at least 1 order
        const monthSet = new Set<string>();
        let lastDate: dayjs.Dayjs | null = null;
        custOrders.forEach(o => {
            const d = getOrderDate(o);
            if (d) {
                monthSet.add(d.format('YYYY-MM'));
                if (!lastDate || d.isAfter(lastDate)) lastDate = d;
            }
        });
        const monthsWithOrders = monthSet.size;

        const numMonths = months.length; // should be 4
        const avgOrdersPerMonth = totalOrders / numMonths;
        const avgSpentPerMonth = totalSpent / numMonths;

        // Classify (first matching wins)
        let category: BehaviorCategory;
        if (avgOrdersPerMonth >= 3 || avgSpentPerMonth >= 900) {
            category = 'Super Leal';
        } else if (avgOrdersPerMonth >= 2 || avgSpentPerMonth >= 650) {
            category = 'Leal';
        } else if (monthsWithOrders === numMonths) {
            category = 'Ocasional';
        } else if (totalOrders >= 2) {
            category = 'Esporádico';
        } else {
            category = 'Único';
        }

        classified.push({
            customer,
            category,
            totalOrders,
            totalSpent,
            avgOrdersPerMonth,
            avgSpentPerMonth,
            monthsWithOrders,
            lastOrderDate: lastDate,
        });
    }

    // Sort within each category: highest spenders first
    classified.sort((a, b) => b.totalSpent - a.totalSpent);

    return { classified, period };
}
