import dayjs from 'dayjs';
import { Customer, Order } from '../types';
import { getOrderDate } from './dateHelpers';

/**
 * RFM segment definition
 */
export type RFMSegment = 'Champions' | 'Loyal' | 'Potential Loyalists' | 'At Risk' | 'Hibernating';

/**
 * Result of RFM analysis for a single customer
 */
export interface CustomerRFMScore {
    customerId: string;
    recencyScore: number;    // 1-5 (5 = más reciente)
    frequencyScore: number;  // 1-5 (5 = más frecuente)
    monetaryScore: number;   // 1-5 (5 = mayor valor)
    segment: RFMSegment;
    lastOrderDate: dayjs.Dayjs | null;
    orderCount: number;
    totalSpent: number;
}

/**
 * Aggregated RFM segment statistics
 */
export interface RFMSegmentResult {
    segment: RFMSegment;
    count: number;
    totalRevenue: number;
    avgOrderValue: number;
    customers: CustomerRFMScore[];
}

/**
 * Computes RFM scores for all customers based on delivered orders.
 *
 * @param customers - All customers in the system
 * @param orders - All orders (will be filtered internally for delivered)
 * @param currentDate - Reference date for recency calculation
 * @returns Array of customer RFM scores with segment assignment
 */
export function computeCustomerRFMScores(
    customers: Customer[],
    orders: Order[],
    currentDate: dayjs.Dayjs
): CustomerRFMScore[] {
    // Filter delivered orders only
    const deliveredOrders = orders.filter(o =>
        o.status === 'Entregado' && !o.isDeleted
    );

    // Group orders by customer
    const customerOrdersMap: Record<string, Order[]> = {};
    deliveredOrders.forEach(order => {
        if (!customerOrdersMap[order.customerId]) {
            customerOrdersMap[order.customerId] = [];
        }
        customerOrdersMap[order.customerId].push(order);
    });

    // Compute raw RFM metrics per customer
    const customerMetrics = customers
        .filter(c => customerOrdersMap[c.id]) // Only customers with orders
        .map(customer => {
            const customerOrders = customerOrdersMap[customer.id];

            // Recency: days since last order
            const lastOrderDate = customerOrders
                .map(o => getOrderDate(o))
                .filter((d): d is dayjs.Dayjs => d !== null)
                .sort((a, b) => b.unix() - a.unix())[0] || null;

            const recencyDays = lastOrderDate
                ? currentDate.diff(lastOrderDate, 'days')
                : 9999;

            // Frequency: number of orders
            const frequency = customerOrders.length;

            // Monetary: total spent
            const monetary = customerOrders.reduce((sum, o) => sum + (o.total || 0), 0);

            return {
                customerId: customer.id,
                recencyDays,
                frequency,
                monetary,
                lastOrderDate,
                orderCount: frequency,
                totalSpent: monetary,
            };
        });

    // Calculate quintiles for scoring (1-5)
    const recencyValues = customerMetrics.map(m => m.recencyDays).sort((a, b) => a - b);
    const frequencyValues = customerMetrics.map(m => m.frequency).sort((a, b) => a - b);
    const monetaryValues = customerMetrics.map(m => m.monetary).sort((a, b) => a - b);

    const getQuintile = (value: number, sortedArray: number[], reverse = false): number => {
        if (sortedArray.length === 0) return 1;
        
        if (reverse) {
            // Recency: lower values are better (higher score).
            // Use indexOf to give tied values the highest rank (most recent).
            const index = sortedArray.indexOf(value);
            if (index === -1) return 1;
            const percentile = (index + 1) / sortedArray.length;
            const score = 6 - Math.ceil(percentile * 5);
            return Math.max(1, Math.min(5, score));
        } else {
            // Frequency and Monetary: higher values are better (higher score).
            // Use lastIndexOf to give tied values the highest rank.
            const index = sortedArray.lastIndexOf(value);
            if (index === -1) return 5;
            const percentile = (index + 1) / sortedArray.length;
            const score = Math.ceil(percentile * 5);
            return Math.max(1, Math.min(5, score));
        }
    };

    // Assign scores and segments
    const rfmScores: CustomerRFMScore[] = customerMetrics.map(metric => {
        const R = getQuintile(metric.recencyDays, recencyValues, true);
        const F = getQuintile(metric.frequency, frequencyValues);
        const M = getQuintile(metric.monetary, monetaryValues);

        const segment = determineSegment(R, F, M);

        return {
            customerId: metric.customerId,
            recencyScore: R,
            frequencyScore: F,
            monetaryScore: M,
            segment,
            lastOrderDate: metric.lastOrderDate,
            orderCount: metric.orderCount,
            totalSpent: metric.totalSpent,
        };
    });

    return rfmScores;
}

/**
 * Determines RFM segment based on R, F, M scores.
 */
function determineSegment(R: number, F: number, M: number): RFMSegment {
    // Champions: High R, F, M
    if (R === 5 && F === 5 && M === 5) return 'Champions';

    // Loyal: High R, F, decent M
    if (R >= 4 && F >= 4 && M >= 3) return 'Loyal';

    // Potential Loyalists: Recent buyers with low frequency but good value
    if (R >= 4 && F <= 2 && M >= 3) return 'Potential Loyalists';

    // At Risk: Low recency but historically high frequency/value
    if (R <= 2 && F >= 4 && M >= 4) return 'At Risk';

    // Hibernating: Low across the board
    if (R <= 2 && F <= 2 && M <= 2) return 'Hibernating';

    // Default: categorize by dominance
    if (R >= 4) return 'Potential Loyalists';
    if (F >= 4) return 'At Risk';
    return 'Hibernating';
}

/**
 * Aggregates RFM scores into segment-level statistics.
 *
 * @param rfmScores - Customer RFM scores
 * @returns Aggregated statistics per segment
 */
export function aggregateRFMSegments(rfmScores: CustomerRFMScore[]): RFMSegmentResult[] {
    const segments: RFMSegment[] = ['Champions', 'Loyal', 'Potential Loyalists', 'At Risk', 'Hibernating'];

    return segments.map(segment => {
        const customersInSegment = rfmScores.filter(score => score.segment === segment);
        const totalRevenue = customersInSegment.reduce((sum, c) => sum + c.totalSpent, 0);
        const totalOrders = customersInSegment.reduce((sum, c) => sum + c.orderCount, 0);
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        return {
            segment,
            count: customersInSegment.length,
            totalRevenue,
            avgOrderValue,
            customers: customersInSegment,
        };
    }).filter(s => s.count > 0); // Only include segments with customers
}

/**
 * Format for recharts: segment distribution
 */
export function formatRFMForChart(segments: RFMSegmentResult[]): { name: string; value: number }[] {
    return segments.map(s => ({
        name: s.segment,
        value: s.count,
    }));
}
