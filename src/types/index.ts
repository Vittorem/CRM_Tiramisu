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

    // Loyalty Program
    loyaltyPoints?: number;

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
    pointsRedeemed?: number; // Tracking points used for exactly this item
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

    // Loyalty Program tracking
    pointsEarned?: number;
    pointsRedeemed?: number;
    pointsAwarded?: boolean;

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

// --- Loyalty System ---
export interface LoyaltyLedger extends BaseEntity {
    customerId: string;
    orderId?: string; // Optional if reason is 'manual_adjustment'
    pointsChange: number; // Positive (earned) or negative (redeemed)
    reason: 'purchase' | 'redemption' | 'manual_adjustment';
}

// --- System Settings ---
export interface SystemSettings extends BaseEntity {
    id: 'loyalty_config'; // enforced ID for the singleton document
    loyaltyEnabled: boolean;
}

// --- B2B Delivery Schedules ---

export type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export const DAYS_OF_WEEK: DayOfWeek[] = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

/** Maps JS Date.getDay() (0=Sunday) to our DayOfWeek */
export const JS_DAY_TO_DAY_OF_WEEK: Record<number, DayOfWeek> = {
    0: 'Domingo',
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
};

/** Contacto adicional de un negocio B2B */
export interface B2BContact {
    name: string;
    role?: string;
    phone: string;
    isWhatsApp?: boolean;
    isPrimary?: boolean;
}

/** Programación de entrega recurrente para un negocio B2B */
export interface B2BDeliverySchedule extends BaseEntity {
    customerId: string;
    customerName: string;

    // Programación
    deliveryDays: DayOfWeek[];
    preferredTime?: string;

    // Contactos del negocio (múltiples)
    contacts: B2BContact[];

    // Logística
    deliveryAddress?: string;
    deliveryNotes?: string;

    // Notas generales
    notes?: string;

    // Estado
    isActive: boolean;
}
