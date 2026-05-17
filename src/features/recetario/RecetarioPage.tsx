import { useState } from 'react';
import { Typography, Row, Col, Tabs, Drawer, Empty } from 'antd';
import { useIsMobile } from '../../hooks/useIsMobile';
import { IngredientsPanel } from './components/IngredientsPanel';
import { RecipesPanel } from './components/RecipesPanel';
import { RecipeDetailPanel } from './components/RecipeDetailPanel';
import { Recipe } from '../../types';
import { FileSearchOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export const RecetarioPage = () => {
    const isMobile = useIsMobile();
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
                        Recetario de Postres
                    </Title>
                    <Text type="secondary" className="text-sm md:text-base">
                        Gestión de recetas, inventario y costos con Firebase.
                    </Text>
                </div>
            </div>

            <Tabs
                defaultActiveKey="1"
                className="recetario-tabs"
                items={[
                    {
                        key: '1',
                        label: <span className="text-base px-4">Insumos e Ingredientes</span>,
                        children: (
                            <div className="pt-4">
                                <IngredientsPanel />
                            </div>
                        ),
                    },
                    {
                        key: '2',
                        label: <span className="text-base px-4">Recetas y Cotizaciones</span>,
                        children: (
                            <div className="pt-4">
                                {isMobile ? (
                                    <>
                                        <RecipesPanel 
                                            onSelectRecipe={setSelectedRecipe} 
                                            selectedRecipeId={selectedRecipe?.id} 
                                            onClearSelection={() => setSelectedRecipe(null)}
                                        />
                                        <Drawer
                                            placement="bottom"
                                            height="90%"
                                            onClose={() => setSelectedRecipe(null)}
                                            open={!!selectedRecipe}
                                            styles={{ body: { padding: 0 } }}
                                            closable={false}
                                        >
                                            {selectedRecipe && <RecipeDetailPanel recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />}
                                        </Drawer>
                                    </>
                                ) : (
                                    <Row gutter={[24, 24]}>
                                        <Col xs={24} lg={10} xl={8}>
                                            <RecipesPanel 
                                                onSelectRecipe={setSelectedRecipe} 
                                                selectedRecipeId={selectedRecipe?.id} 
                                                onClearSelection={() => setSelectedRecipe(null)}
                                            />
                                        </Col>
                                        <Col xs={24} lg={14} xl={16}>
                                            {selectedRecipe ? (
                                                <RecipeDetailPanel recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
                                            ) : (
                                                <div className="hidden lg:flex h-full min-h-[500px] flex-col items-center justify-center bg-gray-50/30 dark:bg-[#1f1f1f]/20 rounded-3xl border border-gray-100 dark:border-gray-800/60 p-8">
                                                    <Empty
                                                        image={<FileSearchOutlined style={{ fontSize: 64, color: '#e6ccb2' }} />}
                                                        description={
                                                            <div className="flex flex-col items-center mt-4">
                                                                <Title level={4} className="text-gray-600 dark:text-gray-400 m-0" style={{ fontWeight: 600 }}>Selecciona una receta</Title>
                                                                <Text type="secondary" className="text-center text-sm max-w-sm mt-3 leading-relaxed">
                                                                    Explora tu recetario a la izquierda para ver desgloses, cotizar porciones y exportar a PDF.
                                                                </Text>
                                                            </div>
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </Col>
                                    </Row>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
        </div>
    );
};
