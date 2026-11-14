import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
    Order,
    Customer,
    Recipe,
    Ingredient,
    Product,
    Channel,
} from '../types';
import { getOrderDate } from './dateHelpers';
import { findRecipeForProduct } from './costHelpers';

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES_MONDAY_FIRST = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

export interface AnnualMonthlyRow {
    monthIndex: number;
    monthName: string;
    ordersCount: number;
    sales: number;
    estimatedCost: number;
    netProfit: number;
    marginPercent: number;
    avgTicket: number;
    uniqueCustomers: number;
    sharePercent: number;
}

export interface AnnualDimensionRow {
    name: string;
    ordersCount: number;
    unitsSold?: number;
    sales: number;
    estimatedCost?: number;
    netProfit?: number;
    marginPercent?: number;
    avgTicket?: number;
    uniqueCustomers?: number;
    sharePercent: number;
}

export interface AnnualTopCustomerRow {
    customerId: string;
    name: string;
    type: string;
    gender: string;
    phone: string;
    ordersCount: number;
    totalSpent: number;
    avgTicket: number;
    lastOrderDate: string;
}

export interface AnnualOrderDetailRow {
    date: string;
    customerName: string;
    customerType: string;
    channelName: string;
    deliveryMethod: string;
    productsSummary: string;
    flavorsSummary: string;
    quantity: number;
    subtotal: number;
    discount: number;
    shipping: number;
    extraCharges: number;
    total: number;
    estimatedCost: number;
    netProfit: number;
    paymentStatus: string;
}

export interface AnnualReportData {
    year: number;
    generatedAt: string;
    summary: {
        totalSales: number;
        totalEstimatedCost: number;
        netProfit: number;
        marginPercent: number;
        deliveredCount: number;
        cancelledCount: number;
        totalOrdersCount: number;
        cancellationRate: number;
        avgTicket: number;
        uniqueCustomers: number;
        newCustomers: number;
        returningCustomers: number;
        repeatPurchaseRate: number;
        totalDiscounts: number;
        totalShipping: number;
        totalExtraCharges: number;
        prevYearSales: number;
        prevYearOrders: number;
        yoySalesGrowthPercent: number | null;
        bestMonthName: string;
        bestMonthSales: number;
        worstMonthName: string;
        worstMonthSales: number;
        bestDayName: string;
        bestDaySales: number;
    };
    monthly: AnnualMonthlyRow[];
    byDayOfWeek: AnnualDimensionRow[];
    byDeliveryMethod: AnnualDimensionRow[];
    byProduct: AnnualDimensionRow[];
    byFlavor: AnnualDimensionRow[];
    byChannel: AnnualDimensionRow[];
    byContactMethod: AnnualDimensionRow[];
    byCustomerType: AnnualDimensionRow[];
    byGender: AnnualDimensionRow[];
    byAgeBucket: AnnualDimensionRow[];
    topOccupations: AnnualDimensionRow[];
    topLocations: AnnualDimensionRow[];
    topCustomers: AnnualTopCustomerRow[];
    orderDetails: AnnualOrderDetailRow[];
}

export function getAvailableReportYears(orders: Order[]): number[] {
    const currentYear = dayjs().year();
    const years = new Set<number>([currentYear]);

    orders.forEach(o => {
        if (o.isDeleted) return;
        const d = getOrderDate(o);
        if (d) years.add(d.year());
    });

    return Array.from(years).sort((a, b) => b - a);
}

interface BuildAnnualReportInput {
    orders: Order[];
    customers: Customer[];
    recipes: Recipe[];
    ingredients: Ingredient[];
    products: Product[];
    channels: Channel[];
}

