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
        description: '≥3 compras/mes ó ≥$650 gasto mensual',
    },
    {
        key: 'Leal',
        emoji: '⭐',
        color: 'blue',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
        description: '≥2 compras/mes ó ≥$400 gasto mensual',
    },
    {
        key: 'Ocasional',
        emoji: '🔄',
        color: 'green',
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        description: 'Compra todos los meses desde inicio',
    },
    {
        key: 'Esporádico',
        emoji: '💤',
        color: 'orange',
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
        description: 'Al menos 2 compras en total',
    },
    {
        key: 'Único',
        emoji: '1️⃣',
        color: 'default',
        gradient: 'linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)',
        description: 'Solo 1 compra en total',
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
    firstOrderDate: dayjs.Dayjs | null;
}

// --- Main classification ---

export function classifyCustomers(
    customers: Customer[],
    orders: Order[],
    now: dayjs.Dayjs = dayjs(),
): { classified: ClassifiedCustomer[]; periodLabel: string } {
    
    // Filter delivered orders only
    const allDeliveredOrders = orders.filter(o => {
        if (o.isDeleted) return false;
        if (o.status !== 'Entregado') return false;
        return !!getOrderDate(o);
    });

    // Group orders by customerId
    const ordersByCustomer = new Map<string, Order[]>();
    allDeliveredOrders.forEach(o => {
        const list = ordersByCustomer.get(o.customerId) || [];
        list.push(o);
        ordersByCustomer.set(o.customerId, list);
    });

    const classified: ClassifiedCustomer[] = [];

    for (const customer of customers) {
        if (customer.isDeleted) continue;

        const custOrders = ordersByCustomer.get(customer.id);
        if (!custOrders || custOrders.length === 0) continue;

        // Find date range for this customer
        let firstDate: dayjs.Dayjs | null = null;
        let lastDate: dayjs.Dayjs | null = null;
        const monthSet = new Set<string>();
        let totalSpent = 0;

        custOrders.forEach(o => {
            const d = getOrderDate(o);
            if (d) {
                if (!firstDate || d.isBefore(firstDate)) firstDate = d;
                if (!lastDate || d.isAfter(lastDate)) lastDate = d;
                monthSet.add(d.format('YYYY-MM'));
                totalSpent += (o.total || 0);
            }
        });

        if (!firstDate) continue;

        // Calculate months since first order to NOW
        // If first order was in May and now is May, it's 1 month.
        // diff + 1 to include both ends
        const monthsElapsed = Math.max(1, now.diff((firstDate as dayjs.Dayjs).startOf('month'), 'month') + 1);
        
        const totalOrders = custOrders.length;
        const avgOrdersPerMonth = totalOrders / monthsElapsed;
        const avgSpentPerMonth = totalSpent / monthsElapsed;
        const monthsWithOrders = monthSet.size;

        // Classify
        let category: BehaviorCategory;
        if (avgOrdersPerMonth >= 3 || avgSpentPerMonth >= 650) {
            category = 'Super Leal';
        } else if (avgOrdersPerMonth >= 2 || avgSpentPerMonth >= 400) {
            category = 'Leal';
        } else if (monthsWithOrders === monthsElapsed) {
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
            firstOrderDate: firstDate,
        });
    }

    classified.sort((a, b) => b.totalSpent - a.totalSpent);

    return { 
        classified, 
        periodLabel: 'Historial Completo' 
    };
}
