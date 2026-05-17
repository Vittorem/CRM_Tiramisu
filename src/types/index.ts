import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
    id: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    updatedBy: string;
    isDeleted?: boolean;
    deletedAt?: Timestamp;
}

// --- Catalogs ---

export interface Product extends BaseEntity {
    name: string;
    price: number;
    isActive: boolean;
}

export interface Flavor extends BaseEntity {
    name: string;
    isActive: boolean;
}

export interface Channel extends BaseEntity {
    name: string;
    isActive: boolean;
}

// --- Customers ---

export interface Customer extends BaseEntity {
    fullName: string;
    phone: string;
    mainContactMethod: 'Instagram' | 'WhatsApp' | 'Facebook' | 'Otro';
    gender?: 'M' | 'F' | 'Otro';
    age?: number;
    occupation?: string;
    civilStatus?: string;
    type: 'B2C' | 'B2B';

    // Optional
    email?: string;
    instagramHandle?: string;
    facebookLink?: string;
    colonia?: string;
    city?: string;
    notes?: string;
    tags?: string[];

    isActive: boolean;

    // Derived metrics
    totalSpent?: number;
    ordersCount?: number;
    avgOrderValue?: number;
    lastDeliveredAt?: Timestamp;
}

// --- Orders ---

export const ORDER_STATUSES = [
    'Pendiente',
    'Confirmado',
    'En preparación',
    'Listo para entregar',
    'Entregado',
    'Cancelado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Kanban-visible statuses (excludes Cancelado) */
export const KANBAN_STATUSES: OrderStatus[] = [
    'Pendiente',
    'Confirmado',
    'En preparación',
    'Listo para entregar',
    'Entregado',
];

export interface OrderItem {
    id: string; // unique ID for the item row
    productId: string;
    productNameAtSale: string;
    flavorId: string;
    flavorNameAtSale: string;
    quantity: number;
    unitPriceAtSale: number;
    subtotal: number;
}

export const PAYMENT_STATUSES = [
    'No Pagado',
    'Pago Parcial',
    'Pagado',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Order extends BaseEntity {
    customerId: string;
    customerName?: string;

    // Support for multiple products (Cart)
    items?: OrderItem[];

    // Legacy fields (for backwards compatibility with existing records before Cart system)
    productId?: string;
    productNameAtSale?: string;
    flavorId?: string;
    flavorNameAtSale?: string;
    quantity?: number;
    unitPriceAtSale?: number;

    channelId: string;

    deliveryDate: Timestamp;
    deliveryMethod: 'Recoge' | 'Envío';
    shippingCost: number;

    discountType: 'PERCENT' | 'AMOUNT';
    discountValue: number;

    extraCharges: number;
    extraChargesReason?: string;

    notes?: string;
    status: OrderStatus;
    paymentStatus?: PaymentStatus;

    // Calculated fields
    subtotal: number;
    discountAmount: number;
    total: number;

    deliveredAt?: Timestamp;
}

// --- Inventory ---

export interface InventoryItem extends BaseEntity {
    name: string;
    category: string;
    purchaseUnitLabel: 'bolsa' | 'caja' | 'paquete' | 'cartera';
    packageSize: number;
    stockPackages: number;
    minPackages: number;
    supplier?: string;
    notes?: string;
    isActive: boolean;
}



// --- Recetario y Costos ---
export interface Ingredient extends BaseEntity {
    name: string;
    unit: string; // ej. 'g', 'ml', 'pieza'
    cost_unit: number; // Costo por unidad en MXN
}

export interface RecipeIngredient {
    ingredientId: string;
    qty: number;
    unit: string;
}

export interface Recipe extends BaseEntity {
    name: string;
    servings_default: number;
    is_variant: boolean;
    ingredients: RecipeIngredient[];
    linkedProductId?: string; // ID of the product from Settings this recipe belongs to
    linkedFlavorId?: string; // ID of the flavor from Settings this recipe belongs to
}

