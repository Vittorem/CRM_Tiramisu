import { useState, useMemo } from 'react';
import { Button, Modal, Form, Input, InputNumber, Select, Typography, Popconfirm, message, Table, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../../hooks/useFirestore';
import { Ingredient, Recipe } from '../../../types';

const { Title } = Typography;

export const IngredientsPanel = () => {
    const { token: { colorBgContainer, colorBorderSecondary, colorText, colorTextSecondary } } = theme.useToken();
    const { data: ingredients, loading } = useFirestoreSubscription<Ingredient>('ingredients');
    const { data: recipes } = useFirestoreSubscription<Recipe>('recipes'); // Need this to validate deletion
    const { add, update, softDelete } = useFirestoreMutation<Ingredient>('ingredients');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [searchText, setSearchText] = useState('');

    const handleOpenModal = (ingredient?: Ingredient) => {
        if (ingredient) {
            setEditingIngredient(ingredient);
            form.setFieldsValue(ingredient);
        } else {
            setEditingIngredient(null);
            form.resetFields();
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingIngredient(null);
        form.resetFields();
    };

    const handleSubmit = async (values: any) => {
        try {
            setSubmitting(true);
            if (editingIngredient) {
                await update(editingIngredient.id, values);
                message.success('Ingrediente actualizado crrectamente');
            } else {
                await add(values);
                message.success('Ingrediente creado correctamente');
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving ingredient:', error);
            message.error('Error al guardar el ingrediente');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (ingredient: Ingredient) => {
        // Validate if ingredient is used in any recipe
        const isUsed = recipes?.some(recipe =>
            recipe.ingredients?.some(ri => ri.ingredientId === ingredient.id)
        );

        if (isUsed) {
            message.error('No se puede eliminar porque este ingrediente está siendo usado en una o más recetas.');
            return;
        }

        try {
            await softDelete(ingredient.id);
            message.success('Ingrediente eliminado');
        } catch (error) {
            console.error('Error deleting ingredient:', error);
            message.error('Error al eliminar el ingrediente');
        }
    };

    const filteredIngredients = useMemo(() => {
        const lowerSearch = searchText.toLowerCase();
        return [...(ingredients || [])]
            .filter(ing => ing.name.toLowerCase().includes(lowerSearch))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [ingredients, searchText]);

    const columns = [
        {
            title: 'Ingrediente',
            dataIndex: 'name',
            key: 'name',
            sorter: (a: Ingredient, b: Ingredient) => a.name.localeCompare(b.name),
            render: (text: string) => <span style={{ fontWeight: 600, color: colorText }}>{text}</span>
        },
        {
            title: 'Costo Unitario',
            key: 'cost',
            render: (_: any, record: Ingredient) => (
                <span style={{ color: colorTextSecondary }}>
                    ${(record.cost_unit || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            title: 'Por',
            dataIndex: 'unit',
            key: 'unit',
            render: (text: string) => <span style={{ color: colorTextSecondary, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.05em' }}>{text}</span>
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            render: (_: any, record: Ingredient) => (
                <div className="flex gap-1 justify-end">
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        className="text-gray-400 hover:text-blue-500 px-1"
                        onClick={() => handleOpenModal(record)}
                    />
                    <Popconfirm
                        title="¿Eliminar ingrediente?"
                        description="Esta acción no se puede deshacer."
                        onConfirm={() => handleDelete(record)}
                        okText="Sí"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            className="text-gray-400 hover:text-red-500 px-1"
                        />
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div className="rounded-2xl p-4 md:p-6 shadow-sm border h-full flex flex-col" style={{ background: colorBgContainer, borderColor: colorBorderSecondary }}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
                <Title level={5} style={{ margin: 0 }}>Catálogo de Insumos</Title>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <Input.Search 
                        placeholder="Buscar ingrediente..." 
                        allowClear 
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full sm:w-64"
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-green-500 hover:bg-green-600 border-none rounded w-full sm:w-auto shadow-sm">
                        Nuevo Insumo
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto pr-2 custom-scrollbar">
                <Table 
                    columns={columns} 
                    dataSource={filteredIngredients} 
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 50 }}
                    size="small"
                    className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden compact-cell-table"
                />
            </div>

            <Modal
                title={editingIngredient ? "Editar Ingrediente" : "Nuevo Ingrediente"}
                open={isModalOpen}
                onCancel={handleCloseModal}
                onOk={() => form.submit()}
                confirmLoading={submitting}
                okText="Guardar"
                cancelText="Cancelar"
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
                    <Form.Item
                        name="name"
                        label="Nombre del Ingrediente"
                        rules={[{ required: true, message: 'Por favor ingrese el nombre' }]}
                    >
                        <Input placeholder="Ej. Azúcar, Harina, Café" />
                    </Form.Item>

                    <div className="flex gap-4">
                        <Form.Item
                            name="cost_unit"
                            label="Costo"
                            className="flex-1"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <InputNumber
                                className="w-full"
                                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0}
                                min={0 as number}
                                step={0.01}
                            />
                        </Form.Item>

                        <Form.Item
                            name="unit"
                            label="Unidad de medida"
                            className="w-1/3"
                            rules={[{ required: true, message: 'Requerido' }]}
                            initialValue="Kg"
                        >
                            <Select>
                                <Select.Option value="Kg">Kilo</Select.Option>
                                <Select.Option value="g">Gramo</Select.Option>
                                <Select.Option value="L">Litro</Select.Option>
                                <Select.Option value="ml">Mililitro</Select.Option>
                                <Select.Option value="Pieza">Pieza</Select.Option>
                                <Select.Option value="Paquete">Paquete</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};
