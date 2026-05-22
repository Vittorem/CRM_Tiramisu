import { Order, Recipe, Ingredient } from '../types';

/**
 * Calculates the total cost of a single recipe based on its ingredients.
 */
export const calculateRecipeCost = (recipe: Recipe, allIngredients: Ingredient[]): number => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
    
    return recipe.ingredients.reduce((total, ri) => {
        const ingredient = allIngredients.find(ing => ing.id === ri.ingredientId);
        if (!ingredient) return total;
        return total + (ingredient.cost_unit * ri.qty);
    }, 0);
};

/**
 * Calculates the per-serving cost of a recipe.
 */
export const calculateCostPerServing = (recipe: Recipe, allIngredients: Ingredient[]): number => {
    if (!recipe.servings_default || recipe.servings_default <= 0) return 0;
    const totalCost = calculateRecipeCost(recipe, allIngredients);
    return totalCost / recipe.servings_default;
};

/**
 * Matches an order (or its items) to a known recipe intelligently, 
 * estimating the operational cost based on current ingredient prices.
 */
export const findRecipeForProduct = (
    productId: string | undefined,
    flavorId: string | undefined,
    productName: string, 
    flavorName: string | undefined, 
    recipes: Recipe[]
): Recipe | undefined => {
    // Pass 0: Strict ID Linkage Match (Highest Priority)
    let matchedRecipe = recipes.find(r => 
        r.linkedProductId && 
        r.linkedProductId === productId && 
        (flavorId ? r.linkedFlavorId === flavorId : true)
    );

    const prodLower = productName.toLowerCase().trim();
    const flavorLower = flavorName ? flavorName.toLowerCase().trim() : '';
    const combinedLower = `${prodLower} ${flavorLower}`.trim();

    // Pass 1: Exact Text Match (Fallback)
    if (!matchedRecipe) {
        matchedRecipe = recipes.find(r => r.name.toLowerCase() === prodLower);
    }

    // Pass 2: Flavor Match (e.g. "Mediano" + "Nuez" = "Mediano Nuez")
    if (!matchedRecipe && flavorLower) {
        matchedRecipe = recipes.find(r => {
            const rName = r.name.toLowerCase();
            return rName === combinedLower || (rName.includes(prodLower) && rName.includes(flavorLower));
        });
    }

    // Pass 3: Size Keyword Priority Match
    if (!matchedRecipe) {
        const sizes = ['bambino', 'mediano', 'grande'];
        const detectedSize = sizes.find(s => prodLower.includes(s));
        
        if (detectedSize) {
             if (flavorLower) {
                 matchedRecipe = recipes.find(r => r.name.toLowerCase().includes(detectedSize) && r.name.toLowerCase().includes(flavorLower));
             }
             if (!matchedRecipe) {
                 matchedRecipe = recipes.find(r => r.name.toLowerCase().includes(detectedSize));
             }
        }
    }

    // Pass 4: Substring Inclusion
    if (!matchedRecipe) {
        matchedRecipe = recipes.find(r => 
            r.name.toLowerCase().includes(prodLower) || 
            prodLower.includes(r.name.toLowerCase())
        );
    }

    return matchedRecipe;
};

/**
 * Matches an order (or its items) to a known recipe intelligently, 
 * estimating the operational cost based on current ingredient prices.
 */
export const calculateOrderEstimatedCost = (
    order: Order, 
    recipes: Recipe[], 
    ingredients: Ingredient[]
): number => {
    const getCost = (
        productId: string | undefined,
        flavorId: string | undefined,
        productName: string, 
        flavorName: string | undefined, 
        quantity: number
    ): number => {
        const matchedRecipe = findRecipeForProduct(productId, flavorId, productName, flavorName, recipes);
        if (matchedRecipe) {
            const costPerServing = calculateCostPerServing(matchedRecipe, ingredients);
            return costPerServing * quantity;
        }
        return 0;
    };

    if (order.items && order.items.length > 0) {
        return order.items.reduce((total, item) => {
            return total + getCost(item.productId, item.flavorId, item.productNameAtSale, item.flavorNameAtSale, item.quantity);
        }, 0);
    } else if (order.productNameAtSale) {
        return getCost(order.productId, order.flavorId, order.productNameAtSale, undefined, order.quantity || 1);
    }
    
    return 0;
};

export interface ExplodedIngredient {
    ingredientId: string;
    name: string;
    qty: number;
    unit: string;
    cost: number;
}

/**
 * Consolidates all ingredients needed to prepare a list of orders.
 */
export const explodedIngredientsForOrders = (
    orders: Order[],
    recipes: Recipe[],
    ingredients: Ingredient[]
): ExplodedIngredient[] => {
    const totals: Record<string, { name: string; qty: number; unit: string; costUnit: number }> = {};
    
    orders.forEach(order => {
        const items = order.items || [];
        
        if (items.length > 0) {
            items.forEach(item => {
                const matchedRecipe = findRecipeForProduct(item.productId, item.flavorId, item.productNameAtSale, item.flavorNameAtSale, recipes);
                if (!matchedRecipe) return;
                
                const ratio = item.quantity / (matchedRecipe.servings_default || 1);
                
                matchedRecipe.ingredients.forEach(ri => {
                    const ing = ingredients.find(i => i.id === ri.ingredientId);
                    if (!ing) return;
                    if (!totals[ri.ingredientId]) {
                        totals[ri.ingredientId] = { name: ing.name, qty: 0, unit: ri.unit || ing.unit, costUnit: ing.cost_unit || 0 };
                    }
                    totals[ri.ingredientId].qty += ri.qty * ratio;
                });
            });
        } else if (order.productNameAtSale) {
            const matchedRecipe = findRecipeForProduct(order.productId, order.flavorId, order.productNameAtSale, undefined, recipes);
            if (!matchedRecipe) return;
            
            const ratio = (order.quantity || 1) / (matchedRecipe.servings_default || 1);
            
            matchedRecipe.ingredients.forEach(ri => {
                const ing = ingredients.find(i => i.id === ri.ingredientId);
                if (!ing) return;
                if (!totals[ri.ingredientId]) {
                    totals[ri.ingredientId] = { name: ing.name, qty: 0, unit: ri.unit || ing.unit, costUnit: ing.cost_unit || 0 };
                }
                totals[ri.ingredientId].qty += ri.qty * ratio;
            });
        }
    });

    return Object.entries(totals).map(([ingredientId, data]) => ({
        ingredientId,
        name: data.name,
        qty: data.qty,
        unit: data.unit,
        cost: data.qty * data.costUnit
    }));
};
