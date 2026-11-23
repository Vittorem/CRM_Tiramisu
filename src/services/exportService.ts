import dayjs from 'dayjs';
import { Order, Customer, Recipe, Ingredient, Product, Flavor } from '../types';
import { getOrderDate } from '../utils/dateHelpers';
import { calculateOrderEstimatedCost } from '../utils/costHelpers';
import { DemographicResult } from '../utils/demographicsHelpers';

function escapeXml(value: string | number | undefined | null): string {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeCdata(value: string | undefined | null): string {
    return (value || '').replace(/]]>/g, ']]]]><![CDATA[>');
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export async function exportOrdersExcel(
    orders: Order[],
    customers: Customer[],
    recipes: Recipe[],
    ingredients: Ingredient[]
) {
    const XLSX = await import('xlsx');

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

export async function exportOrdersPDF(
    orders: Order[],
    dateRange: [dayjs.Dayjs, dayjs.Dayjs],
    recipes: Recipe[],
    ingredients: Ingredient[]
) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);

    const doc = new jsPDF();
    doc.text(
        `Reporte de Corte - ${dateRange[0].format('DD/MM/YYYY')} al ${dateRange[1].format('DD/MM/YYYY')}`,
        14,
        20
    );

    const totalSales = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalCosts = orders.reduce((acc, curr) => acc + calculateOrderEstimatedCost(curr, recipes, ingredients), 0);
    const netProfit = totalSales - totalCosts;
    const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : 0;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Pedidos Entregados: ${orders.length}`, 14, 28);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Ventas Brutas: $${totalSales.toFixed(2)}`, 14, 35);
    doc.setTextColor(220, 38, 38);
    doc.text(`Costos Operativos: $${totalCosts.toFixed(2)}`, 60, 35);
    doc.setTextColor(22, 163, 74);
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
            `$${(o.total || 0).toFixed(2)}`,
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
        xmlContent += `    <id>${escapeXml(c.id)}</id>\n`;
        xmlContent += `    <nombre>${escapeXml(c.fullName)}</nombre>\n`;
        xmlContent += `    <telefono>${escapeXml(c.phone)}</telefono>\n`;
        xmlContent += `    <tipo>${escapeXml(c.type)}</tipo>\n`;
        xmlContent += `    <medioContacto>${escapeXml(c.mainContactMethod)}</medioContacto>\n`;
        xmlContent += `    <email>${escapeXml(c.email)}</email>\n`;
        xmlContent += `    <genero>${escapeXml(c.gender)}</genero>\n`;
        xmlContent += `    <edad>${escapeXml(c.age)}</edad>\n`;
        xmlContent += `    <estadoCivil>${escapeXml(c.civilStatus)}</estadoCivil>\n`;
        xmlContent += `    <ocupacion>${escapeXml(c.occupation)}</ocupacion>\n`;
        xmlContent += `    <instagram>${escapeXml(c.instagramHandle)}</instagram>\n`;
        xmlContent += `    <facebook>${escapeXml(c.facebookLink)}</facebook>\n`;
        xmlContent += `    <colonia>${escapeXml(c.colonia)}</colonia>\n`;
        xmlContent += `    <ciudad>${escapeXml(c.city)}</ciudad>\n`;
        xmlContent += `    <notas><![CDATA[${escapeCdata(c.notes)}]]></notas>\n`;
        xmlContent += `    <etiquetas>${escapeXml((c.tags || []).join(', '))}</etiquetas>\n`;
        xmlContent += `    <gastoTotal>${c.totalSpent || 0}</gastoTotal>\n`;
        xmlContent += '  </cliente>\n';
    });

    xmlContent += '</clientes>';
    downloadBlob(xmlContent, 'application/xml', `Clientes_Reposteria_${dayjs().format('YYYYMMDD')}.xml`);
}

// ─── Demographics Exports ─────────────────────────────────────────────────────

export async function exportDemographicsPDF(
    demographics: DemographicResult,
    dateRange: [dayjs.Dayjs, dayjs.Dayjs]
) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);

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
        xml += `    <item><tipo>${escapeXml(d.name)}</tipo><cantidad>${d.value}</cantidad></item>\n`;
    });
    xml += '  </genero>\n';

    xml += '  <edades>\n';
    demographics.ageData.forEach(d => {
        xml += `    <item><rango><![CDATA[${escapeCdata(d.name)}]]></rango><cantidad>${d.value}</cantidad></item>\n`;
    });
    xml += '  </edades>\n';

    xml += '  <ocupaciones>\n';
    demographics.topOccupations.forEach(item => {
        xml += `    <item><nombre><![CDATA[${escapeCdata(item.name)}]]></nombre><cantidad>${item.value}</cantidad></item>\n`;
    });
    xml += '  </ocupaciones>\n';

    xml += '</demografia>';
    downloadBlob(xml, 'application/xml', `Demografia_Insights_${dayjs().format('YYYYMMDD')}.xml`);
}

