// src/lib/types.ts
// ============================================================
// TIPOS GLOBALES - VERSIÓN CÉNTIMOS (ESTILO BANCARIO COBOL)
// ============================================================

// ============================================================
// 🏦 NOTA SOBRE MONTOS:
// Todos los montos se almacenan en CÉNTIMOS (enteros)
// - priceCents, totalCents, amountCents, etc.
// - Para Bs: 1 Bs = 100 céntimos
// - Para USD: 1 USD = 100 céntimos
// - Las operaciones aritméticas se hacen con enteros
// - Solo se formatean al mostrar (dividir entre 100)
// ============================================================

export interface Product {
  id: number;
  barcode?: string;
  name: string;
  category: Category;
  department?: string;
  stock: number;
  minStock?: number;
  priceUsd: number;      // ⚠️ DEPRECATED - usar priceUsdCents
  priceBs: number;       // ⚠️ DEPRECATED - usar priceBsCents
  priceUsdCents: number; // ✅ PRECIO EN CÉNTIMOS DE USD (entero)
  priceBsCents: number;  // ✅ PRECIO EN CÉNTIMOS DE BS (entero)
  costUsd?: number;      // ⚠️ DEPRECATED - usar costUsdCents
  costBs?: number;       // ⚠️ DEPRECATED - usar costBsCents
  costUsdCents?: number; // ✅ COSTO EN CÉNTIMOS DE USD
  costBsCents?: number;  // ✅ COSTO EN CÉNTIMOS DE BS
  profitPercent?: number;
  priceRetail?: number;
  priceWholesale?: number;
  priceCost?: number;
  ivaType: 'con_iva' | 'sin_iva' | 'exento';
  ivaPercentage: number;
  isKit: boolean;
  kitHasOwnStock?: boolean;
  kitComponents?: KitComponent[];
  isPriceFixed: boolean;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
  unitMeasure?: string;
  brand?: string;
  partNumber?: string;
  isService?: boolean;
}

export interface KitComponent {
  productId: number;
  quantity: number;
  productName?: string;
}

export interface Client {
  id: number;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  debt?: number;         // ⚠️ DEPRECATED - usar debtCents
  debtCents?: number;    // ✅ DEUDA EN CÉNTIMOS DE BS (entero)
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'contado' | 'credito' | 'cobro_deuda' | 'colaboracion' | 'consumo_propio' | 'devolucion';
  items: CartItem[];
  subtotal: number;       // ⚠️ DEPRECATED - usar subtotalCents
  iva: number;            // ⚠️ DEPRECATED - usar ivaCents
  total: number;          // ⚠️ DEPRECATED - usar totalCents
  totalUsd: number;       // ⚠️ DEPRECATED - usar totalUsdCents
  subtotalCents: number;  // ✅ SUBTOTAL EN CÉNTIMOS DE BS (entero)
  ivaCents: number;       // ✅ IVA EN CÉNTIMOS DE BS (entero)
  totalCents: number;     // ✅ TOTAL EN CÉNTIMOS DE BS (entero)
  totalUsdCents: number;  // ✅ TOTAL EN CÉNTIMOS DE USD (entero)
  payMethod: string;
  paidBs: number;         // ⚠️ DEPRECATED - usar paidBsCents
  paidBsCents: number;    // ✅ PAGADO EN CÉNTIMOS DE BS (entero)
  change: number;         // ⚠️ DEPRECATED - usar changeCents
  changeCents: number;    // ✅ VUELTO EN CÉNTIMOS DE BS (entero)
  clientId?: number;
  clientName?: string;
  exchangeRate: number;   // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number; // ✅ TASA DE CAMBIO EN CÉNTIMOS (entero, ej: 66723 = 667.23)
  receiptNumber?: number;
  costoTotalOperacion?: number;
  notes?: string;
  authorizedBy?: string;
  sessionId?: string;
  ajusteRedondeoBs?: number; // ⚠️ DEPRECATED - usar ajusteRedondeoBsCents
  ajusteRedondeoBsCents?: number; // ✅ AJUSTE EN CÉNTIMOS DE BS
  payments?: Payment[];
  terminalId?: string | number;
  referenceId?: string | number;
  txId?: string | number;
  referenceType?: string;
}

