import dayjs from 'dayjs';
import { Customer, Order } from '../types';
import { getOrderDate } from './dateHelpers';

// --- Category definitions ---

export type B2CCategory = 'Super Leal' | 'Leal' | 'Ocasional' | 'Esporádico' | 'Único';
export type B2BCategory = 'Cuenta Clave' | 'Recurrente' | 'Piloto' | 'En Riesgo';

export type BehaviorCategory = B2CCategory | B2BCategory;

export interface CategoryMeta {
    key: string;
    emoji: string;
    color: string;
    gradient: string;
    description: string;
    defaultMessage?: string;
}

export const B2C_CATEGORIES: CategoryMeta[] = [
    {
        key: 'Super Leal',
        emoji: '👑',
        color: 'gold',
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
        description: '≥5 compras y compras en ≥3 meses distintos (4 meses)',
        defaultMessage: '¡Hola {{nombre}}! 👑 Eres de nuestros clientes más SUPER LEALES. Como agradecimiento, tienes envío gratis en tu próximo pedido y acceso anticipado a nuestras promociones. ¡Gracias por preferirnos!',
    },
    {
        key: 'Leal',
        emoji: '⭐',
        color: 'blue',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
        description: '3-4 compras y compras en ≥2 meses distintos (4 meses)',
        defaultMessage: '¡Hola {{nombre}}! ⭐ Gracias por ser un cliente LEAL. Disfruta de un postre de regalo en tu próxima compra mayor a $300. ¡Te esperamos!',
    },
    {
        key: 'Ocasional',
        emoji: '🔁',
        color: 'green',
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        description: '2 compras total y última compra ≤ 60 días',
        defaultMessage: '¡Hola {{nombre}}! 🔁 Nos encanta verte por aquí. En tu próximo pedido te incluimos un detalle sorpresa para que sigas disfrutando. ¡Haz tu pedido hoy!',
    },
    {
        key: 'Esporádico',
        emoji: '💤',
        color: 'orange',
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
        description: '2 compras total, pero sin compra en últimos 60 días',
        defaultMessage: '¡Hola {{nombre}}! 💤 Ha pasado un tiempo desde tu última compra. Queremos verte de nuevo, ¡te regalamos un 10% de descuento en tu próximo pedido!',
    },
    {
        key: 'Único',
        emoji: '1️⃣',
        color: 'default',
        gradient: 'linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)',
        description: '1 sola compra en el periodo de 4 meses',
        defaultMessage: '¡Hola {{nombre}}! 1️⃣ Gracias por habernos probado. Nos encantaría que vuelvas a disfrutar nuestros productos. ¡Aprovecha nuestra promoción de temporada!',
    },
];

export const B2B_CATEGORIES: CategoryMeta[] = [
    {
        key: 'Cuenta Clave',
        emoji: '🏢',
        color: 'purple',
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        description: '3+ pedidos o en 2+ meses Y gasto alto (≥$900)',
        defaultMessage: '¡Hola {{nombre}}! 🏢 Apreciamos mucho la confianza en nosotros como tu proveedor clave. Tienes prioridad en entregas y soporte dedicado. ¡Estamos a tus órdenes!',
    },
    {
        key: 'Recurrente',
        emoji: '🔄',
        color: 'cyan',
        gradient: 'linear-gradient(135deg, #13c2c2 0%, #5cdbd3 100%)',
        description: '2 pedidos en el periodo',
        defaultMessage: '¡Hola {{nombre}}! 🔄 Gracias por tus pedidos constantes. Te recordamos que tienes descuentos por volumen en tus próximas compras. ¡Hagamos crecer tu negocio!',
    },
    {
        key: 'Piloto',
        emoji: '🚀',
        color: 'blue',
        gradient: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
        description: '1 pedido en el periodo',
        defaultMessage: '¡Hola {{nombre}}! 🚀 ¿Cómo te fue con tu primer pedido? Queremos ser tu proveedor de confianza. Contáctanos para armar una propuesta a tu medida.',
    },
    {
        key: 'En Riesgo',
        emoji: '⚠️',
        color: 'red',
        gradient: 'linear-gradient(135deg, #f5222d 0%, #ff7875 100%)',
        description: 'Tenía 2+ pedidos pero no compra hace 45-60 días',
        defaultMessage: '¡Hola {{nombre}}! ⚠️ Te extrañamos. Queremos seguir siendo tu aliado comercial. Platícanos, ¿cómo podemos mejorar para tu próximo pedido?',
    },
];