// ─── Ingredients XML Export & Import ──────────────────────────────────────────

export interface ParsedIngredientXML {
    id?: string;
    name: string;
    unit: string;
    cost_unit: number;
}

export function exportIngredientsXML(ingredients: Ingredient[]) {
    const sorted = [...ingredients].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ingredientes>\n';

    sorted.forEach(ing => {
        xml += '  <ingrediente>\n';
        xml += `    <id>${escapeXml(ing.id)}</id>\n`;
        xml += `    <nombre>${escapeXml(ing.name)}</nombre>\n`;
        xml += `    <unidad>${escapeXml(ing.unit)}</unidad>\n`;
        xml += `    <costoUnitario>${Number(ing.cost_unit || 0)}</costoUnitario>\n`;
        xml += '  </ingrediente>\n';
    });

    xml += '</ingredientes>';
    downloadBlob(xml, 'application/xml', `Insumos_Recetario_${dayjs().format('YYYYMMDD')}.xml`);
}

export function parseIngredientsXML(xmlText: string): ParsedIngredientXML[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error('El archivo XML tiene un formato inválido.');
    }

    const nodes = Array.from(
        xmlDoc.querySelectorAll('ingrediente, ingredient, item')
    );

    if (nodes.length === 0) {
        throw new Error('No se encontraron nodos <ingrediente> en el archivo XML.');
    }

    const getTagText = (parent: Element, selectors: string[]): string => {
        for (const sel of selectors) {
            const el = parent.querySelector(sel);
            if (el && el.textContent !== null) {
                return el.textContent.trim();
            }
            const attr = parent.getAttribute(sel);
            if (attr !== null) {
                return attr.trim();
            }
        }
        return '';
    };

    const parsed: ParsedIngredientXML[] = [];

    nodes.forEach(node => {
        const id = getTagText(node, ['id']);
        const name = getTagText(node, ['nombre', 'name']);
        const unit = getTagText(node, ['unidad', 'unit']) || 'Kg';
        const costRaw = getTagText(node, ['costoUnitario', 'costo_unitario', 'cost_unit', 'costo', 'cost']);
        const cleanCost = Number(costRaw.replace(/[$,\s]/g, ''));

        if (!name) return;

        parsed.push({
            ...(id ? { id } : {}),
            name,
            unit,
            cost_unit: Number.isFinite(cleanCost) && cleanCost >= 0 ? cleanCost : 0,
        });
    });

    if (parsed.length === 0) {
        throw new Error('No se encontraron ingredientes válidos con nombre en el XML.');
    }

    return parsed;
}

// ─── Recipes Export (Excel Cost vs Price Analysis & XML) ──────────────────────

interface ComputedRecipeRow {
    recipe: Recipe;
    productName: string;
    flavorName: string;
    salePrice: number | null;
    totalCost: number;
    costPerServing: number;
    profitPerServing: number | null;
    marginPercent: number | null;
    markup: number | null;
    breakdown: {
        name: string;
        qty: number;
        unit: string;
        costUnit: number;
        totalCost: number;
        costSharePercent: number;
    }[];
}

function buildRecipesCostAnalysis(
    recipes: Recipe[],
    ingredients: Ingredient[],
    products: Product[],
    flavors: Flavor[]
): ComputedRecipeRow[] {
    const ingredientMap = new Map(ingredients.map(i => [i.id, i]));
    const productMap = new Map(products.map(p => [p.id, p]));
    const flavorMap = new Map(flavors.map(f => [f.id, f]));

    const sorted = [...recipes].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return sorted.map(recipe => {
        const linkedProduct = recipe.linkedProductId ? productMap.get(recipe.linkedProductId) : undefined;
        const linkedFlavor = recipe.linkedFlavorId ? flavorMap.get(recipe.linkedFlavorId) : undefined;

        let totalCost = 0;
        const rawBreakdown = (recipe.ingredients || []).map(ri => {
            const ing = ingredientMap.get(ri.ingredientId);
            const qty = Number(ri.qty || 0);
            const costUnit = Number(ing?.cost_unit || 0);
            const itemCost = qty * costUnit;
            totalCost += itemCost;
            return {
                name: ing?.name || 'Desconocido',
                qty,
                unit: ri.unit || ing?.unit || '',
                costUnit,
                totalCost: itemCost,
            };
        });

        const breakdown = rawBreakdown.map(b => ({
            ...b,
            costSharePercent: totalCost > 0 ? (b.totalCost / totalCost) * 100 : 0,
        }));

        const servings = recipe.servings_default > 0 ? recipe.servings_default : 1;
        const costPerServing = totalCost / servings;
        const salePrice = linkedProduct && typeof linkedProduct.price === 'number' ? linkedProduct.price : null;
        const profitPerServing = salePrice !== null ? salePrice - costPerServing : null;
        const marginPercent =
            salePrice !== null && salePrice > 0 && profitPerServing !== null
                ? (profitPerServing / salePrice) * 100
                : null;
        const markup =
            salePrice !== null && costPerServing > 0 ? salePrice / costPerServing : null;

        return {
            recipe,
            productName: linkedProduct?.name || 'Sin vincular',
            flavorName: linkedFlavor?.name || 'N/A',
            salePrice,
            totalCost,
            costPerServing,
            profitPerServing,
            marginPercent,
            markup,
            breakdown,
        };
    });
}

