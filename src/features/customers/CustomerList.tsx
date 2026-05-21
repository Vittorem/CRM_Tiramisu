import { useState } from 'react';
import { Table, Button, Input, Space, Tag, Popconfirm, message, Card, List as AntList, Skeleton, theme } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useFirestoreSubscription, useFirestoreMutation } from '../../hooks/useFirestore';
import { Customer } from '../../types';
import { CustomerForm } from './components/CustomerForm';
import { useIsMobile } from '../../hooks/useIsMobile';

export const CustomerList = () => {
    const { data: customers, loading } = useFirestoreSubscription<Customer>('customers');
    const { add, update, softDelete } = useFirestoreMutation('customers');

    const [searchText, setSearchText] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    const isMobile = useIsMobile();
    const { token: { colorBgContainer, colorBorderSecondary, colorTextSecondary, colorText } } = theme.useToken();

    const handleAdd = () => {
        setEditingCustomer(null);
        setIsDrawerOpen(true);
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await softDelete(id);
            message.success('Cliente eliminado');
        } catch {
            message.error('Error al eliminar');
        }
    };

    const handleSubmit = async (values: Partial<Customer>) => {
        try {
            if (editingCustomer) {
                await update(editingCustomer.id, values);
                message.success('Cliente actualizado');
            } else {
                await add(values);
                message.success('Cliente creado');
            }
            if (navigator.vibrate) navigator.vibrate(50);
        } catch (error) {
            message.error('Error al guardar');
            throw error;
        }
    };

    const filteredData = customers.filter(c =>
        c.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
        c.phone.includes(searchText)
    );

    const columns = [
        {
            title: 'Nombre',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
        },
        {
            title: 'Teléfono',
            dataIndex: 'phone',
            key: 'phone',
        },

        {
            title: 'Contacto',
            dataIndex: 'mainContactMethod',
            key: 'mainContactMethod',
            render: (method: string) => {
                let color = 'default';
                if (method === 'WhatsApp') color = 'green';
                if (method === 'Instagram') color = 'purple';
                if (method === 'Facebook') color = 'blue';
                return <Tag color={color}>{method}</Tag>;
            },
        },
        {
            title: 'Etiquetas',
            dataIndex: 'tags',
            key: 'tags',
            render: (tags?: string[]) => (
                <>
                    {tags?.map(tag => (
                        <Tag key={tag}>{tag}</Tag>
                    ))}
                </>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: unknown, record: Customer) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
                    <Popconfirm title="¿Eliminar cliente?" description="Esto es una eliminación lógica." onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, padding: isMobile ? '0 16px' : 0 }}>
                {!isMobile && <h2>Clientes</h2>}
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ width: isMobile ? '100%' : 'auto' }}>
                    Nuevo Cliente
                </Button>
            </div>

            <Card bodyStyle={{ padding: isMobile ? 0 : 24 }} bordered={!isMobile} style={{ background: isMobile ? 'transparent' : colorBgContainer, boxShadow: 'none' }}>
                <div style={{ marginBottom: 16, padding: isMobile ? '0 16px' : 0 }}>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por nombre o teléfono..."
                        style={{ width: isMobile ? '100%' : 300 }}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
                ) : isMobile ? (
                    <AntList
                        dataSource={filteredData}
                        style={{ background: colorBgContainer }}
                        renderItem={item => (
                            <div style={{ 
                                padding: '12px 16px', 
                                borderBottom: `1px solid ${colorBorderSecondary}`,
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: 4
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: 16, color: colorText }}>{item.fullName}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                    <span style={{ color: colorTextSecondary, fontSize: 14 }}>{item.phone}</span>
                                    <span style={{ fontSize: 12, color: colorTextSecondary }}>{item.mainContactMethod}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                    <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        {item.tags?.map(t => <Tag key={t} style={{ fontSize: 11, padding: '0 4px', margin: '0 4px 0 0' }}>{t}</Tag>)}
                                    </div>
                                    <Space size="middle">
                                        <Button type="text" style={{ padding: 0, color: '#1890ff' }} icon={<EditOutlined />} onClick={() => handleEdit(item)} />
                                        <Popconfirm title="¿Eliminar cliente?" description="Confirmar eliminación lógica." onConfirm={() => handleDelete(item.id)}>
                                            <Button type="text" style={{ padding: 0, color: '#ff4d4f' }} icon={<DeleteOutlined />} danger />
                                        </Popconfirm>
                                    </Space>
                                </div>
                            </div>
                        )}
                    />
                ) : (
                    <Table
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 'max-content' }}
                    />
                )}
            </Card>

            <CustomerForm
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSubmit={handleSubmit}
                initialValues={editingCustomer}
            />
        </div >
    );
};