export function buildAnnualReportData(
    year: number,
    { orders, customers, recipes, ingredients, products, channels }: BuildAnnualReportInput
): AnnualReportData {
    // Index lookups in O(1)
    const customerMap = new Map<string, Customer>();
    customers.forEach(c => customerMap.set(c.id, c));

    const channelMap = new Map<string, string>();
    channels.forEach(c => channelMap.set(c.id, c.name));

    const productMap = new Map<string, Product>();
    products.forEach(p => productMap.set(p.id, p));

    const ingredientMap = new Map<string, Ingredient>();
    ingredients.forEach(ing => ingredientMap.set(ing.id, ing));

    const recipeCostCache = new Map<string, number>();
    const getRecipeCostPerServing = (recipe: Recipe): number => {
        if (recipeCostCache.has(recipe.id)) {
            return recipeCostCache.get(recipe.id)!;
        }
        if (!recipe.servings_default || recipe.servings_default <= 0 || !recipe.ingredients?.length) {
            recipeCostCache.set(recipe.id, 0);
            return 0;
        }
        const totalRecipeCost = recipe.ingredients.reduce((sum, ri) => {
            const ing = ingredientMap.get(ri.ingredientId);
            return ing ? sum + ing.cost_unit * ri.qty : sum;
        }, 0);
        const perServing = totalRecipeCost / recipe.servings_default;
        recipeCostCache.set(recipe.id, perServing);
        return perServing;
    };

    const estimateItemCost = (
        productId: string | undefined,
        flavorId: string | undefined,
        productName: string,
        flavorName: string | undefined,
        qty: number
    ): number => {
        const recipe = findRecipeForProduct(productId, flavorId, productName, flavorName, recipes);
        if (!recipe) return 0;
        return getRecipeCostPerServing(recipe) * qty;
    };

    const estimateOrderCost = (order: Order): number => {
        if (order.items && order.items.length > 0) {
            return order.items.reduce(
                (sum, item) =>
                    sum +
                    estimateItemCost(
                        item.productId,
                        item.flavorId,
                        item.productNameAtSale,
                        item.flavorNameAtSale,
                        item.quantity || 1
                    ),
                0
            );
        }
        if (order.productNameAtSale) {
            return estimateItemCost(
                order.productId,
                order.flavorId,
                order.productNameAtSale,
                order.flavorNameAtSale,
                order.quantity || 1
            );
        }
        return 0;
    };

    // Track first-ever delivered year per customer for new vs returning calculation
    const customerFirstYear = new Map<string, number>();
    const deliveredYearOrders: { order: Order; date: dayjs.Dayjs; cost: number }[] = [];
    let cancelledCount = 0;
    let totalOrdersInYear = 0;
    let prevYearSales = 0;
    let prevYearOrders = 0;

    orders.forEach(o => {
        if (o.isDeleted) return;
        const d = getOrderDate(o);
        if (!d) return;
        const orderYear = d.year();

        if (o.status === 'Entregado' && o.customerId) {
            const existingFirst = customerFirstYear.get(o.customerId);
            if (existingFirst === undefined || orderYear < existingFirst) {
                customerFirstYear.set(o.customerId, orderYear);
            }
        }

        if (orderYear === year - 1 && o.status === 'Entregado') {
            prevYearSales += o.total || 0;
            prevYearOrders += 1;
        }

        if (orderYear === year) {
            totalOrdersInYear += 1;
            if (o.status === 'Cancelado') {
                cancelledCount += 1;
            } else if (o.status === 'Entregado') {
                deliveredYearOrders.push({
                    order: o,
                    date: d,
                    cost: estimateOrderCost(o),
                });
            }
        }
    });

    // Sort chronologically
    deliveredYearOrders.sort((a, b) => a.date.valueOf() - b.date.valueOf());

    let totalSales = 0;
    let totalEstimatedCost = 0;
    let totalDiscounts = 0;
    let totalShipping = 0;
    let totalExtraCharges = 0;

    // Aggregators
    const monthlyAgg = Array.from({ length: 12 }, (_, idx) => ({
        monthIndex: idx,
        monthName: MONTH_NAMES[idx],
        ordersCount: 0,
        sales: 0,
        estimatedCost: 0,
        customerIds: new Set<string>(),
    }));

    const dayAgg = Array.from({ length: 7 }, (_, idx) => ({
        name: DAY_NAMES_MONDAY_FIRST[idx],
        ordersCount: 0,
        sales: 0,
    }));

    const deliveryAgg = new Map<string, { ordersCount: number; sales: number }>();
    const productAgg = new Map<string, { unitsSold: number; sales: number; cost: number; ordersSet: Set<string> }>();
    const flavorAgg = new Map<string, { unitsSold: number; sales: number; ordersSet: Set<string> }>();
    const channelAgg = new Map<string, { ordersCount: number; sales: number }>();
    const contactAgg = new Map<string, { ordersCount: number; sales: number }>();
    const customerTypeAgg = new Map<string, { ordersCount: number; sales: number; customerIds: Set<string> }>();
    const genderAgg = new Map<string, { ordersCount: number; sales: number; customerIds: Set<string> }>();
    const customerYearAgg = new Map<
        string,
        { ordersCount: number; totalSpent: number; lastDate: dayjs.Dayjs }
    >();

    const orderDetails: AnnualOrderDetailRow[] = [];

    deliveredYearOrders.forEach(({ order, date, cost }) => {
        const orderTotal = order.total || 0;
        totalSales += orderTotal;
        totalEstimatedCost += cost;
        totalDiscounts += order.discountAmount || 0;
        totalShipping += order.shippingCost || 0;
        totalExtraCharges += order.extraCharges || 0;

        const customer = order.customerId ? customerMap.get(order.customerId) : undefined;
        const customerType = customer?.type || 'B2C';
        const genderLabel =
            customer?.gender === 'F' ? 'Femenino' : customer?.gender === 'M' ? 'Masculino' : 'Otro / Sin Dato';
        const contactMethod = customer?.mainContactMethod || 'Sin Dato';
        const channelName = channelMap.get(order.channelId) || 'Sin Canal';

        // Monthly
        const m = monthlyAgg[date.month()];
        m.ordersCount += 1;
        m.sales += orderTotal;
        m.estimatedCost += cost;
        if (order.customerId) m.customerIds.add(order.customerId);

        // Day of week (dayjs().day(): 0=Sun..6=Sat -> convert to 0=Mon..6=Sun)
        const dowIndex = (date.day() + 6) % 7;
        dayAgg[dowIndex].ordersCount += 1;
        dayAgg[dowIndex].sales += orderTotal;

        // Delivery Method
        const method = order.deliveryMethod || 'Recoge';
        const dEntry = deliveryAgg.get(method) || { ordersCount: 0, sales: 0 };
        dEntry.ordersCount += 1;
        dEntry.sales += orderTotal;
        deliveryAgg.set(method, dEntry);

        // Channel
        const chEntry = channelAgg.get(channelName) || { ordersCount: 0, sales: 0 };
        chEntry.ordersCount += 1;
        chEntry.sales += orderTotal;
        channelAgg.set(channelName, chEntry);

        // Contact Method
        const ctEntry = contactAgg.get(contactMethod) || { ordersCount: 0, sales: 0 };
        ctEntry.ordersCount += 1;
        ctEntry.sales += orderTotal;
        contactAgg.set(contactMethod, ctEntry);

        // Customer Type (B2B / B2C)
        const typeEntry = customerTypeAgg.get(customerType) || {
            ordersCount: 0,
            sales: 0,
            customerIds: new Set<string>(),
        };
        typeEntry.ordersCount += 1;
        typeEntry.sales += orderTotal;
        if (order.customerId) typeEntry.customerIds.add(order.customerId);
        customerTypeAgg.set(customerType, typeEntry);

        // Gender
        const gEntry = genderAgg.get(genderLabel) || {
            ordersCount: 0,
            sales: 0,
            customerIds: new Set<string>(),
        };
        gEntry.ordersCount += 1;
        gEntry.sales += orderTotal;
        if (order.customerId) gEntry.customerIds.add(order.customerId);
        genderAgg.set(genderLabel, gEntry);

        // Customer Year Agg
        if (order.customerId) {
            const cAgg = customerYearAgg.get(order.customerId) || {
                ordersCount: 0,
                totalSpent: 0,
                lastDate: date,
            };
            cAgg.ordersCount += 1;
            cAgg.totalSpent += orderTotal;
            if (date.isAfter(cAgg.lastDate)) cAgg.lastDate = date;
            customerYearAgg.set(order.customerId, cAgg);
        }

        // Items (Products & Flavors)
        const items =
            order.items && order.items.length > 0
                ? order.items
                : [
                      {
                          id: 'legacy',
                          productId: order.productId || '',
                          productNameAtSale: order.productNameAtSale || 'Desconocido',
                          flavorId: order.flavorId || '',
                          flavorNameAtSale: order.flavorNameAtSale || 'Sin Sabor',
                          quantity: order.quantity || 1,
                          unitPriceAtSale: order.unitPriceAtSale || orderTotal,
                          subtotal: orderTotal,
                      },
                  ];

        const itemsSubtotalSum = items.reduce((s, it) => s + (it.subtotal || it.quantity * it.unitPriceAtSale || 0), 0);

        items.forEach(item => {
            const qty = item.quantity || 1;
            const prodName =
                productMap.get(item.productId)?.name || item.productNameAtSale || 'Desconocido';
            const flavName = item.flavorNameAtSale || 'Sin Sabor';
            const rawSub = item.subtotal || qty * (item.unitPriceAtSale || 0);
            // Attribute order total proportionally if discounts/shipping exist
            const attributedSales =
                itemsSubtotalSum > 0 ? (rawSub / itemsSubtotalSum) * orderTotal : orderTotal / items.length;
            const itemCost = estimateItemCost(
                item.productId,
                item.flavorId,
                prodName,
                flavName,
                qty
            );

            const pEntry = productAgg.get(prodName) || {
                unitsSold: 0,
                sales: 0,
                cost: 0,
                ordersSet: new Set<string>(),
            };
            pEntry.unitsSold += qty;
            pEntry.sales += attributedSales;
            pEntry.cost += itemCost;
            pEntry.ordersSet.add(order.id);
            productAgg.set(prodName, pEntry);

            const fEntry = flavorAgg.get(flavName) || {
                unitsSold: 0,
                sales: 0,
                ordersSet: new Set<string>(),
            };
            fEntry.unitsSold += qty;
            fEntry.sales += attributedSales;
            fEntry.ordersSet.add(order.id);
            flavorAgg.set(flavName, fEntry);
        });

        orderDetails.push({
            date: date.format('YYYY-MM-DD'),
            customerName: customer?.fullName || order.customerName || 'Desconocido',
            customerType,
            channelName,
            deliveryMethod: method,
            productsSummary: items.map(i => `${i.quantity || 1}x ${i.productNameAtSale}`).join(', '),
            flavorsSummary: items.map(i => i.flavorNameAtSale || 'N/A').join(', '),
            quantity: items.reduce((s, i) => s + (i.quantity || 1), 0),
            subtotal: order.subtotal ?? itemsSubtotalSum,
            discount: order.discountAmount || 0,
            shipping: order.shippingCost || 0,
            extraCharges: order.extraCharges || 0,
            total: orderTotal,
            estimatedCost: cost,
            netProfit: orderTotal - cost,
            paymentStatus: order.paymentStatus || 'Pagado',
        });
    });

    const deliveredCount = deliveredYearOrders.length;
    const netProfit = totalSales - totalEstimatedCost;
    const marginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const avgTicket = deliveredCount > 0 ? totalSales / deliveredCount : 0;
    const cancellationRate = totalOrdersInYear > 0 ? (cancelledCount / totalOrdersInYear) * 100 : 0;

    // Customer retention & demographics (unique active customers in year)
    const uniqueCustomerIds = Array.from(customerYearAgg.keys());
    let newCustomers = 0;
    let returningCustomers = 0;
    let repeatBuyers = 0;

    const ageBuckets: Record<string, { customers: number; sales: number }> = {
        '< 20': { customers: 0, sales: 0 },
        '20-29': { customers: 0, sales: 0 },
        '30-39': { customers: 0, sales: 0 },
        '40-49': { customers: 0, sales: 0 },
        '50+': { customers: 0, sales: 0 },
        'Sin Dato': { customers: 0, sales: 0 },
    };
    const occAgg = new Map<string, { customers: number; sales: number }>();
    const locAgg = new Map<string, { customers: number; sales: number }>();

    uniqueCustomerIds.forEach(cid => {
        const cAgg = customerYearAgg.get(cid)!;
        if (cAgg.ordersCount > 1) repeatBuyers += 1;

        const firstYr = customerFirstYear.get(cid);
        if (firstYr === year) newCustomers += 1;
        else returningCustomers += 1;

        const cust = customerMap.get(cid);
        if (!cust) return;

        // Age
        let bucket = 'Sin Dato';
        if (cust.age) {
            if (cust.age < 20) bucket = '< 20';
            else if (cust.age < 30) bucket = '20-29';
            else if (cust.age < 40) bucket = '30-39';
            else if (cust.age < 50) bucket = '40-49';
            else bucket = '50+';
        }
        ageBuckets[bucket].customers += 1;
        ageBuckets[bucket].sales += cAgg.totalSpent;

        // Occupation
        const occ = cust.occupation?.trim() || 'Sin Dato';
        const oEntry = occAgg.get(occ) || { customers: 0, sales: 0 };
        oEntry.customers += 1;
        oEntry.sales += cAgg.totalSpent;
        occAgg.set(occ, oEntry);

        // Location (colonia / city)
        const loc = [cust.colonia?.trim(), cust.city?.trim()].filter(Boolean).join(', ') || 'Sin Dato';
        const lEntry = locAgg.get(loc) || { customers: 0, sales: 0 };
        lEntry.customers += 1;
        lEntry.sales += cAgg.totalSpent;
        locAgg.set(loc, lEntry);
    });

    const repeatPurchaseRate =
        uniqueCustomerIds.length > 0 ? (repeatBuyers / uniqueCustomerIds.length) * 100 : 0;

    // Monthly finalization
    const monthly: AnnualMonthlyRow[] = monthlyAgg.map(m => {
        const profit = m.sales - m.estimatedCost;
        return {
            monthIndex: m.monthIndex,
            monthName: m.monthName,
            ordersCount: m.ordersCount,
            sales: m.sales,
            estimatedCost: m.estimatedCost,
            netProfit: profit,
            marginPercent: m.sales > 0 ? (profit / m.sales) * 100 : 0,
            avgTicket: m.ordersCount > 0 ? m.sales / m.ordersCount : 0,
            uniqueCustomers: m.customerIds.size,
            sharePercent: totalSales > 0 ? (m.sales / totalSales) * 100 : 0,
        };
    });

    const activeMonths = monthly.filter(m => m.ordersCount > 0);
    const bestMonth = activeMonths.reduce<AnnualMonthlyRow | null>(
        (best, cur) => (!best || cur.sales > best.sales ? cur : best),
        null
    );
    const worstMonth = activeMonths.reduce<AnnualMonthlyRow | null>(
        (worst, cur) => (!worst || cur.sales < worst.sales ? cur : worst),
        null
    );

    const byDayOfWeek: AnnualDimensionRow[] = dayAgg.map(d => ({
        name: d.name,
        ordersCount: d.ordersCount,
        sales: d.sales,
        avgTicket: d.ordersCount > 0 ? d.sales / d.ordersCount : 0,
        sharePercent: totalSales > 0 ? (d.sales / totalSales) * 100 : 0,
    }));

    const bestDay = byDayOfWeek.reduce<AnnualDimensionRow | null>(
        (best, cur) => (!best || cur.sales > best.sales ? cur : best),
        null
    );

    const byDeliveryMethod: AnnualDimensionRow[] = Array.from(deliveryAgg.entries())
        .map(([name, val]) => ({
            name,
            ordersCount: val.ordersCount,
            sales: val.sales,
            avgTicket: val.ordersCount > 0 ? val.sales / val.ordersCount : 0,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

    const byProduct: AnnualDimensionRow[] = Array.from(productAgg.entries())
        .map(([name, val]) => {
            const profit = val.sales - val.cost;
            return {
                name,
                ordersCount: val.ordersSet.size,
                unitsSold: val.unitsSold,
                sales: val.sales,
                estimatedCost: val.cost,
                netProfit: profit,
                marginPercent: val.sales > 0 ? (profit / val.sales) * 100 : 0,
                sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
            };
        })
        .sort((a, b) => b.sales - a.sales);

    const byFlavor: AnnualDimensionRow[] = Array.from(flavorAgg.entries())
        .map(([name, val]) => ({
            name,
            ordersCount: val.ordersSet.size,
            unitsSold: val.unitsSold,
            sales: val.sales,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

    const byChannel: AnnualDimensionRow[] = Array.from(channelAgg.entries())
        .map(([name, val]) => ({
            name,
            ordersCount: val.ordersCount,
            sales: val.sales,
            avgTicket: val.ordersCount > 0 ? val.sales / val.ordersCount : 0,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

    const byContactMethod: AnnualDimensionRow[] = Array.from(contactAgg.entries())
        .map(([name, val]) => ({
            name,
            ordersCount: val.ordersCount,
            sales: val.sales,
            avgTicket: val.ordersCount > 0 ? val.sales / val.ordersCount : 0,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

    const byCustomerType: AnnualDimensionRow[] = Array.from(customerTypeAgg.entries())
        .map(([name, val]) => ({
            name,
            uniqueCustomers: val.customerIds.size,
            ordersCount: val.ordersCount,
            sales: val.sales,
            avgTicket: val.ordersCount > 0 ? val.sales / val.ordersCount : 0,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

    const byGender: AnnualDimensionRow[] = Array.from(genderAgg.entries())
        .map(([name, val]) => ({
            name,
            uniqueCustomers: val.customerIds.size,
            ordersCount: val.ordersCount,
            sales: val.sales,
            avgTicket: val.ordersCount > 0 ? val.sales / val.ordersCount : 0,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

    const byAgeBucket: AnnualDimensionRow[] = Object.entries(ageBuckets).map(([name, val]) => ({
        name,
        uniqueCustomers: val.customers,
        ordersCount: 0,
        sales: val.sales,
        sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
    }));

    const topOccupations: AnnualDimensionRow[] = Array.from(occAgg.entries())
        .map(([name, val]) => ({
            name,
            uniqueCustomers: val.customers,
            ordersCount: 0,
            sales: val.sales,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

    const topLocations: AnnualDimensionRow[] = Array.from(locAgg.entries())
        .map(([name, val]) => ({
            name,
            uniqueCustomers: val.customers,
            ordersCount: 0,
            sales: val.sales,
            sharePercent: totalSales > 0 ? (val.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

    const topCustomers: AnnualTopCustomerRow[] = uniqueCustomerIds
        .map(cid => {
            const cust = customerMap.get(cid);
            const agg = customerYearAgg.get(cid)!;
            const genderLabel =
                cust?.gender === 'F' ? 'F' : cust?.gender === 'M' ? 'M' : 'N/D';
            return {
                customerId: cid,
                name: cust?.fullName || 'Desconocido',
                type: cust?.type || 'B2C',
                gender: genderLabel,
                phone: cust?.phone || '',
                ordersCount: agg.ordersCount,
                totalSpent: agg.totalSpent,
                avgTicket: agg.ordersCount > 0 ? agg.totalSpent / agg.ordersCount : 0,
                lastOrderDate: agg.lastDate.format('YYYY-MM-DD'),
            };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 20);

    const yoySalesGrowthPercent =
        prevYearSales > 0 ? ((totalSales - prevYearSales) / prevYearSales) * 100 : null;

    return {
        year,
        generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
        summary: {
            totalSales,
            totalEstimatedCost,
            netProfit,
            marginPercent,
            deliveredCount,
            cancelledCount,
            totalOrdersCount: totalOrdersInYear,
            cancellationRate,
            avgTicket,
            uniqueCustomers: uniqueCustomerIds.length,
            newCustomers,
            returningCustomers,
            repeatPurchaseRate,
            totalDiscounts,
            totalShipping,
            totalExtraCharges,
            prevYearSales,
            prevYearOrders,
            yoySalesGrowthPercent,
            bestMonthName: bestMonth?.monthName || 'N/A',
            bestMonthSales: bestMonth?.sales || 0,
            worstMonthName: worstMonth?.monthName || 'N/A',
            worstMonthSales: worstMonth?.sales || 0,
            bestDayName: bestDay?.name || 'N/A',
            bestDaySales: bestDay?.sales || 0,
        },
        monthly,
        byDayOfWeek,
        byDeliveryMethod,
        byProduct,
        byFlavor,
        byChannel,
        byContactMethod,
        byCustomerType,
        byGender,
        byAgeBucket,
        topOccupations,
        topLocations,
        topCustomers,
        orderDetails,
    };
}
