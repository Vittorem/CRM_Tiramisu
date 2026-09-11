import { useState, useRef, ReactNode } from 'react';
import { Table, Button, Drawer, Form, Switch, Space, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../../hooks/useFirestore';
import { BaseEntity } from '../../../types';

interface CatalogTableProps<T> {
    title: string;
    collectionName: string;
    columns?: ColumnsType<T>;
    renderFormFields: () => ReactNode;
}

export function CatalogTable<T extends BaseEntity & { isActive: boolean }>({
    title,
    collectionName,
    columns = [],
    renderFormFields,
}: CatalogTableProps<T>) {
    const { data, loading } = useFirestoreSubscription<T>(collectionName);
    const { add, update, softDelete } = useFirestoreMutation(collectionName);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const isSubmittingRef = useRef(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form] = Form.useForm();
    const isMobile = window.innerWidth < 768; // Quick check for mobile

    const handleAdd = () => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({ isActive: true });
        setIsModalVisible(true);
    };

    const handleEdit = (record: T) => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setEditingItem(record);
        form.setFieldsValue(record);
        setIsModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await softDelete(id);
            message.success('Elemento eliminado');
        } catch {
            message.error('Error al eliminar');
        }
    };

    const handleOk = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            const values = await form.validateFields();
            if (editingItem) {
                await update(editingItem.id, values);
                message.success('Actualizado correctamente');
            } else {
                await add(values);
                message.success('Creado correctamente');
            }
            setIsModalVisible(false);
        } catch (error) {
            console.error(error);
            message.error('Error al guardar');
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const allColumns: ColumnsType<T> = [
        ...columns,
        {
            title: 'Estado',
            dataIndex: 'isActive',
            width: 100,
            render: (active: boolean) => (
                <span style={{ color: active ? 'green' : 'gray' }}>
                    {active ? 'Activo' : 'Inactivo'}
                </span>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
                    <Popconfirm title="¿Eliminar?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3>{title}</h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Nuevo
                </Button>
            </div>

            <Table
                dataSource={data}
                columns={allColumns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />

            <Drawer
                title={editingItem ? `Editar ${title}` : `Nuevo ${title}`}
                open={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                destroyOnClose
                placement={isMobile ? 'bottom' : 'right'}
                width={isMobile ? '100%' : 500}
                height={isMobile ? '90vh' : '100%'}
                extra={
                    <Space>
                        <Button onClick={() => setIsModalVisible(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="primary" onClick={handleOk} loading={isSubmitting} disabled={isSubmitting}>Guardar</Button>
                    </Space>
                }
            >
                <Form form={form} layout="vertical">
                    {renderFormFields()}
                    <Form.Item name="isActive" label="Activo" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Drawer>
        </div>
    );
}
