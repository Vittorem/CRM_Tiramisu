import dayjs from 'dayjs';
import { Order } from '../types';

/**
 * Extracts a dayjs date from an Order, prioritizing deliveredAt over deliveryDate.
 * Handles both Firestore Timestamp objects and raw {seconds} objects.
 */
export function getOrderDate(order: Order): dayjs.Dayjs | null {
    if (order.deliveredAt) {
        return toDay(order.deliveredAt);
    }
    if (order.deliveryDate) {
        return toDay(order.deliveryDate);
    }
    return null;
}

/**
 * Converts a Firestore Timestamp (or Timestamp-like object) to dayjs.
 */
export function toDay(ts: any): dayjs.Dayjs | null {
    if (!ts) return null;
    
    if (dayjs.isDayjs(ts)) {
        return ts.isValid() ? ts : null;
    }
    
    if (ts instanceof Date) {
        const d = dayjs(ts);
        return d.isValid() ? d : null;
    }
    
    if (typeof ts === 'string' || typeof ts === 'number') {
        const d = dayjs(ts);
        return d.isValid() ? d : null;
    }
    
    if (typeof ts === 'object') {
        try {
            if ('toDate' in ts && typeof ts.toDate === 'function') {
                const d = dayjs(ts.toDate());
                return d.isValid() ? d : null;
            }
            if ('seconds' in ts && typeof ts.seconds === 'number') {
                const d = dayjs(ts.seconds * 1000);
                return d.isValid() ? d : null;
            }
        } catch (e) {
            console.error('Error parsing timestamp in toDay:', e);
            return null;
        }
    }
    
    return null;
}

/**
 * Filters orders to only delivered orders within a date range.
 */
export function getDeliveredOrdersInRange(
    orders: Order[],
    start: dayjs.Dayjs,
    end: dayjs.Dayjs
): Order[] {
    return orders.filter(o => {
        if (o.isDeleted) return false;
        if (o.status !== 'Entregado') return false;
        const date = getOrderDate(o);
        if (!date) return false;
        return date.isAfter(start) && date.isBefore(end);
    });
}
