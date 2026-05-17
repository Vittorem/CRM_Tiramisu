import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, Customer, Recipe, Ingredient } from '../types';
import { getOrderDate } from '../utils/dateHelpers';
import { calculateOrderEstimatedCost } from '../utils/costHelpers';
import { DemographicResult } from '../utils/demographicsHelpers';

// ─── Excel Export ─────────────────────────────────────────────────────────────

export function exportOrdersExcel(orders: Order[], customers: Customer[], recipes: Recipe[], ingredients: Ingredient[]) {
    const ordersData = orders.map(o => {
        const date = getOrderDate(o);
        const productTotal = o.total || 0;
        const estCost = calculateOrderEstimatedCost(o, recipes, ingredients);
        const netProfit = productTotal - estCost;

        return {
            Fecha: date ? date.format('YYYY-MM-DD') : 'N/A',
            Cliente: o.customerName,
            Producto: o.items && o.items.length > 0 ? o.items.map(i => i.productNameAtSale).join(', ') : o.productNameAtSale,
            Sabor: o.items && o.items.length > 0 ? o.items.map(i => i.flavorNameAtSale).join(', ') : o.flavorNameAtSale,
            Cantidad: o.items && o.items.length > 0 ? o.items.reduce((acc, curr) => acc + (curr.quantity || 1), 0) : (o.quantity || 1),
            TotalVenta: productTotal,
            CostoDirecto: estCost,
            GananciaNeta: netProfit,
            MargenPorcentaje: productTotal > 0 ? ((netProfit / productTotal) * 100).toFixed(1) + '%' : '0%',
            Estado: o.status,
        };
    });
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);

    const clientsData = customers.map(c => ({
        Nombre: c.fullName,
        Telefono: c.phone,
        Tipo: c.type,
        GastoTotal: c.totalSpent || 0,
    }));
    const wsClients = XLSX.utils.json_to_sheet(clientsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos');
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clientes');
    XLSX.writeFile(wb, `Reporte_Reposteria_${dayjs().format('YYYYMMDD')}.xlsx`);
}

// ─── PDF Export (Corte de Caja) ───────────────────────────────────────────────

export function exportOrdersPDF(
    orders: Order[],
    dateRange: [dayjs.Dayjs, dayjs.Dayjs],
    recipes: Recipe[],
    ingredients: Ingredient[]
) {
    const doc = new jsPDF();
    doc.text(
        `Reporte de Corte - ${dateRange[0].format('DD/MM/YYYY')} al ${dateRange[1].format('DD/MM/YYYY')}`,
        14,
        20
    );

    const totalSales = orders.reduce((acc, curr) => acc + curr.total, 0);
    const totalCosts = orders.reduce((acc, curr) => acc + calculateOrderEstimatedCost(curr, recipes, ingredients), 0);
    const netProfit = totalSales - totalCosts;
    const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : 0;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Pedidos Entregados: ${orders.length}`, 14, 28);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Ventas Brutas: $${totalSales.toFixed(2)}`, 14, 35);
    doc.setTextColor(220, 38, 38); // Red-ish for costs
    doc.text(`Costos Operativos: $${totalCosts.toFixed(2)}`, 60, 35);
    doc.setTextColor(22, 163, 74); // Green for profit
    doc.text(`Ganancia Neta: $${netProfit.toFixed(2)}  (${profitMargin}%)`, 115, 35);
    doc.setTextColor(0);

    const tableData = orders.map(o => {
        const date = getOrderDate(o);
        const productName = o.items && o.items.length > 0
            ? o.items.map(i => `${i.quantity}x ${i.productNameAtSale}`).join(', ')
            : `${o.productNameAtSale} (${o.flavorNameAtSale})`;
        const qty = o.items && o.items.length > 0 ? o.items.reduce((acc, curr) => acc + (curr.quantity || 1), 0) : (o.quantity || 1);

        return [
            date ? date.format('DD/MM') : 'N/A',
            o.customerName ?? 'N/A',
            productName,
            String(qty),
            `$${o.total}`,
        ];
    });

    autoTable(doc, {
        head: [['Fecha', 'Cliente', 'Producto', 'Qty', 'Total']],
        body: tableData,
        startY: 42,
    });

    doc.save(`Corte_${dayjs().format('YYYYMMDD')}.pdf`);
}

// ─── XML Export (Clientes) ───────────────────────────────────────────────────