export interface Payment {
  id: string;
  method: string;
  amount: number;        // ⚠️ DEPRECATED - usar amountCents
  amountCents: number;   // ✅ MONTO EN CÉNTIMOS (según moneda del método)
  usdAmount?: number;    // ⚠️ DEPRECATED - usar usdAmountCents
  usdAmountCents?: number; // ✅ MONTO USD EN CÉNTIMOS
}

export interface CartItem {
  productId: number;
  name: string;
  priceBs: number;       // ⚠️ DEPRECATED - usar priceBsCents
  priceUsd: number;      // ⚠️ DEPRECATED - usar priceUsdCents
  priceBsCents: number;  // ✅ PRECIO EN CÉNTIMOS DE BS (entero)
  priceUsdCents: number; // ✅ PRECIO EN CÉNTIMOS DE USD (entero)
  qty: number;
  category: Category;
  ivaType: string;
  ivaPercentage: number;
  isKit: boolean;
  unitMeasure?: string;
}

export interface Account {
  id: number;
  txId: number;
  date: string;
  clientId: number;
  clientName: string;
  clientCedula: string;
  products: string;
  amountBs: number;      // ⚠️ DEPRECATED - usar amountBsCents
  amountUsd: number;     // ⚠️ DEPRECATED - usar amountUsdCents
  amountBsCents: number; // ✅ MONTO EN CÉNTIMOS DE BS
  amountUsdCents: number; // ✅ MONTO EN CÉNTIMOS DE USD
  paidAmount: number;    // ⚠️ DEPRECATED - usar paidAmountCents
  paidAmountCents: number; // ✅ PAGADO EN CÉNTIMOS DE BS
  paidAmountUsd?: number; // ⚠️ DEPRECATED - usar paidAmountUsdCents
  paidAmountUsdCents?: number; // ✅ PAGADO EN CÉNTIMOS DE USD
  status: 'pendiente' | 'parcial' | 'pagada';
  exchangeRate: number;  // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number; // ✅ TASA EN CÉNTIMOS
  createdAt?: string;
  updatedAt?: string;
}

export interface CashRegister {
  isOpen: boolean;
  openTime: string | null;
  openAmount: number;      // ⚠️ DEPRECATED - usar openAmountCents
  openAmountBs: number;    // ⚠️ DEPRECATED - usar openAmountBsCents
  openAmountUsd: number;   // ⚠️ DEPRECATED - usar openAmountUsdCents
  openAmountCents: number; // ✅ MONTO APERTURA EN CÉNTIMOS (BS)
  openAmountBsCents: number; // ✅ APERTURA EN CÉNTIMOS DE BS
  openAmountUsdCents: number; // ✅ APERTURA EN CÉNTIMOS DE USD
  txs: Transaction[];
  exchangeRate: number | null; // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number | null; // ✅ TASA EN CÉNTIMOS
}

