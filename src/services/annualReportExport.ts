import { AnnualReportData } from '../utils/annualReport';

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtMoney = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export async function exportAnnualReportExcel(data: AnnualReportData) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const s = data.summary;

    // 1. Resumen Ejecutivo
    const resumenRows = [
        { Indicador: 'Año del Reporte', Valor: data.year },
        { Indicador: 'Fecha de Generación', Valor: data.generatedAt },
        { Indicador: 'Ventas Totales (Entregados)', Valor: round2(s.totalSales) },
        { Indicador: 'Costos Estimados (Recetas)', Valor: round2(s.totalEstimatedCost) },
        { Indicador: 'Ganancia Neta Estimada', Valor: round2(s.netProfit) },
        { Indicador: 'Margen Neto (%)', Valor: fmtPct(s.marginPercent) },
        { Indicador: 'Pedidos Entregados', Valor: s.deliveredCount },
        { Indicador: 'Pedidos Cancelados', Valor: s.cancelledCount },
        { Indicador: 'Tasa de Cancelación (%)', Valor: fmtPct(s.cancellationRate) },
        { Indicador: 'Ticket Promedio', Valor: round2(s.avgTicket) },
        { Indicador: 'Clientes Únicos Activos', Valor: s.uniqueCustomers },
        { Indicador: 'Clientes Nuevos (1ra compra en el año)', Valor: s.newCustomers },
        { Indicador: 'Clientes Recurrentes (años previos)', Valor: s.returningCustomers },
        { Indicador: 'Tasa de Recompra en el Año (%)', Valor: fmtPct(s.repeatPurchaseRate) },
        { Indicador: 'Descuentos Otorgados', Valor: round2(s.totalDiscounts) },
        { Indicador: 'Envíos Cobrados', Valor: round2(s.totalShipping) },
        { Indicador: 'Cargos Adicionales', Valor: round2(s.totalExtraCharges) },
        { Indicador: `Ventas Año Anterior (${data.year - 1})`, Valor: round2(s.prevYearSales) },
        {
            Indicador: 'Crecimiento YoY (%)',
            Valor: s.yoySalesGrowthPercent !== null ? fmtPct(s.yoySalesGrowthPercent) : 'Sin datos previos',
        },
        { Indicador: 'Mejor Mes', Valor: `${s.bestMonthName} (${fmtMoney(s.bestMonthSales)})` },
        { Indicador: 'Mes Más Bajo (con ventas)', Valor: `${s.worstMonthName} (${fmtMoney(s.worstMonthSales)})` },
        { Indicador: 'Mejor Día de la Semana', Valor: `${s.bestDayName} (${fmtMoney(s.bestDaySales)})` },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen Ejecutivo');

    // 2. Temporalidad Mensual
    const monthlyRows = data.monthly.map(m => ({
        Mes: m.monthName,
        Pedidos: m.ordersCount,
        Clientes_Unicos: m.uniqueCustomers,
        Ventas: round2(m.sales),
        Costo_Estimado: round2(m.estimatedCost),
        Ganancia_Neta: round2(m.netProfit),
        Margen_Pct: fmtPct(m.marginPercent),
        Ticket_Promedio: round2(m.avgTicket),
        Participacion_Pct: fmtPct(m.sharePercent),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), 'Mensual');

    // 3. Días de Semana y Método de Entrega
    const dayRows = data.byDayOfWeek.map(d => ({
        Tipo: 'Día de la Semana',
        Categoria: d.name,
        Pedidos: d.ordersCount,
        Ventas: round2(d.sales),
        Ticket_Promedio: round2(d.avgTicket || 0),
        Participacion_Pct: fmtPct(d.sharePercent),
    }));
    const deliveryRows = data.byDeliveryMethod.map(d => ({
        Tipo: 'Método de Entrega',
        Categoria: d.name,
        Pedidos: d.ordersCount,
        Ventas: round2(d.sales),
        Ticket_Promedio: round2(d.avgTicket || 0),
        Participacion_Pct: fmtPct(d.sharePercent),
    }));
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([...dayRows, ...deliveryRows]),
        'Días y Entrega'
    );

    // 4. Productos y Sabores
    const productRows = data.byProduct.map(p => ({
        Tipo: 'Producto',
        Nombre: p.name,
        Unidades: p.unitsSold || 0,
        Pedidos: p.ordersCount,
        Ventas: round2(p.sales),
        Costo_Estimado: round2(p.estimatedCost || 0),
        Ganancia_Neta: round2(p.netProfit || 0),
        Margen_Pct: fmtPct(p.marginPercent || 0),
        Participacion_Pct: fmtPct(p.sharePercent),
    }));
    const flavorRows = data.byFlavor.map(f => ({
        Tipo: 'Sabor',
        Nombre: f.name,
        Unidades: f.unitsSold || 0,
        Pedidos: f.ordersCount,
        Ventas: round2(f.sales),
        Costo_Estimado: '',
        Ganancia_Neta: '',
        Margen_Pct: '',
        Participacion_Pct: fmtPct(f.sharePercent),
    }));
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([...productRows, ...flavorRows]),
        'Productos y Sabores'
    );

    // 5. Canales y B2B vs B2C
    const channelRows = data.byChannel.map(c => ({
        Dimension: 'Canal de Venta',
        Segmento: c.name,
        Clientes_Unicos: '',
        Pedidos: c.ordersCount,
        Ventas: round2(c.sales),
        Ticket_Promedio: round2(c.avgTicket || 0),
        Participacion_Pct: fmtPct(c.sharePercent),
    }));
    const contactRows = data.byContactMethod.map(c => ({
        Dimension: 'Medio de Contacto',
        Segmento: c.name,
        Clientes_Unicos: '',
        Pedidos: c.ordersCount,
        Ventas: round2(c.sales),
        Ticket_Promedio: round2(c.avgTicket || 0),
        Participacion_Pct: fmtPct(c.sharePercent),
    }));
    const typeRows = data.byCustomerType.map(c => ({
        Dimension: 'Tipo de Cliente',
        Segmento: c.name,
        Clientes_Unicos: c.uniqueCustomers || 0,
        Pedidos: c.ordersCount,
        Ventas: round2(c.sales),
        Ticket_Promedio: round2(c.avgTicket || 0),
        Participacion_Pct: fmtPct(c.sharePercent),
    }));
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([...typeRows, ...channelRows, ...contactRows]),
        'Canales y B2B-B2C'
    );

    // 6. Demografía y Zonas
    const genderRows = data.byGender.map(g => ({
        Dimension: 'Género',
        Categoria: g.name,
        Clientes_Unicos: g.uniqueCustomers || 0,
        Pedidos: g.ordersCount,
        Ventas: round2(g.sales),
        Ticket_Promedio: round2(g.avgTicket || 0),
        Participacion_Pct: fmtPct(g.sharePercent),
    }));
    const ageRows = data.byAgeBucket.map(a => ({
        Dimension: 'Rango de Edad',
        Categoria: a.name,
        Clientes_Unicos: a.uniqueCustomers || 0,
        Pedidos: '',
        Ventas: round2(a.sales),
        Ticket_Promedio: '',
        Participacion_Pct: fmtPct(a.sharePercent),
    }));
    const occRows = data.topOccupations.map(o => ({
        Dimension: 'Top Ocupación',
        Categoria: o.name,
        Clientes_Unicos: o.uniqueCustomers || 0,
        Pedidos: '',
        Ventas: round2(o.sales),
        Ticket_Promedio: '',
        Participacion_Pct: fmtPct(o.sharePercent),
    }));
    const locRows = data.topLocations.map(l => ({
        Dimension: 'Top Zona / Colonia',
        Categoria: l.name,
        Clientes_Unicos: l.uniqueCustomers || 0,
        Pedidos: '',
        Ventas: round2(l.sales),
        Ticket_Promedio: '',
        Participacion_Pct: fmtPct(l.sharePercent),
    }));
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([...genderRows, ...ageRows, ...occRows, ...locRows]),
        'Demografía y Zonas'
    );

    // 7. Top Clientes
    const topCustomerRows = data.topCustomers.map((c, idx) => ({
        Ranking: idx + 1,
        Cliente: c.name,
        Tipo: c.type,
        Genero: c.gender,
        Telefono: c.phone,
        Pedidos_Año: c.ordersCount,
        Gasto_Total: round2(c.totalSpent),
        Ticket_Promedio: round2(c.avgTicket),
        Ultima_Compra: c.lastOrderDate,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topCustomerRows), 'Top Clientes');

    // 8. Detalle de Pedidos
    const detailRows = data.orderDetails.map(o => ({
        Fecha: o.date,
        Cliente: o.customerName,
        Tipo_Cliente: o.customerType,
        Canal: o.channelName,
        Entrega: o.deliveryMethod,
        Productos: o.productsSummary,
        Sabores: o.flavorsSummary,
        Cantidad: o.quantity,
        Subtotal: round2(o.subtotal),
        Descuento: round2(o.discount),
        Envio: round2(o.shipping),
        Cargos_Extra: round2(o.extraCharges),
        Total_Venta: round2(o.total),
        Costo_Estimado: round2(o.estimatedCost),
        Ganancia_Neta: round2(o.netProfit),
        Estado_Pago: o.paymentStatus,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Detalle Pedidos');

    XLSX.writeFile(wb, `Reporte_Anual_${data.year}.xlsx`);
}

export async function exportAnnualReportPDF(data: AnnualReportData) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);

    const doc = new jsPDF();
    const s = data.summary;

    const getLastY = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ((doc as any).lastAutoTable?.finalY as number | undefined) ?? 30;
    };

    const ensureSpace = (needed = 45) => {
        if (getLastY() + needed > 270) {
            doc.addPage();
            return 20;
        }
        return getLastY() + 12;
    };

    // Header
    doc.setFontSize(18);
    doc.text(`Reporte Anual de Negocio — ${data.year}`, 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generado: ${data.generatedAt} | Solo pedidos entregados (excepto tasa de cancelación)`, 14, 24);
    doc.setTextColor(0);

    // 1. Resumen Ejecutivo
    autoTable(doc, {
        startY: 30,
        head: [['Indicador Clave', 'Valor', 'Indicador Clave', 'Valor']],
        body: [
            ['Ventas Totales', fmtMoney(s.totalSales), 'Pedidos Entregados', String(s.deliveredCount)],
            ['Costos Estimados', fmtMoney(s.totalEstimatedCost), 'Cancelados', `${s.cancelledCount} (${fmtPct(s.cancellationRate)})`],
            ['Ganancia Neta', fmtMoney(s.netProfit), 'Ticket Promedio', fmtMoney(s.avgTicket)],
            ['Margen Neto', fmtPct(s.marginPercent), 'Clientes Activos', `${s.uniqueCustomers} (${s.newCustomers} nuevos)`],
            ['Tasa de Recompra', fmtPct(s.repeatPurchaseRate), `YoY vs ${data.year - 1}`, s.yoySalesGrowthPercent !== null ? fmtPct(s.yoySalesGrowthPercent) : 'N/A'],
            ['Mejor Mes', `${s.bestMonthName} (${fmtMoney(s.bestMonthSales)})`, 'Mejor Día', `${s.bestDayName} (${fmtMoney(s.bestDaySales)})`],
        ],
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [219, 39, 119] },
    });

    // 2. Temporalidad Mensual
    let y = ensureSpace(65);
    doc.setFontSize(12);
    doc.text('1. Temporalidad Mensual', 14, y);
    autoTable(doc, {
        startY: y + 4,
        head: [['Mes', 'Pedidos', 'Clientes', 'Ventas', 'Ganancia', 'Margen', 'Ticket Prom.', '% Año']],
        body: data.monthly.map(m => [
            m.monthName,
            m.ordersCount,
            m.uniqueCustomers,
            fmtMoney(m.sales),
            fmtMoney(m.netProfit),
            fmtPct(m.marginPercent),
            fmtMoney(m.avgTicket),
            fmtPct(m.sharePercent),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
    });

    // 3. Días de Semana y Entrega
    y = ensureSpace(60);
    doc.setFontSize(12);
    doc.text('2. Ventas por Día de la Semana y Logística', 14, y);
    autoTable(doc, {
        startY: y + 4,
        head: [['Día', 'Pedidos', 'Ventas', 'Ticket Prom.', '% Ventas']],
        body: data.byDayOfWeek.map(d => [
            d.name,
            d.ordersCount,
            fmtMoney(d.sales),
            fmtMoney(d.avgTicket || 0),
            fmtPct(d.sharePercent),
        ]),
        styles: { fontSize: 8 },
    });

    y = ensureSpace(35);
    autoTable(doc, {
        startY: y,
        head: [['Método de Entrega', 'Pedidos', 'Ventas', 'Ticket Prom.', '% Ventas']],
        body: data.byDeliveryMethod.map(d => [
            d.name,
            d.ordersCount,
            fmtMoney(d.sales),
            fmtMoney(d.avgTicket || 0),
            fmtPct(d.sharePercent),
        ]),
        styles: { fontSize: 8 },
    });

    // 4. Productos y Sabores
    y = ensureSpace(55);
    doc.setFontSize(12);
    doc.text('3. Desempeño de Productos y Sabores', 14, y);
    autoTable(doc, {
        startY: y + 4,
        head: [['Producto', 'Unidades', 'Ventas', 'Costo Est.', 'Ganancia', 'Margen', '% Ventas']],
        body: data.byProduct.slice(0, 15).map(p => [
            p.name,
            p.unitsSold || 0,
            fmtMoney(p.sales),
            fmtMoney(p.estimatedCost || 0),
            fmtMoney(p.netProfit || 0),
            fmtPct(p.marginPercent || 0),
            fmtPct(p.sharePercent),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
    });

    y = ensureSpace(45);
    autoTable(doc, {
        startY: y,
        head: [['Sabor', 'Unidades', 'Pedidos', 'Ventas', '% Ventas']],
        body: data.byFlavor.slice(0, 12).map(f => [
            f.name,
            f.unitsSold || 0,
            f.ordersCount,
            fmtMoney(f.sales),
            fmtPct(f.sharePercent),
        ]),
        styles: { fontSize: 8 },
    });

    // 5. Canales y B2B vs B2C
    y = ensureSpace(55);
    doc.setFontSize(12);
    doc.text('4. Segmentos (B2B vs B2C) y Canales de Venta', 14, y);
    autoTable(doc, {
        startY: y + 4,
        head: [['Segmento', 'Clientes', 'Pedidos', 'Ventas', 'Ticket Prom.', '% Ventas']],
        body: data.byCustomerType.map(c => [
            c.name,
            c.uniqueCustomers || 0,
            c.ordersCount,
            fmtMoney(c.sales),
            fmtMoney(c.avgTicket || 0),
            fmtPct(c.sharePercent),
        ]),
        styles: { fontSize: 8 },
    });

    y = ensureSpace(40);
    autoTable(doc, {
        startY: y,
        head: [['Canal de Venta', 'Pedidos', 'Ventas', 'Ticket Prom.', '% Ventas']],
        body: data.byChannel.map(c => [
            c.name,
            c.ordersCount,
            fmtMoney(c.sales),
            fmtMoney(c.avgTicket || 0),
            fmtPct(c.sharePercent),
        ]),
        styles: { fontSize: 8 },
    });

    // 6. Demografía (Género, Edad, Zonas)
    y = ensureSpace(55);
    doc.setFontSize(12);
    doc.text('5. Demografía de Compradores (Género, Edad y Zonas)', 14, y);
    autoTable(doc, {
        startY: y + 4,
        head: [['Género', 'Clientes', 'Pedidos', 'Ventas', 'Ticket Prom.', '% Ventas']],
        body: data.byGender.map(g => [
            g.name,
            g.uniqueCustomers || 0,
            g.ordersCount,
            fmtMoney(g.sales),
            fmtMoney(g.avgTicket || 0),
            fmtPct(g.sharePercent),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [236, 72, 153] },
    });

    y = ensureSpace(40);
    autoTable(doc, {
        startY: y,
        head: [['Rango de Edad', 'Clientes', 'Ventas', '% Ventas']],
        body: data.byAgeBucket.map(a => [
            a.name,
            a.uniqueCustomers || 0,
            fmtMoney(a.sales),
            fmtPct(a.sharePercent),
        ]),
        styles: { fontSize: 8 },
    });

    // 7. Top Clientes
    y = ensureSpace(60);
    doc.setFontSize(12);
    doc.text('6. Top 15 Clientes del Año', 14, y);
    autoTable(doc, {
        startY: y + 4,
        head: [['#', 'Cliente', 'Tipo', 'Gén.', 'Pedidos', 'Gasto Total', 'Ticket Prom.', 'Últ. Compra']],
        body: data.topCustomers.slice(0, 15).map((c, idx) => [
            idx + 1,
            c.name,
            c.type,
            c.gender,
            c.ordersCount,
            fmtMoney(c.totalSpent),
            fmtMoney(c.avgTicket),
            c.lastOrderDate,
        ]),
        styles: { fontSize: 8 },
    });

    doc.save(`Reporte_Anual_${data.year}.pdf`);
}
