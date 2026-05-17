import { useState, useMemo } from 'react';
import { Button, InputNumber, Typography, Table, Input, message } from 'antd';
import { CloseOutlined, FilePdfOutlined, DownloadOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useFirestoreSubscription } from '../../../hooks/useFirestore';
import { Recipe, Ingredient } from '../../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface RecipeDetailPanelProps {
    recipe: Recipe;
    onClose: () => void;
}

export const RecipeDetailPanel = ({ recipe, onClose }: RecipeDetailPanelProps) => {
    const { data: ingredients } = useFirestoreSubscription<Ingredient>('ingredients');
    const [desiredServings, setDesiredServings] = useState<number>(recipe.servings_default);
    const [clientName, setClientName] = useState('');
    const [salePricePerServing, setSalePricePerServing] = useState<number>(0);

    // Update whenever recipe changes
    useMemo(() => {
        setDesiredServings(recipe.servings_default);
    }, [recipe.id, recipe.servings_default]);

    const ratio = recipe.servings_default > 0 ? desiredServings / recipe.servings_default : 1;

    // Calculate scaled ingredients and total cost
    const scaledData = useMemo(() => {
        if (!ingredients || !recipe.ingredients) return { items: [], totalCost: 0 };
        
        let totalCost = 0;
        const items = recipe.ingredients.map(ri => {
            const ingredient = ingredients.find(ing => ing.id === ri.ingredientId);
            const scaledQty = ri.qty * ratio;
            const itemCost = ingredient ? (ingredient.cost_unit * scaledQty) : 0;
            totalCost += itemCost;
            
            return {
                key: ri.ingredientId,
                name: ingredient ? ingredient.name : 'Desconocido',
                qty: scaledQty,
                unit: ri.unit || ingredient?.unit || '',
                costUnit: ingredient?.cost_unit || 0,
                itemCost
            };
        });

        return { items, totalCost };
    }, [recipe, ingredients, ratio]);

    const generatePDF = () => {
        if (!clientName) {
            message.warning('Por favor ingresa un nombre de cliente para la cotización.');
            return;
        }

        if (!salePricePerServing || salePricePerServing <= 0) {
            message.warning('Por favor ingresa un precio de venta mayor a 0 para generar la cotización.');
            return;
        }

        const doc = new jsPDF();
        const dateStr = dayjs().format('DD/MM/YYYY');
        const totalQuoteAmount = desiredServings * salePricePerServing;

        // Header
        doc.setFontSize(20);
        doc.text('Cotización Comercial', 14, 22);
        
        doc.setFontSize(12);
        doc.text(`Cliente: ${clientName}`, 14, 32);
        doc.text(`Fecha: ${dateStr}`, 14, 38);
        
        doc.setFontSize(14);
        doc.text(`Concepto: ${recipe.name}`, 14, 50);

        // Commercial Table
        const tableData = [
            [
                recipe.name, 
                desiredServings.toString(), 
                `$${salePricePerServing.toFixed(2)}`, 
                `$${totalQuoteAmount.toFixed(2)}`
            ]
        ];

        autoTable(doc, {
            startY: 55,
            head: [['Artículo/Concepto', 'Porciones', 'Precio Unitario', 'Importe']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [212, 163, 115] } // Brand primary color (warm caramel)
        });

        // Summary
        const finalY = (doc as any).lastAutoTable.finalY || 65;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Gran Total: $${totalQuoteAmount.toFixed(2)}`, 14, finalY + 15);

        doc.save(`Cotizacion_${recipe.name.replace(/\s+/g, '_')}_${dateStr}.pdf`);
        message.success('Cotización en PDF generada exitosamente');
    };

    const handleExportJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recipe, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Receta_${recipe.name.replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        message.success('Receta exportada a JSON');
    };

    const columns = [
        {
            title: 'Ingrediente',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold text-gray-700 dark:text-gray-300">{text}</span>
        },
        {
            title: 'Cant.',
            key: 'qty',
            render: (_: any, record: any) => (
                <span>{record.qty.toLocaleString('es-MX', { maximumFractionDigits: 2 })} {record.unit}</span>
            )
        },
        {
            title: 'Costo',
            dataIndex: 'itemCost',
            key: 'itemCost',
            render: (val: number) => <span className="text-gray-600 dark:text-gray-400">${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        }
    ];

    const costPerServing = desiredServings > 0 ? scaledData.totalCost / desiredServings : 0;
    
    // Profit Calculations
    const totalQuoteAmount = desiredServings * salePricePerServing;
    const estimatedTotalProfit = totalQuoteAmount > 0 ? totalQuoteAmount - scaledData.totalCost : 0;
    const estimatedUnitProfit = salePricePerServing > 0 ? salePricePerServing - costPerServing : 0;
    const profitMarginPercent = totalQuoteAmount > 0 ? (estimatedTotalProfit / totalQuoteAmount) * 100 : 0;

    return (
        <div className="bg-white dark:bg-[#1f1f1f] rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-full flex flex-col relative">
            <Button 
                type="text" 
                icon={<CloseOutlined />} 
                onClick={onClose} 
                className="text-gray-400 hover:text-red-500"
                style={{ position: 'absolute', top: 16, right: 16, zIndex: 50 }}
            />
            
            <div className="flex flex-col xl:flex-row justify-between items-start mb-8 pr-0 xl:pr-10 gap-8 xl:gap-4 mt-2">
                <div className="w-full xl:w-auto">
                    <Title level={3} style={{ margin: 0, color: 'inherit' }}>{recipe.name}</Title>
                    <div className="flex items-center gap-3 mt-4">
                        <CalculatorOutlined className="text-gray-400 text-lg" />
                        <Text className="text-base font-medium text-gray-600 dark:text-gray-400">Porciones:</Text>
                        <InputNumber
                            min={1}
                            value={desiredServings}
                            onChange={(val) => setDesiredServings(val || 1)}
                            className="w-24"
                        />
                        <span className="text-sm text-gray-400 ml-2">(Ratio escalar: {ratio.toFixed(2)}x)</span>
                    </div>
                </div>
                
                <div className="flex flex-col sm:items-end gap-5 w-full xl:w-auto">
                    <div className="flex justify-between sm:justify-end gap-6 md:gap-10 text-right bg-orange-50/70 dark:bg-orange-900/10 px-6 py-4 rounded-xl border border-orange-100 dark:border-orange-900/30 w-full sm:w-auto">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Costo Total</div>
                            <div className="text-3xl font-black text-gray-800 dark:text-gray-200 leading-none">
                                ${scaledData.totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="w-px bg-orange-200/50 dark:bg-orange-800/50 my-1"></div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Costo / Porción</div>
                            <div className="text-3xl font-black text-[#bc6c25] dark:text-[#d4a373] leading-none">
                                ${costPerServing.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full xl:w-auto">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input 
                                placeholder="Nombre del Cliente" 
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                className="w-full sm:w-60"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Precio de Venta c/u:</span>
                                <InputNumber
                                    prefix="$"
                                    placeholder="Ej. 45"
                                    min={0}
                                    value={salePricePerServing}
                                    onChange={(val) => setSalePricePerServing(val || 0)}
                                    className="w-full sm:w-32"
                                />
                            </div>
                        </div>

                        {/* Rentabilidad Sugerida (Solo Interno) */}
                        {salePricePerServing > 0 && (
                            <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800/50 mt-1">
                                <div className="text-sm">
                                    <span className="text-green-800 dark:text-green-300 font-semibold">Ganancia Neta: </span>
                                    <span className="text-green-700 dark:text-green-400 font-black">
                                        ${estimatedTotalProfit.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                                        (${estimatedUnitProfit.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} c/u)
                                    </span>
                                </div>
                                <div className="text-sm text-right">
                                    <span className="text-green-800 dark:text-green-300 font-semibold">Margen: </span>
                                    <span className={`font-black ${profitMarginPercent >= 30 ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>
                                        {profitMarginPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex gap-2 w-full mt-2 lg:mt-0">
                            <Button type="primary" icon={<FilePdfOutlined />} onClick={generatePDF} className="bg-[#bc6c25] hover:bg-[#a95c1e] border-none shadow-sm flex-1">
                                Generar Cotización PDF
                            </Button>
                            <Button icon={<DownloadOutlined />} onClick={handleExportJSON} className="flex-none">
                                JSON
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar border border-gray-100 dark:border-gray-800 rounded-lg">
                <Table 
                    dataSource={scaledData.items} 
                    columns={columns} 
                    pagination={false}
                    size="small"
                    scroll={{ y: 'calc(100vh - 350px)' }}
                    className="m-0 compact-cell-table"
                />
            </div>

        </div>
    );
};