export async function exportRecipesExcel(
    recipes: Recipe[],
    ingredients: Ingredient[],
    products: Product[],
    flavors: Flavor[]
) {
    const XLSX = await import('xlsx');
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const computed = buildRecipesCostAnalysis(recipes, ingredients, products, flavors);

    const summaryRows = computed.map(row => ({
        Receta: row.recipe.name,
        Tipo: row.recipe.is_variant ? 'Variante' : 'Base',
        Producto_Vinculado: row.productName,
        Sabor_Vinculado: row.flavorName,
        Porciones: row.recipe.servings_default || 1,
        Num_Ingredientes: row.breakdown.length,
        Costo_Total_Receta: round2(row.totalCost),
        Costo_Por_Porcion: round2(row.costPerServing),
        Precio_Venta_Catalogo: row.salePrice !== null ? round2(row.salePrice) : 'Sin precio',
        Ganancia_Por_Porcion: row.profitPerServing !== null ? round2(row.profitPerServing) : 'N/A',
        Margen_Pct: row.marginPercent !== null ? `${row.marginPercent.toFixed(1)}%` : 'N/A',
        Multiplicador_Precio_Costo: row.markup !== null ? `${row.markup.toFixed(2)}x` : 'N/A',
    }));

    const detailRows = computed.flatMap(row =>
        row.breakdown.map(b => ({
            Receta: row.recipe.name,
            Porciones: row.recipe.servings_default || 1,
            Ingrediente: b.name,
            Cantidad: round2(b.qty),
            Unidad: b.unit,
            Costo_Unitario: round2(b.costUnit),
            Costo_En_Receta: round2(b.totalCost),
            Peso_En_Costo_Pct: `${b.costSharePercent.toFixed(1)}%`,
        }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Costos vs Precios');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Desglose Ingredientes');
    XLSX.writeFile(wb, `Recetas_Costos_Precios_${dayjs().format('YYYYMMDD')}.xlsx`);
}

export function exportRecipesXML(
    recipes: Recipe[],
    ingredients: Ingredient[],
    products: Product[],
    flavors: Flavor[]
) {
    const computed = buildRecipesCostAnalysis(recipes, ingredients, products, flavors);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<recetas>\n';

    computed.forEach(row => {
        xml += '  <receta>\n';
        xml += `    <id>${escapeXml(row.recipe.id)}</id>\n`;
        xml += `    <nombre>${escapeXml(row.recipe.name)}</nombre>\n`;
        xml += `    <esVariante>${row.recipe.is_variant ? 'true' : 'false'}</esVariante>\n`;
        xml += `    <porciones>${row.recipe.servings_default || 1}</porciones>\n`;
        xml += `    <productoVinculado>${escapeXml(row.productName)}</productoVinculado>\n`;
        xml += `    <saborVinculado>${escapeXml(row.flavorName)}</saborVinculado>\n`;
        xml += `    <costoTotal>${row.totalCost.toFixed(2)}</costoTotal>\n`;
        xml += `    <costoPorPorcion>${row.costPerServing.toFixed(2)}</costoPorPorcion>\n`;
        xml += `    <precioVenta>${row.salePrice !== null ? row.salePrice.toFixed(2) : ''}</precioVenta>\n`;
        xml += `    <gananciaPorPorcion>${row.profitPerServing !== null ? row.profitPerServing.toFixed(2) : ''}</gananciaPorPorcion>\n`;
        xml += `    <margenPorcentaje>${row.marginPercent !== null ? row.marginPercent.toFixed(1) : ''}</margenPorcentaje>\n`;
        xml += '    <ingredientes>\n';
        row.breakdown.forEach(b => {
            xml += '      <ingrediente>\n';
            xml += `        <nombre>${escapeXml(b.name)}</nombre>\n`;
            xml += `        <cantidad>${b.qty}</cantidad>\n`;
            xml += `        <unidad>${escapeXml(b.unit)}</unidad>\n`;
            xml += `        <costoUnitario>${b.costUnit.toFixed(2)}</costoUnitario>\n`;
            xml += `        <costoTotal>${b.totalCost.toFixed(2)}</costoTotal>\n`;
            xml += `        <pesoEnCostoPorcentaje>${b.costSharePercent.toFixed(1)}</pesoEnCostoPorcentaje>\n`;
            xml += '      </ingrediente>\n';
        });
        xml += '    </ingredientes>\n';
        xml += '  </receta>\n';
    });

    xml += '</recetas>';
    downloadBlob(xml, 'application/xml', `Recetas_Costos_Precios_${dayjs().format('YYYYMMDD')}.xml`);
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
