// src/lib/currency-formatter.ts

// ============================================================
// 🏦 SISTEMA DE PRECISIÓN BANCARIA (ESTILO COBOL)
// Todos los montos se almacenan en CÉNTIMOS (enteros)
// Las operaciones aritméticas se hacen con enteros
// Solo se formatean al mostrar (dividir entre 100)
// ============================================================

/**
 * Convierte un monto en bolívares a céntimos (entero)
 * Ejemplo: toCentsBs(10.56) → 1056
 */
export function toCentsBs(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convierte un monto en dólares a céntimos (entero)
 * Ejemplo: toCentsUsd(10.56) → 1056
 */
export function toCentsUsd(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convierte céntimos a bolívares (número)
 * Ejemplo: fromCentsBs(1056) → 10.56
 */
export function fromCentsBs(cents: number): number {
  return cents / 100;
}

/**
 * Convierte céntimos a dólares (número)
 * Ejemplo: fromCentsUsd(1056) → 10.56
 */
export function fromCentsUsd(cents: number): number {
  return cents / 100;
}

/**
 * Formatea un monto en céntimos de Bolívar a string
 * Ejemplo: formatCentsBs(1056) → "Bs. 10,56"
 * Ejemplo: formatCentsBs(105600) → "Bs. 1.056,00"
 */
export function formatCentsBs(cents: number, decimals: number = 2): string {
  if (!Number.isInteger(cents)) {
    // Si no es entero, forzamos redondeo
    cents = Math.round(cents);
  }
  const amount = cents / 100;
  return 'Bs. ' + amount.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un monto en céntimos de Dólar a string
 * Ejemplo: formatCentsUsd(1056) → "USD $10,56"
 * Ejemplo: formatCentsUsd(105600) → "USD $1.056,00"
 */
export function formatCentsUsd(cents: number, decimals: number = 2): string {
  if (!Number.isInteger(cents)) {
    cents = Math.round(cents);
  }
  const amount = cents / 100;
  return 'USD $' + amount.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un monto en céntimos de Bolívar sin el símbolo
 * Ejemplo: formatCentsBsNumber(1056) → "10,56"
 */
export function formatCentsBsNumber(cents: number, decimals: number = 2): string {
  if (!Number.isInteger(cents)) {
    cents = Math.round(cents);
  }
  const amount = cents / 100;
  return amount.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un monto en céntimos de Dólar sin el símbolo
 * Ejemplo: formatCentsUsdNumber(1056) → "10,56"
 */
export function formatCentsUsdNumber(cents: number, decimals: number = 2): string {
  if (!Number.isInteger(cents)) {
    cents = Math.round(cents);
  }
  const amount = cents / 100;
  return amount.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Convierte un string de entrada (ej: "10.56") a céntimos (entero)
 * Útil para inputs del usuario
 */
export function parseCentsFromString(value: string): number {
  // Reemplazar coma por punto para normalizar
  const normalized = value.replace(',', '.');
  const amount = parseFloat(normalized);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Convierte un monto en dólares a céntimos de bolívar usando la tasa de cambio
 * Ejemplo: usdToBsCents(10.56, 667.23) → 704,594 (céntimos de Bs)
 */
export function usdToBsCents(usdAmount: number, exchangeRate: number): number {
  const bs = usdAmount * exchangeRate;
  return Math.round(bs * 100);
}

/**
 * Convierte un monto en bolívares a céntimos de dólar usando la tasa de cambio
 * Ejemplo: bsToUsdCents(7045.94, 667.23) → 1056 (céntimos de USD)
 */
export function bsToUsdCents(bsAmount: number, exchangeRate: number): number {
  const usd = bsAmount / exchangeRate;
  return Math.round(usd * 100);
}

/**
 * Convierte céntimos de bolívar a céntimos de dólar usando la tasa de cambio
 * Ejemplo: centsBsToCentsUsd(704594, 667.23) → 1056 (céntimos de USD)
 */
export function centsBsToCentsUsd(centsBs: number, exchangeRate: number): number {
  const bs = centsBs / 100;
  const usd = bs / exchangeRate;
  return Math.round(usd * 100);
}

/**
 * Convierte céntimos de dólar a céntimos de bolívar usando la tasa de cambio
 * Ejemplo: centsUsdToCentsBs(1056, 667.23) → 704594 (céntimos de Bs)
 */
export function centsUsdToCentsBs(centsUsd: number, exchangeRate: number): number {
  const usd = centsUsd / 100;
  const bs = usd * exchangeRate;
  return Math.round(bs * 100);
}

/**
 * ✅ FUNCIONES DE COMPATIBILIDAD (MANTIENEN LA INTERFAZ EXISTENTE)
 * Estas funciones convierten automáticamente de céntimos a formato legible
 * para no romper el código existente mientras se migra
 */

/**
 * Formatea un monto en Bolívares (acepta tanto céntimos como decimales)
 * Si el número es > 1000, asume que son céntimos
 */
export function formatBs(amount: number, decimals: number = 2): string {
  if (isNaN(amount)) return 'Bs. 0,00';
  if (amount === null || amount === undefined) return 'Bs. 0,00';
  
  // Si el número es grande (>1000), asumimos que son céntimos
  // Esto permite migración gradual
  const useCents = Math.abs(amount) > 1000 && Number.isInteger(amount);
  const value = useCents ? amount / 100 : amount;
  
  return 'Bs. ' + value.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un monto en Dólares (acepta tanto céntimos como decimales)
 */
export function formatUsd(amount: number, decimals: number = 2): string {
  if (isNaN(amount)) return 'USD $0,00';
  if (amount === null || amount === undefined) return 'USD $0,00';
  
  const useCents = Math.abs(amount) > 1000 && Number.isInteger(amount);
  const value = useCents ? amount / 100 : amount;
  
  return 'USD $' + value.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un monto en Bolívares sin el símbolo
 */
export function formatBsNumber(amount: number, decimals: number = 2): string {
  if (isNaN(amount)) return '0,00';
  if (amount === null || amount === undefined) return '0,00';
  
  const useCents = Math.abs(amount) > 1000 && Number.isInteger(amount);
  const value = useCents ? amount / 100 : amount;
  
  return value.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un monto en Dólares sin el símbolo
 */
export function formatUsdNumber(amount: number, decimals: number = 2): string {
  if (isNaN(amount)) return '0,00';
  if (amount === null || amount === undefined) return '0,00';
  
  const useCents = Math.abs(amount) > 1000 && Number.isInteger(amount);
  const value = useCents ? amount / 100 : amount;
  
  return value.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formato genérico según el tipo de moneda
 */
export function formatCurrency(amount: number, currency: 'VES' | 'USD' = 'VES', decimals: number = 2): string {
  if (currency === 'USD') {
    return formatUsd(amount, decimals);
  }
  return formatBs(amount, decimals);
}

/**
 * Para montos que están en USD y quieres mostrar el equivalente en Bs
 */
export function formatBsEquivalent(usdAmount: number, exchangeRate: number, decimals: number = 2): string {
  const bsAmount = usdAmount * exchangeRate;
  return formatBs(bsAmount, decimals);
}

// ============================================================
// 🧮 FUNCIONES DE OPERACIONES CON CÉNTIMOS (COBOL STYLE)
// ============================================================

/**
 * Suma dos montos en céntimos (enteros)
 * Ejemplo: sumCents(1056, 200) → 1256
 */
export function sumCents(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

/**
 * Resta dos montos en céntimos (enteros)
 * Ejemplo: subCents(1056, 200) → 856
 */
export function subCents(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

/**
 * Multiplica un monto en céntimos por un número
 * Ejemplo: mulCents(1056, 3) → 3168
 */
export function mulCents(a: number, b: number): number {
  return Math.round(Math.round(a) * b);
}

/**
 * Divide un monto en céntimos por un número
 * Ejemplo: divCents(1056, 3) → 352
 */
export function divCents(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round(Math.round(a) / b);
}

// ============================================================
// ⚙️ CONSTANTES
// ============================================================

export const CENTS_IN_ONE = 100;
export const IVA_PERCENT = 16; // 16% en enteros (16/100)