export function exportCustomersXML(customers: Customer[]) {
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<clientes>\n';

    customers.forEach(c => {
        xmlContent += '  <cliente>\n';
        xmlContent += `    <id>${c.id}</id>\n`;
        xmlContent += `    <nombre>${c.fullName || ''}</nombre>\n`;
        xmlContent += `    <telefono>${c.phone || ''}</telefono>\n`;
        xmlContent += `    <tipo>${c.type || ''}</tipo>\n`;
        xmlContent += `    <medioContacto>${c.mainContactMethod || ''}</medioContacto>\n`;
        xmlContent += `    <email>${c.email || ''}</email>\n`;
        xmlContent += `    <genero>${c.gender || ''}</genero>\n`;
        xmlContent += `    <edad>${c.age || ''}</edad>\n`;
        xmlContent += `    <estadoCivil>${c.civilStatus || ''}</estadoCivil>\n`;
        xmlContent += `    <ocupacion>${c.occupation || ''}</ocupacion>\n`;
        xmlContent += `    <instagram>${c.instagramHandle || ''}</instagram>\n`;
        xmlContent += `    <facebook>${c.facebookLink || ''}</facebook>\n`;
        xmlContent += `    <colonia>${c.colonia || ''}</colonia>\n`;
        xmlContent += `    <ciudad>${c.city || ''}</ciudad>\n`;
        xmlContent += `    <notas><![CDATA[${c.notes || ''}]]></notas>\n`;
        xmlContent += `    <etiquetas>${(c.tags || []).join(', ')}</etiquetas>\n`;
        xmlContent += `    <gastoTotal>${c.totalSpent || 0}</gastoTotal>\n`;
        xmlContent += '  </cliente>\n';
    });

    xmlContent += '</clientes>';
    downloadBlob(xmlContent, 'application/xml', `Clientes_Reposteria_${dayjs().format('YYYYMMDD')}.xml`);
}

// ─── Demographics Exports ─────────────────────────────────────────────────────

export function exportDemographicsPDF(
    demographics: DemographicResult,
    dateRange: [dayjs.Dayjs, dayjs.Dayjs]
) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Reporte de Demografía (Insights)', 14, 20);
    doc.setFontSize(10);
    doc.text(`Periodo: ${dateRange[0].format('DD/MM/YYYY')} al ${dateRange[1].format('DD/MM/YYYY')}`, 14, 28);
    doc.text(`Clientes que compraron en periodo: ${demographics.totalActive}`, 14, 34);

    let currentY = 45;

    // Gender Table
    doc.setFontSize(12);
    doc.text('Distribución por Género', 14, currentY);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Género', 'Cantidad']],
        body: demographics.genderData.map(d => [d.name, d.value]),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Age Table
    doc.text('Distribución por Edad', 14, currentY);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Rango de Edad', 'Cantidad']],
        body: demographics.ageData.map(d => [d.name, d.value]),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Occupations Table
    doc.text('Top Ocupaciones', 14, currentY);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Ocupación', 'Cantidad']],
        body: demographics.topOccupations.map(t => [t.name, t.value]),
    });

    doc.save(`Demografia_Insights_${dayjs().format('YYYYMMDD')}.pdf`);
}

export function exportDemographicsXML(
    demographics: DemographicResult,
    dateRange: [dayjs.Dayjs, dayjs.Dayjs]
) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<demografia>\n';
    xml += `  <periodo>${dateRange[0].format('YYYY-MM-DD')} al ${dateRange[1].format('YYYY-MM-DD')}</periodo>\n`;
    xml += `  <clientesActivos>${demographics.totalActive}</clientesActivos>\n`;

    xml += '  <genero>\n';
    demographics.genderData.forEach(d => {
        xml += `    <item><tipo>${d.name}</tipo><cantidad>${d.value}</cantidad></item>\n`;
    });
    xml += '  </genero>\n';

    xml += '  <edades>\n';
    demographics.ageData.forEach(d => {
        xml += `    <item><rango><![CDATA[${d.name}]]></rango><cantidad>${d.value}</cantidad></item>\n`;
    });
    xml += '  </edades>\n';

    xml += '  <ocupaciones>\n';
    demographics.topOccupations.forEach(item => {
        xml += `    <item><nombre><![CDATA[${item.name}]]></nombre><cantidad>${item.value}</cantidad></item>\n`;
    });
    xml += '  </ocupaciones>\n';

    xml += '</demografia>';
    downloadBlob(xml, 'application/xml', `Demografia_Insights_${dayjs().format('YYYYMMDD')}.xml`);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function downloadBlob(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
