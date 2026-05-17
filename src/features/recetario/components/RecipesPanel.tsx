import { useState, useMemo, useRef } from 'react';
import { Button, Modal, Form, Input, InputNumber, Select, Typography, Spin, Popconfirm, message, Switch, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, UploadOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../../hooks/useFirestore';
import { Recipe, Ingredient, RecipeIngredient, Product, Flavor } from '../../../types';

const { Title } = Typography;

interface RecipesPanelProps {
    onSelectRecipe: (recipe: Recipe) => void;
    selectedRecipeId?: string;
    onClearSelection?: () => void;
}

export const RecipesPanel = ({ onSelectRecipe, selectedRecipeId, onClearSelection }: RecipesPanelProps) => {
    const { data: recipes, loading: recipesLoading } = useFirestoreSubscription<Recipe>('recipes');
    const { data: ingredients, loading: ingredientsLoading } = useFirestoreSubscription<Ingredient>('ingredients');
    const { data: products } = useFirestoreSubscription<Product>('catalog_products');
    const { data: flavors } = useFirestoreSubscription<Flavor>('catalog_flavors');
    const { add, update, softDelete } = useFirestoreMutation<Recipe>('recipes');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [searchText, setSearchText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic cost calculation
    const calculateRecipeCost = (recipe: Recipe) => {
        if (!ingredients || !recipe.ingredients) return 0;
        return recipe.ingredients.reduce((total, ri) => {
            const ingredient = ingredients.find(ing => ing.id === ri.ingredientId);
            if (!ingredient) return total;
            return total + (ingredient.cost_unit * ri.qty);
        }, 0);
    };

    const handleOpenModal = (recipe?: Recipe, isDuplicate = false) => {
        if (recipe) {
            if (isDuplicate) {
                setEditingRecipe(null);
                form.setFieldsValue({
                    ...recipe,
                    name: `${recipe.name} (copia)`,
                    is_variant: true
                });
            } else {
                setEditingRecipe(recipe);
                form.setFieldsValue(recipe);
            }
        } else {
            setEditingRecipe(null);
            form.resetFields();
            form.setFieldsValue({ servings_default: 1, is_variant: false, ingredients: [] });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRecipe(null);
        form.resetFields();
    };

    const handleSubmit = async (values: any) => {
        try {
            setSubmitting(true);
            if (editingRecipe) {
                await update(editingRecipe.id, values);
                message.success('Receta actualizada');
            } else {
                await add(values);
                message.success('Receta creada');
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving recipe:', error);
            message.error('Error al guardar la receta');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (recipe: Recipe) => {
        try {
            await softDelete(recipe.id);
            message.success('Receta eliminada');
            if (selectedRecipeId === recipe.id && onClearSelection) {
                onClearSelection();
            }
        } catch (error) {
            console.error('Error deleting recipe:', error);
            message.error('Error al eliminar la receta');
        }
    };

    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonObj = JSON.parse(event.target?.result as string);
                
                // Validate basic structure
                if (!jsonObj.name || typeof jsonObj.servings_default !== 'number' || !Array.isArray(jsonObj.ingredients)) {
                    message.error('El archivo JSON no tiene el formato válido de una receta.');
                    return;
                }

                // Match ingredients
                const matchedIngredients: RecipeIngredient[] = [];
                const missingIngredients: string[] = [];

                jsonObj.ingredients.forEach((ri: any) => {
                    // Try to match by ID or by Name (if name was somehow exported or if we find a match)
                    let matchedIng = ingredients?.find(i => i.id === ri.ingredientId);
                    
                    // Note: If export didn't have name, it might be hard to match by name, 
                    // but we look it up by ID first.
                    if (!matchedIng && ri.name) {
                        matchedIng = ingredients?.find(i => i.name.toLowerCase() === ri.name?.toLowerCase());
                    }

                    if (matchedIng) {
                        matchedIngredients.push({
                            ingredientId: matchedIng.id,
                            qty: Number(ri.qty) || 0,
                            unit: ri.unit || matchedIng.unit
                        });
                    } else {
                        missingIngredients.push(ri.name || ri.ingredientId || 'Desconocido');
                    }
                });

                if (missingIngredients.length > 0) {
                    message.warning(`Faltan ingredientes que no se pudieron emparejar: ${missingIngredients.join(', ')}. La receta será importada parcialmente.`);
                }

                const newRecipe = {
                    name: `${jsonObj.name} (Importada)`,
                    servings_default: jsonObj.servings_default,
                    is_variant: !!jsonObj.is_variant,
                    ingredients: matchedIngredients
                };

                await add(newRecipe);
                message.success('Receta importada exitosamente');
                
            } catch (err) {
                console.error('JSON parse error:', err);
                message.error('Error al leer o parsear el archivo JSON.');
            } finally {
                // Clear the input so the same file could be imported again if needed
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    const filteredRecipes = useMemo(() => {
        const lowerSearch = searchText.toLowerCase();
        return [...(recipes || [])]
            .filter(r => r.name.toLowerCase().includes(lowerSearch))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [recipes, searchText]);

    const loading = recipesLoading || ingredientsLoading;

    return (
        <div className="bg-white dark:bg-[#1f1f1f] rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-full flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>Recetas y Variantes</Title>
                    <div className="flex gap-2 flex-grow sm:flex-grow-0">
                        <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleImportJSON} 
                        />
                        <Button type="dashed" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} className="flex-1">
                            Importar
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-green-500 hover:bg-green-600 border-none rounded shadow-sm flex-1">
                            Nueva Receta
                        </Button>
                    </div>
                </div>
                <Input.Search 
                    placeholder="Buscar receta..." 
                    allowClear 
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full"
                />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <Spin />
                    </div>
                ) : filteredRecipes.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                        No hay recetas creadas aún.
                    </div>
                ) : (
                    filteredRecipes.map(recipe => {
                        const totalCost = calculateRecipeCost(recipe);
                        const costPerServing = recipe.servings_default > 0 ? totalCost / recipe.servings_default : 0;
                        const isSelected = selectedRecipeId === recipe.id;

                        return (
                            <div 
                                key={recipe.id} 
                                onClick={() => onSelectRecipe(recipe)}
                                className={`p-3 bg-white dark:bg-[#1f1f1f] rounded-lg transition-all cursor-pointer relative group border-2
                                    ${isSelected 
                                        ? 'border-[#db2777] shadow-md bg-pink-50/30 dark:bg-[#db2777]/10 transform scale-[1.01]' 
                                        : 'border-gray-100 dark:border-gray-800 hover:border-[#db2777]/50 hover:shadow-sm'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-semibold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                                        {recipe.name}
                                        {recipe.is_variant && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Variante</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500">{recipe.servings_default} porciones</div>
                                </div>
                                
                                <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">${totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Porción</span>
                                        <span className="font-bold text-[#be185d] text-sm">${costPerServing.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {/* Actions hover overlay */}
                                <div className={`absolute top-2 right-2 flex gap-1 bg-white dark:bg-[#1f1f1f] p-1 rounded-lg border border-gray-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : ''}`} onClick={(e) => e.stopPropagation()}>
                                    <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleOpenModal(recipe, true)} title="Duplicar" />
                                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(recipe)} title="Editar" />
                                    <Popconfirm
                                        title="¿Eliminar receta?"
                                        onConfirm={() => handleDelete(recipe)}
                                        okText="Sí"
                                        cancelText="No"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Eliminar" />
                                    </Popconfirm>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Modal
                title={editingRecipe ? "Editar Receta" : "Nueva Receta"}
                open={isModalOpen}
                onCancel={handleCloseModal}
                onOk={() => form.submit()}
                confirmLoading={submitting}
                okText="Guardar"
                cancelText="Cancelar"
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item name="name" label="Nombre de la Receta" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="Ej. Tiramisú Clásico" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="servings_default" label="Porciones base" rules={[{ required: true, message: 'Requerido' }]}>
                                <InputNumber min={1} className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="linkedProductId" label="Producto Enlazado (Ventas)" tooltip="Selecciona aquí a qué producto de tu catálogo de ventas pertenece esta receta. Ayuda a calcular costos exactos y ganancias netas por pedido.">
                                <Select 
                                    allowClear 
                                    placeholder="Sin enlazar" 
                                    options={products?.filter(p => p.isActive).map(p => ({ value: p.id, label: p.name }))} 
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="linkedFlavorId" label="Sabor Enlazado (Ventas)" tooltip="Si este producto tiene un sabor en específico, elígelo para asegurar que los márgenes de ganancia crucen exactamente con las ventas.">
                                <Select 
                                    allowClear 
                                    placeholder="Sin enlazar" 
                                    options={flavors?.filter(f => f.isActive).map(f => ({ value: f.id, label: f.name }))} 
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item name="is_variant" valuePropName="checked">
                        <Switch checkedChildren="Es variante" unCheckedChildren="Receta original" />
                    </Form.Item>

                    <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">Ingredientes</div>
                    <Form.List name="ingredients">
                        {(fields, { add, remove }) => (
                            <div className="space-y-3 mb-4">
                                {fields.map(({ key, name, ...restField }) => (
                                    <div key={key} className="flex gap-2 items-start bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'ingredientId']}
                                            rules={[{ required: true, message: 'Elige' }]}
                                            className="mb-0 flex-1"
                                        >
                                            <Select
                                                placeholder="Ingrediente"
                                                showSearch
                                                optionFilterProp="children"
                                                filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                                options={ingredients?.map(ing => ({ value: ing.id, label: ing.name, unit: ing.unit })) || []}
                                                onChange={(_, option: any) => {
                                                    form.setFieldValue(['ingredients', name, 'unit'], option.unit);
                                                }}
                                            />
                                        </Form.Item>
                                        
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'qty']}
                                            rules={[{ required: true, message: 'Cant.' }]}
                                            className="mb-0 w-24"
                                        >
                                            <InputNumber min={0.01} step={0.1} placeholder="Cant." className="w-full" />
                                        </Form.Item>

                                        <Form.Item
                                            {...restField}
                                            name={[name, 'unit']}
                                            className="mb-0 w-16"
                                        >
                                            <Input disabled variant="borderless" className="px-1 text-center bg-transparent" />
                                        </Form.Item>

                                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} className="mt-1" />
                                    </div>
                                ))}
                                
                                <Form.Item className="mb-0">
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Añadir Ingrediente
                                    </Button>
                                </Form.Item>
                            </div>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </div>
    );
};