export interface CashClose {
  id: string;
  terminalId: string;
  openTime: string;
  closeTime: string;
  initialAmount: number;   // ⚠️ DEPRECATED - usar initialAmountCents
  finalAmount: number;     // ⚠️ DEPRECATED - usar finalAmountCents
  expectedAmount: number;  // ⚠️ DEPRECATED - usar expectedAmountCents
  difference: number;      // ⚠️ DEPRECATED - usar differenceCents
  initialAmountCents: number; // ✅ EN CÉNTIMOS
  finalAmountCents: number;   // ✅ EN CÉNTIMOS
  expectedAmountCents: number; // ✅ EN CÉNTIMOS
  differenceCents: number;    // ✅ EN CÉNTIMOS
  totalSales: number;      // ⚠️ DEPRECATED - usar totalSalesCents
  totalSalesCents: number; // ✅ EN CÉNTIMOS
  transactions: Transaction[];
  notes?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'viewer';
  terminalId?: string;
  terminalName?: string;
  status: 'active' | 'inactive' | 'blocked';
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Terminal {
  id: string;
  name: string;
  description?: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  isBlocked?: boolean;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: number;
  name: string;
  cedula?: string;
  rif?: string;
  phone: string;
  address: string;
  email?: string;
  contactPerson?: string;
  debt?: number;          // ⚠️ DEPRECATED - usar debtCents
  totalDebt?: number;     // ⚠️ DEPRECATED - usar totalDebtCents
  debtCents?: number;     // ✅ DEUDA EN CÉNTIMOS DE BS
  totalDebtCents?: number; // ✅ DEUDA TOTAL EN CÉNTIMOS DE BS
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierInvoice {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  invoiceNumber?: string;
  total: number;          // ⚠️ DEPRECATED - usar totalCents
  totalUsd?: number;      // ⚠️ DEPRECATED - usar totalUsdCents
  totalCents: number;     // ✅ TOTAL EN CÉNTIMOS DE BS
  totalUsdCents?: number; // ✅ TOTAL EN CÉNTIMOS DE USD
  exchangeRate: number;   // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number; // ✅ TASA EN CÉNTIMOS
  status: 'pendiente' | 'pagada' | 'parcial';
  paymentMethod?: string;
  notes?: string;
  items?: PurchaseInvoiceItem[];
  paidAmount?: number;    // ⚠️ DEPRECATED - usar paidAmountCents
  paidAmountCents?: number; // ✅ PAGADO EN CÉNTIMOS DE BS
  itemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseInvoice {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  total: number;          // ⚠️ DEPRECATED - usar totalCents
  totalUsd?: number;      // ⚠️ DEPRECATED - usar totalUsdCents
  totalCents: number;     // ✅ TOTAL EN CÉNTIMOS DE BS
  totalUsdCents?: number; // ✅ TOTAL EN CÉNTIMOS DE USD
  exchangeRate: number;   // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number; // ✅ TASA EN CÉNTIMOS
  status: 'pendiente' | 'pagada' | 'parcial';
  paymentMethod?: string;
  notes?: string;
  items?: PurchaseItem[];
  invoiceNumber?: string;
  paidAmount?: number;    // ⚠️ DEPRECATED - usar paidAmountCents
  paidAmountCents?: number; // ✅ PAGADO EN CÉNTIMOS DE BS
  itemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  id: string;
  invoiceId: number;
  productId: number;
  productName: string;
  quantity: number;
  costUsd: number;        // ⚠️ DEPRECATED - usar costUsdCents
  costBs: number;         // ⚠️ DEPRECATED - usar costBsCents
  costUsdCents: number;   // ✅ COSTO EN CÉNTIMOS DE USD
  costBsCents: number;    // ✅ COSTO EN CÉNTIMOS DE BS
  totalUsd: number;       // ⚠️ DEPRECATED - usar totalUsdCents
  totalBs: number;        // ⚠️ DEPRECATED - usar totalBsCents
  totalUsdCents: number;  // ✅ TOTAL EN CÉNTIMOS DE USD
  totalBsCents: number;   // ✅ TOTAL EN CÉNTIMOS DE BS
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  invoiceId: number;
  productId: number;
  productName: string;
  qty: number;
  quantity?: number;
  costUsd: number;        // ⚠️ DEPRECATED - usar costUsdCents
  costBs: number;         // ⚠️ DEPRECATED - usar costBsCents
  costUsdCents: number;   // ✅ COSTO EN CÉNTIMOS DE USD
  costBsCents: number;    // ✅ COSTO EN CÉNTIMOS DE BS
  totalUsd: number;       // ⚠️ DEPRECATED - usar totalUsdCents
  totalBs: number;        // ⚠️ DEPRECATED - usar totalBsCents
  totalUsdCents: number;  // ✅ TOTAL EN CÉNTIMOS DE USD
  totalBsCents: number;   // ✅ TOTAL EN CÉNTIMOS DE BS
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPayment {
  id: number;
  supplierId: number;
  supplierName: string;
  date: string;
  amount: number;         // ⚠️ DEPRECATED - usar amountCents
  amountUsd?: number;     // ⚠️ DEPRECATED - usar amountUsdCents
  amountCents: number;    // ✅ MONTO EN CÉNTIMOS DE BS
  amountUsdCents?: number; // ✅ MONTO EN CÉNTIMOS DE USD
  exchangeRate: number;   // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number; // ✅ TASA EN CÉNTIMOS
  method: string;
  invoiceId?: number;
  reference?: string;
  bank?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountingEntry {
  id: string | number;
  date: string;
  type: 'ingreso' | 'egreso';
  category: string;
  subcategory?: string;
  concept: string;
  description?: string;
  amount: number;         // ⚠️ DEPRECATED - usar amountCents
  amountCents: number;    // ✅ MONTO EN CÉNTIMOS DE BS
  referenceId?: string | number;
  referenceType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KardexEntry {
  id: string;
  productId: number;
  date: string;
  type: 'venta' | 'compra' | 'ajuste' | 'consumo' | 'colaboracion' | 'devolucion';
  quantity: number;
  previousStock: number;
  newStock: number;
  costUsd?: number;       // ⚠️ DEPRECATED - usar costUsdCents
  costBs?: number;        // ⚠️ DEPRECATED - usar costBsCents
  costUsdCents?: number;  // ✅ COSTO EN CÉNTIMOS DE USD
  costBsCents?: number;   // ✅ COSTO EN CÉNTIMOS DE BS
  reference: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Page = 'pos' | 'products' | 'clients' | 'accounts' | 'admin' | 'terminal' | 'purchases' | 'reports' | 'caja' | 'dashboard' | 'inventario' | 'registrar_compra' | 'proveedores' | 'clientes' | 'cuentas' | 'contabilidad' | 'devoluciones';

export interface GlobalSettings {
  exchangeRate: number;   // ⚠️ DEPRECATED - usar exchangeRateCents
  exchangeRateCents: number; // ✅ TASA EN CÉNTIMOS
  defaultIvaPercentage: number;
  adminCode: string;
  terminalId?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCode {
  code: string;
  updatedAt?: string;
}

export const EXPENSE_CATEGORIES = [
  { value: 'servicios', label: 'Servicios Públicos' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'proveedores', label: 'Pagos a Proveedores' },
  { value: 'publicidad', label: 'Publicidad y Marketing' },
  { value: 'transporte', label: 'Transporte y Logística' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'materiales', label: 'Materiales y Suministros' },
  { value: 'comunicaciones', label: 'Comunicaciones' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'consultoria', label: 'Consultoría' },
  { value: 'gastos_bancarios', label: 'Gastos Bancarios' },
  { value: 'otros', label: 'Otros Gastos' },
];

export interface Expense {
  id: string | number;
  date: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;         // ⚠️ DEPRECATED - usar amountCents
  amountCents: number;    // ✅ MONTO EN CÉNTIMOS DE BS
  paymentMethod: string;
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const INCOME_CATEGORIES = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'alquileres', label: 'Alquileres' },
  { value: 'intereses', label: 'Intereses' },
  { value: 'transferencias', label: 'Transferencias' },
  { value: 'otros', label: 'Otros Ingresos' },
];

export interface Income {
  id: string | number;
  date: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;         // ⚠️ DEPRECATED - usar amountCents
  amountCents: number;    // ✅ MONTO EN CÉNTIMOS DE BS
  paymentMethod: string;
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentMethod = 'efectivo_bs' | 'usd_efectivo' | 'tarjeta' | 'biopago' | 'pago_movil' | 'zelle' | 'transferencia' | 'cheque' | 'credito';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'alimentos', name: 'Alimentos' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'licores', name: 'Licores' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'cigarrillos', name: 'Cigarrillos' },
  { id: 'higiene', name: 'Higiene Personal' },
  { id: 'limpieza', name: 'Limpieza' },
  { id: 'cuidado_personal', name: 'Cuidado Personal' },
  { id: 'otros', name: 'Otros' },
];

export function getCategoryById(id: string): Category {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  return found || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
}

export function getCategoryId(category: Category | string): string {
  if (typeof category === 'string') return category;
  return category.id;
}

export function getCategoryName(category: Category | string): string {
  if (typeof category === 'string') {
    const found = DEFAULT_CATEGORIES.find(c => c.id === category);
    return found ? found.name : category;
  }
  return category.name;
}

// ============================================================
// 🏦 FUNCIONES DE CONVERSIÓN PARA COMPATIBILIDAD
// ============================================================

/**
 * Convierte un monto en céntimos a su representación decimal
 * Útil para migración gradual
 */
export function centsToDecimal(cents: number): number {
  return cents / 100;
}

/**
 * Convierte un monto decimal a céntimos
 */
export function decimalToCents(amount: number): number {
  return Math.round(amount * 100);
}