export interface Badges {
    isHighValue: boolean; // gasto total >= 900
    isHighTicket: boolean; // ticket promedio >= 250
    isRecent: boolean; // compró últimos 30 días
}

export interface ClassifiedCustomer {
    customer: Customer;
    category: BehaviorCategory;
    badges: Badges;
    totalOrders: number;
    totalSpent: number;
    avgTicket: number;
    monthsWithOrders: number;
    lastOrderDate: dayjs.Dayjs | null;
}

// --- Main classification ---

export function classifyCustomers(
    customers: Customer[],
    orders: Order[],
    now: dayjs.Dayjs = dayjs(),
): { b2c: ClassifiedCustomer[]; b2b: ClassifiedCustomer[] } {
    
    const fourMonthsAgo = now.subtract(4, 'month').startOf('month');

    // Filter delivered orders in the last 4 months (for most rules)
    // BUT we might need more for "En Riesgo" if we want to be precise, 
    // though the prompt says "Base: últimos 4 meses"
    const deliveredOrders = orders.filter(o => {
        if (o.isDeleted) return false;
        if (o.status !== 'Entregado') return false;
        const d = getOrderDate(o);
        if (!d) return false;
        return d.isAfter(fourMonthsAgo) || d.isSame(fourMonthsAgo, 'day');
    });

    const ordersByCustomer = new Map<string, Order[]>();
    deliveredOrders.forEach(o => {
        const list = ordersByCustomer.get(o.customerId) || [];
        list.push(o);
        ordersByCustomer.set(o.customerId, list);
    });

    const b2c: ClassifiedCustomer[] = [];
    const b2b: ClassifiedCustomer[] = [];

    for (const customer of customers) {
        if (customer.isDeleted) continue;

        const custOrders = ordersByCustomer.get(customer.id) || [];
        if (custOrders.length === 0) continue;

        // Metrics
        const totalOrders = custOrders.length;
        const totalSpent = custOrders.reduce((acc, o) => acc + (o.total || 0), 0);
        const avgTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;
        
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

        // Badges
        const badges: Badges = {
            isHighValue: totalSpent >= 900,
            isHighTicket: avgTicket >= 250,
            isRecent: lastDate ? now.diff(lastDate, 'day') <= 30 : false,
        };

        const daysSinceLast = lastDate ? now.diff(lastDate, 'day') : 999;

        if (customer.type === 'B2B') {
            let category: B2BCategory;
            
            // Priority for B2B
            if (totalOrders >= 2 && daysSinceLast >= 45) {
                category = 'En Riesgo';
            } else if ((totalOrders >= 3 || monthsWithOrders >= 2) && totalSpent >= 900) {
                category = 'Cuenta Clave';
            } else if (totalOrders >= 2) {
                category = 'Recurrente';
            } else {
                category = 'Piloto';
            }

            b2b.push({ customer, category, badges, totalOrders, totalSpent, avgTicket, monthsWithOrders, lastOrderDate: lastDate });
        } else {
            let category: B2CCategory;

            // Priority for B2C
            if (totalOrders >= 5 && monthsWithOrders >= 3) {
                category = 'Super Leal';
            } else if (totalOrders >= 3 && monthsWithOrders >= 2) {
                category = 'Leal';
            } else if (totalOrders === 2 && daysSinceLast <= 60) {
                category = 'Ocasional';
            } else if (totalOrders === 2 && daysSinceLast > 60) {
                category = 'Esporádico';
            } else {
                category = 'Único';
            }

            b2c.push({ customer, category, badges, totalOrders, totalSpent, avgTicket, monthsWithOrders, lastOrderDate: lastDate });
        }
    }

    // Sort by spend
    b2c.sort((a, b) => b.totalSpent - a.totalSpent);
    b2b.sort((a, b) => b.totalSpent - a.totalSpent);

    return { b2c, b2b };
}
