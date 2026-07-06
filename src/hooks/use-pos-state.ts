"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Client, Transaction, Account, CashRegister, Page, CartItem, KitComponent, Payment } from '@/lib/types';
import syncService from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';
import {
  toCentsBs,
  toCentsUsd,
  fromCentsBs,
  fromCentsUsd,
  sumCents,
  subCents,
  mulCents,
  divCents,
  centsBsToCentsUsd,
  centsUsdToCentsBs,
  parseCentsFromString,
  formatCentsBs,
  formatCentsUsd,
} from '@/lib/currency-formatter';

// ============================================================
// 🏦 CONSTANTES EN CÉNTIMOS
// ============================================================
const IVA_PERCENT_CENTS = 1600; // 16.00% en céntimos (16 * 100)
const IVA_PERCENT_DECIMAL = 0.16; // Para compatibilidad

// ============================================================
// 🏦 FUNCIONES DE UTILIDAD EN CÉNTIMOS
// ============================================================
const roundTo2 = (num: number): number => Math.round(num * 100) / 100;

// ✅ Convertir tasa de cambio a céntimos (ej: 667.23 → 66723)
const rateToCents = (rate: number): number => Math.round(rate * 100);

// ✅ Convertir céntimos de tasa a decimal (ej: 66723 → 667.23)
const rateFromCents = (rateCents: number): number => rateCents / 100;

// ✅ Funciones de conversión locales (reemplazan las importaciones faltantes)
const centsToDecimal = (cents: number): number => cents / 100;
const decimalToCents = (amount: number): number => Math.round(amount * 100);

function getVenezuelaISOString(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}.${partMap.fractionalSecond}-04:00`;
}

function getVenezuelaTimestamp(): number {
  return Date.now();
}

const STORAGE_KEYS = {
  EXCHANGE_RATE: 'bcv_exchange_rate',
  POS_REGISTER: 'pos_register',
};

export function usePOSState() {
  const { user, activeSession: authActiveSession, setActiveSession } = useAuth();
  const terminalId = user?.terminalId || 'default';
  const terminalNameId = user?.terminalName || user?.terminalId || 'default';
  
  const registerRef = useRef<CashRegister | null>(null);
  const stockUnsubscribeRef = useRef<(() => void) | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [exchangeRate, setExchangeRate] = useState(36.50);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isIvaEnabled, setIsIvaEnabled] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('pos');
  const [isHydrated, setIsHydrated] = useState(false);
  const [globalIvaPercentage, setGlobalIvaPercentage] = useState(16);
  const [adminCode, setAdminCode] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<any | null>(authActiveSession);

  const isUpdatingRef = useRef(false);

  const saveRegisterToLocalStorage = useCallback((registerData: CashRegister | null) => {
    if (typeof window !== 'undefined') {
      if (registerData) {
        localStorage.setItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`, JSON.stringify(registerData));
      } else {
        localStorage.removeItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
      }
    }
  }, [terminalId]);

  const recalcAllPricesWithNewRate = useCallback((newRate: number) => {
    if (products.length === 0) return;
    
    const rateCents = rateToCents(newRate);
    
    setProducts(prevProducts => 
      prevProducts.map(product => {
        if (product.isPriceFixed) {
          return {
            ...product,
            priceBs: product.priceUsd ? roundTo2(product.priceUsd * newRate) : product.priceBs,
            priceBsCents: product.priceUsdCents ? Math.round((product.priceUsdCents * rateCents) / 100) : product.priceBsCents,
            costBs: product.costUsd ? roundTo2(product.costUsd * newRate) : product.costBs,
            costBsCents: product.costUsdCents ? Math.round((product.costUsdCents * rateCents) / 100) : product.costBsCents,
          };
        }
        return {
          ...product,
          priceBs: roundTo2(product.priceUsd * newRate),
          priceBsCents: Math.round((product.priceUsdCents * rateCents) / 100),
          costBs: product.costUsd ? roundTo2(product.costUsd * newRate) : undefined,
          costBsCents: product.costUsdCents ? Math.round((product.costUsdCents * rateCents) / 100) : undefined,
        };
      })
    );
    
    setCart(prevCart =>
      prevCart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (product?.isPriceFixed) {
          return item;
        }
        return {
          ...item,
          priceBs: roundTo2(item.priceUsd * newRate),
          priceBsCents: Math.round((item.priceUsdCents * rateCents) / 100),
        };
      })
    );
  }, [products]);

  useEffect(() => {
      if (!user) {
          if (stockUnsubscribeRef.current) {
              stockUnsubscribeRef.current();
              stockUnsubscribeRef.current = null;
          }
          syncService.unsubscribeAll();
          setProducts([]);
          setClients([]);
          setTransactions([]);
          setAccounts([]);
          setRegister(null);
          registerRef.current = null;
          setCurrentSession(null);
          setCart([]);
          localStorage.removeItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
      }
  }, [user, terminalId]);

  useEffect(() => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;
      const cachedRegister = localStorage.getItem(`${STORAGE_KEYS.POS_REGISTER}_${terminalId}`);
      if (cachedRegister) {
          try {
              const parsed = JSON.parse(cachedRegister);
              setRegister(parsed);
              registerRef.current = parsed;
          } catch (e) {}
      }
      const cachedRate = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
      if (cachedRate) {
          const rate = parseFloat(cachedRate);
          if (!isNaN(rate)) setExchangeRate(rate);
      }
      isUpdatingRef.current = false;
  }, [terminalId]);

  useEffect(() => {
      setCurrentSession(authActiveSession);
  }, [authActiveSession]);

  useEffect(() => {
      if (!user?.terminalId) return;
      const unsubscribe = syncService.subscribeToRegisterRealtime(terminalId, (registerData) => {
          if (registerData && registerData.isOpen) {
              const session = {
                  id: `${terminalId}_${registerData.openTime}`,
                  terminalId: terminalId,
                  userId: user?.uid || 'unknown',
                  startTime: registerData.openTime,
                  initialAmountUsd: registerData.openAmountUsd || 0,
                  finalAmountUsd: 0,
                  status: 'open',
                  totalSales: registerData.txs?.length || 0,
                  exchangeRate: registerData.exchangeRate || exchangeRate,
              };
              setCurrentSession(session);
              if (setActiveSession) setActiveSession(session);
          } else {
              setCurrentSession(null);
              if (setActiveSession) setActiveSession(null);
          }
      });
      return () => unsubscribe();
  }, [user?.terminalId, terminalId, user?.uid, exchangeRate, setActiveSession]);

  useEffect(() => {
      if (!user) return;
      const unsubRegister = syncService.subscribeToRegisterRealtime(terminalId, (registerData) => {
          setRegister(registerData);
          registerRef.current = registerData;
          saveRegisterToLocalStorage(registerData);
      });
      return () => unsubRegister();
  }, [user, terminalId, saveRegisterToLocalStorage]);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = syncService.subscribeToProducts((data: Product[]) => {
      const currentRate = exchangeRate;
      const rateCents = rateToCents(currentRate);
      const productsWithFixed = data.map(product => {
        // ✅ Asegurar que los productos tengan campos en céntimos
        const priceUsdCents = product.priceUsdCents || toCentsUsd(product.priceUsd || 0);
        const priceBsCents = product.isPriceFixed 
          ? (product.priceBsCents || toCentsBs(product.priceBs || 0))
          : Math.round((priceUsdCents * rateCents) / 100);
        
        if (product.isPriceFixed) return {
          ...product,
          priceUsdCents: priceUsdCents,
          priceBsCents: product.priceBsCents || priceBsCents,
          costUsdCents: product.costUsdCents || toCentsUsd(product.costUsd || 0),
          costBsCents: product.costBsCents || toCentsBs(product.costBs || 0),
        };
        return {
          ...product,
          priceUsd: roundTo2(product.priceUsd || 0),
          priceBs: roundTo2((product.priceUsd || 0) * currentRate),
          priceUsdCents: priceUsdCents,
          priceBsCents: priceBsCents,
          costUsdCents: product.costUsdCents || toCentsUsd(product.costUsd || 0),
          costBsCents: Math.round((product.costUsdCents || 0) * rateCents / 100),
        };
      });
      setProducts(productsWithFixed);
    });
    
    const unsubClients = syncService.subscribeToClients(setClients);
    const unsubTransactions = syncService.subscribeToTransactions(setTransactions as any);
    const unsubAccounts = syncService.subscribeToAccounts(setAccounts as any);
    
    const unsubSettings = syncService.subscribeToGlobalSettings?.((settings: any) => {
      if (settings) {
        if (typeof settings.defaultIvaPercentage === 'number') {
          setGlobalIvaPercentage(settings.defaultIvaPercentage);
        }
        if (typeof settings.exchangeRate === 'number' && settings.exchangeRate !== exchangeRate) {
          if (!isUpdatingRef.current) {
            isUpdatingRef.current = true;
            setExchangeRate(settings.exchangeRate);
            localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
            isUpdatingRef.current = false;
          }
        }
      }
    }) || (() => {});
    
    const loadGlobalSettings = async () => {
      try {
        const settings = await syncService.getGlobalSettings();
        if (settings) {
          if (typeof settings.defaultIvaPercentage === 'number') {
            setGlobalIvaPercentage(settings.defaultIvaPercentage);
          }
          if (typeof settings.exchangeRate === 'number' && settings.exchangeRate !== exchangeRate) {
            if (!isUpdatingRef.current) {
              isUpdatingRef.current = true;
              setExchangeRate(settings.exchangeRate);
              localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, settings.exchangeRate.toString());
              isUpdatingRef.current = false;
            }
          }
        }
        const code = await syncService.getAdminCode();
        if (code) setAdminCode(code.code);
        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading global settings:', error);
        setIsHydrated(true);
      }
    };
    loadGlobalSettings();

    return () => {
      unsubProducts(); 
      unsubClients(); 
      unsubTransactions(); 
      unsubAccounts(); 
      if (typeof unsubSettings === 'function') unsubSettings();
    };
  }, [user, exchangeRate]);

  useEffect(() => {
    if (!user) return;

    if (stockUnsubscribeRef.current) {
      stockUnsubscribeRef.current();
      stockUnsubscribeRef.current = null;
    }

    const unsubscribe = syncService.subscribeToStockRTDB((stockData: Record<string, number>) => {
      setProducts(prevProducts => 
        prevProducts.map(product => {
          const newStock = stockData[product.id.toString()];
          if (newStock !== undefined && product.stock !== newStock) {
            return { ...product, stock: newStock };
          }
          return product;
        })
      );
    });

    stockUnsubscribeRef.current = unsubscribe;

    return () => {
      if (stockUnsubscribeRef.current) {
        stockUnsubscribeRef.current();
        stockUnsubscribeRef.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    if (!isHydrated || products.length === 0 || cart.length === 0) return;

    setCart(prevCart => {
      let hasChanges = false;
      const updatedCart = prevCart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const masterPriceUsd = product.priceUsd;
          const masterPriceBs = product.priceBs;
          const masterPriceUsdCents = product.priceUsdCents || toCentsUsd(masterPriceUsd);
          const masterPriceBsCents = product.priceBsCents || toCentsBs(masterPriceBs);
          
          if (item.priceUsd !== masterPriceUsd || item.priceBs !== masterPriceBs ||
              item.priceUsdCents !== masterPriceUsdCents || item.priceBsCents !== masterPriceBsCents) {
            hasChanges = true;
            return {
              ...item,
              priceUsd: masterPriceUsd,
              priceBs: masterPriceBs,
              priceUsdCents: masterPriceUsdCents,
              priceBsCents: masterPriceBsCents,
            };
          }
        }
        return item;
      });

      return hasChanges ? updatedCart : prevCart;
    });
  }, [products, isHydrated]);

  const refreshAllData = useCallback(async () => {
    const [newProducts, newClients, newTransactions, newAccounts] = await Promise.all([
      syncService.getProducts(),
      syncService.getClients(),
      syncService.getTransactions(),
      syncService.getAccounts(),
    ]);
    setProducts(newProducts);
    setClients(newClients);
    setTransactions(newTransactions);
    setAccounts(newAccounts);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSyncComplete = () => {
      refreshAllData();
    };
    window.addEventListener('sync-complete', handleSyncComplete);
    return () => window.removeEventListener('sync-complete', handleSyncComplete);
  }, [refreshAllData]);

  useEffect(() => {
    if (!terminalId || terminalId === 'default') return;
    const unsubscribe = syncService.listenForSyncCommands(terminalId, async () => {
      await syncService.syncAllPending();
      await refreshAllData();
    });
    return () => unsubscribe();
  }, [terminalId, refreshAllData]);

  const addProduct = useCallback((p: Product) => {
    // ✅ Asegurar campos en céntimos
    const productWithCents = {
      ...p,
      priceUsdCents: p.priceUsdCents || toCentsUsd(p.priceUsd || 0),
      priceBsCents: p.priceBsCents || toCentsBs(p.priceBs || 0),
      costUsdCents: p.costUsdCents || toCentsUsd(p.costUsd || 0),
      costBsCents: p.costBsCents || toCentsBs(p.costBs || 0),
    };
    setProducts(prev => {
      if (prev.some(prod => prod.id === p.id)) return prev;
      return [...prev, productWithCents];
    });
    return syncService.saveProduct(productWithCents);
  }, []);

  const updateProduct = useCallback(async (p: Product) => {
    // ✅ Asegurar campos en céntimos
    const productWithCents = {
      ...p,
      priceUsdCents: p.priceUsdCents || toCentsUsd(p.priceUsd || 0),
      priceBsCents: p.priceBsCents || toCentsBs(p.priceBs || 0),
      costUsdCents: p.costUsdCents || toCentsUsd(p.costUsd || 0),
      costBsCents: p.costBsCents || toCentsBs(p.costBs || 0),
    };
    setProducts(prev => prev.map(prod => prod.id === p.id ? productWithCents : prod));
    return syncService.saveProduct(productWithCents);
  }, []);

  const deleteProduct = useCallback((id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    return syncService.deleteProduct(id);
  }, []);

  const saveClient = useCallback((c: Client) => {
    // ✅ Asegurar deuda en céntimos
    const clientWithCents = {
      ...c,
      debtCents: c.debtCents || (c.debt ? toCentsBs(c.debt) : 0),
      debt: c.debt || 0, // Mantener compatibilidad
    };
    return syncService.saveClient(clientWithCents);
  }, []);
  
  const deleteClient = useCallback((id: number) => syncService.deleteClient(id), []);

  const checkProductStock = useCallback((productId: number, quantity: number): boolean => {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    if (product.isKit && product.kitComponents?.length) {
      for (const component of product.kitComponents) {
        const componentProduct = products.find(p => p.id === component.productId);
        if (!componentProduct || componentProduct.stock < (component.quantity * quantity)) return false;
      }
      return true;
    }
    return product.stock >= quantity;
  }, [products]);

  const addToCart = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !checkProductStock(productId, 1)) return false;
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        if (!checkProductStock(productId, existing.qty + 1)) return prev;
        return prev.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        priceBs: product.priceBs,
        priceUsd: product.priceUsd,
        priceBsCents: product.priceBsCents || toCentsBs(product.priceBs),
        priceUsdCents: product.priceUsdCents || toCentsUsd(product.priceUsd),
        qty: 1, 
        category: product.category,
        ivaType: product.ivaType || 'sin_iva', 
        ivaPercentage: product.ivaPercentage || 0, 
        isKit: product.isKit || false,
        unitMeasure: product.unitMeasure || ''
      }];
    });
    return true;
  }, [products, checkProductStock]);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const updateCartQty = useCallback((productId: number, delta: number) => {
    const product = products.find(p => p.id === productId);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.qty + delta;
        if (newQty <= 0) return null as any;
        if (product && !checkProductStock(productId, newQty)) return item;
        return { ...item, qty: newQty, priceBs: product ? product.priceBs : item.priceBs };
      }
      return item;
    }).filter(Boolean));
  }, [products, checkProductStock]);

  const updateCartItemPrice = useCallback((productId: number, newPriceUsd: number, newPriceBs: number) => {
    setCart(prevCart => prevCart.map(item => 
      item.productId === productId ? { 
        ...item, 
        priceUsd: roundTo2(newPriceUsd), 
        priceBs: roundTo2(newPriceBs),
        priceUsdCents: toCentsUsd(newPriceUsd),
        priceBsCents: toCentsBs(newPriceBs),
      } : item
    ));
  }, []);

  const createCashSession = useCallback(async (initialAmountUsd: number): Promise<any> => {
    if (!user || !terminalId) throw new Error('Usuario o Terminal no autenticado');
    
    const registerData = await syncService.getRegisterByTerminal(terminalId);
    if (registerData && registerData.isOpen) {
      const session = {
        id: `${terminalId}_${registerData.openTime}`,
        terminalId: terminalId,
        userId: user.uid,
        startTime: registerData.openTime,
        initialAmountUsd: registerData.openAmountUsd || 0,
        finalAmountUsd: 0,
        status: 'open',
        totalSales: registerData.txs?.length || 0,
        exchangeRate: registerData.exchangeRate || exchangeRate,
      };
      setCurrentSession(session);
      if (setActiveSession) setActiveSession(session);
      return session;
    }
    return null;
  }, [user, terminalId, exchangeRate, setActiveSession]);

  const closeCashSession = useCallback(async (finalAmountUsd: number): Promise<any> => {
    if (!currentSession) throw new Error('No hay sesión activa');
    
    const closed = {
      ...currentSession,
      finalAmountUsd: finalAmountUsd,
      status: 'closed',
      closeTime: new Date().toISOString(),
    };
    
    setCurrentSession(null);
    if (setActiveSession) setActiveSession(null);
    return closed;
  }, [currentSession, setActiveSession]);

  const reloadSession = useCallback(async () => {
    if (!terminalId) return;
    const registerData = await syncService.getRegisterByTerminal(terminalId);
    if (registerData && registerData.isOpen) {
      const session = {
        id: `${terminalId}_${registerData.openTime}`,
        terminalId: terminalId,
        userId: user?.uid || 'unknown',
        startTime: registerData.openTime,
        initialAmountUsd: registerData.openAmountUsd || 0,
        finalAmountUsd: 0,
        status: 'open',
        totalSales: registerData.txs?.length || 0,
        exchangeRate: registerData.exchangeRate || exchangeRate,
      };
      setCurrentSession(session);
      if (setActiveSession) setActiveSession(session);
    } else {
      setCurrentSession(null);
      if (setActiveSession) setActiveSession(null);
    }
  }, [terminalId, user?.uid, exchangeRate, setActiveSession]);

  const openCashRegister = useCallback(async (bsAmount: number, usdAmount: number, rate: number) => {
    const bsCents = toCentsBs(bsAmount);
    const usdCents = toCentsUsd(usdAmount);
    const rateCents = rateToCents(rate);
    
    const registerData: CashRegister = {
      isOpen: true, 
      openTime: getVenezuelaISOString(), 
      openAmount: bsAmount + (usdAmount * rate),
      openAmountBs: bsAmount, 
      openAmountUsd: usdAmount, 
      openAmountCents: bsCents + Math.round((usdCents * rateCents) / 100),
      openAmountBsCents: bsCents,
      openAmountUsdCents: usdCents,
      txs: [], 
      exchangeRate: rate,
      exchangeRateCents: rateCents,
    };
    await syncService.saveRegisterByTerminal(terminalId, registerData);
    setRegister(registerData);
    registerRef.current = registerData;
    saveRegisterToLocalStorage(registerData);
    try { await createCashSession(usdAmount); } catch (e) { console.error('Error session:', e); }
  }, [terminalId, saveRegisterToLocalStorage, createCashSession]);

  const closeCashRegister = useCallback(() => {
    if (currentSession) closeCashSession(0).catch(console.error);
    syncService.saveRegisterByTerminal(terminalId, { 
      isOpen: false, 
      openTime: null, 
      openAmount: 0,
      openAmountBs: 0, 
      openAmountUsd: 0,
      openAmountCents: 0,
      openAmountBsCents: 0,
      openAmountUsdCents: 0,
      txs: [], 
      exchangeRate: null,
      exchangeRateCents: null,
    });
    setRegister(null);
    registerRef.current = null;
    saveRegisterToLocalStorage(null);
  }, [terminalId, saveRegisterToLocalStorage, currentSession, closeCashSession]);

  const getItemsToDiscount = useCallback((cartItems: CartItem[]): { productId: number; quantity: number; product: Product }[] => {
    const result: { productId: number; quantity: number; product: Product }[] = [];
    for (const item of cartItems) {
      const product = products.find(p => p.id === item.productId);
      if (!product) continue;
      if (product.isKit && product.kitComponents?.length) {
        for (const component of product.kitComponents) {
          const componentProduct = products.find(p => p.id === component.productId);
          if (componentProduct) {
            const existing = result.find(r => r.productId === component.productId);
            if (existing) existing.quantity += component.quantity * item.qty;
            else result.push({ productId: component.productId, quantity: component.quantity * item.qty, product: componentProduct });
          }
        }
      } else {
        const existing = result.find(r => r.productId === item.productId);
        if (existing) existing.quantity += item.qty;
        else result.push({ productId: item.productId, quantity: item.qty, product: product });
      }
    }
    return result;
  }, [products]);

  const finalizeSale = useCallback(async (type: 'contado' | 'credito' | 'cobro_deuda' | 'colaboracion' | 'consumo_propio' | 'devolucion', paymentData: any) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');

    const isSpecial = type === 'colaboracion' || type === 'consumo_propio';
    let subtotalCents = 0, ivaCents = 0, totalCents = 0, finalTotalCents = 0;
    let costoTotalOperacionCents = 0;
    
    const rateCents = rateToCents(exchangeRate);
    
    if (!isSpecial) {
      // ✅ Calcular en céntimos usando enteros
      subtotalCents = cart.reduce((acc, item) => {
        const priceCents = item.priceBsCents || toCentsBs(item.priceBs);
        return acc + (priceCents * item.qty);
      }, 0);
      
      ivaCents = cart.reduce((total, item) => {
        if (item.ivaType === 'con_iva') {
          const priceCents = item.priceBsCents || toCentsBs(item.priceBs);
          return total + Math.round((priceCents * item.qty * 16) / 100);
        }
        return total;
      }, 0);
      
      totalCents = subtotalCents + ivaCents;
      finalTotalCents = type === 'cobro_deuda' ? toCentsBs(paymentData.totalPaid || paymentData.amount || 0) : totalCents;
    } else {
      for (const item of cart) {
        const p = products.find(p => p.id === item.productId);
        if (p?.costUsdCents) {
          costoTotalOperacionCents += (p.costUsdCents * item.qty);
        }
      }
    }

    // ✅ Convertir a decimal para compatibilidad
    const subtotal = fromCentsBs(subtotalCents);
    const iva = fromCentsBs(ivaCents);
    const total = fromCentsBs(totalCents);
    const finalTotal = fromCentsBs(finalTotalCents);
    const costoTotalOperacion = fromCentsBs(costoTotalOperacionCents);

    let targetClientId: number | undefined = undefined;
    if (type === 'credito') {
      const totalDebtCents = finalTotalCents;
      if (paymentData.isNewClient) {
        const nextClientId = getVenezuelaTimestamp();
        const newClient: Client = { 
          id: nextClientId, 
          name: paymentData.clientName, 
          cedula: paymentData.clientCedula, 
          phone: paymentData.clientPhone || '', 
          address: paymentData.clientAddress || '', 
          debt: total,
          debtCents: totalDebtCents,
        };
        await syncService.saveClient(newClient);
        targetClientId = nextClientId;
        setClients(prev => [...prev, newClient]);
      } else if (paymentData.clientId) {
        targetClientId = Number(paymentData.clientId);
        const clientToUpdate = clients.find(c => c.id === targetClientId);
        if (clientToUpdate) {
          const currentDebtCents = clientToUpdate.debtCents || toCentsBs(clientToUpdate.debt || 0);
          const newDebtCents = currentDebtCents + totalDebtCents;
          const updatedClient = { 
            ...clientToUpdate, 
            debt: fromCentsBs(newDebtCents),
            debtCents: newDebtCents,
          };
          await syncService.saveClient(updatedClient);
          setClients(prev => prev.map(c => c.id === targetClientId ? updatedClient : c));
        }
      }
    } else if (paymentData.clientId) {
      targetClientId = Number(paymentData.clientId);
    }

    const txId = getVenezuelaTimestamp();
    
    // ✅ Convertir payments a céntimos
    const paymentsInCents = paymentData.payments?.map((p: Payment) => ({
      ...p,
      amountCents: p.amountCents || toCentsBs(p.amount || 0),
      usdAmountCents: p.usdAmountCents || toCentsUsd(p.usdAmount || 0),
    })) || [];

    const tx: Transaction = {
      id: txId, 
      date: getVenezuelaISOString(), 
      type: type as any, 
      items: type === 'cobro_deuda' ? [] : [...cart],
      subtotal: isSpecial ? 0 : (type === 'cobro_deuda' ? finalTotal : subtotal),
      iva: isSpecial ? 0 : iva, 
      total: isSpecial ? 0 : finalTotal,
      totalUsd: isSpecial ? costoTotalOperacion : roundTo2(finalTotal / exchangeRate),
      subtotalCents: isSpecial ? 0 : (type === 'cobro_deuda' ? finalTotalCents : subtotalCents),
      ivaCents: isSpecial ? 0 : ivaCents,
      totalCents: isSpecial ? 0 : finalTotalCents,
      totalUsdCents: isSpecial ? costoTotalOperacionCents : Math.round((finalTotalCents * 100) / rateCents),
      payMethod: paymentData.method || (type === 'credito' ? 'credito' : 'efectivo_bs'), 
      paidBs: isSpecial ? 0 : (paymentData.totalPaid || paymentData.amount || finalTotal),
      paidBsCents: isSpecial ? 0 : toCentsBs(paymentData.totalPaid || paymentData.amount || finalTotal),
      change: isSpecial ? 0 : (paymentData.change || 0),
      changeCents: isSpecial ? 0 : toCentsBs(paymentData.change || 0),
      clientId: targetClientId, 
      clientName: paymentData.clientName || clients.find(c => c.id === targetClientId)?.name || undefined,
      exchangeRate,
      exchangeRateCents: rateCents,
      receiptNumber: paymentData.receiptNumber || undefined,
      costoTotalOperacion: isSpecial ? costoTotalOperacion : undefined,
      notes: isSpecial ? paymentData.notes : undefined, 
      authorizedBy: isSpecial ? paymentData.authorizedBy : undefined,
      sessionId: currentSession?.id || undefined, 
      ajusteRedondeoBs: paymentData.ajusteRedondeoBs || 0,
      ajusteRedondeoBsCents: paymentData.ajusteRedondeoBsCents || 0,
      terminalId: terminalNameId,
      payments: paymentsInCents,
    };

    const stockUpdates: Map<number, { newStock: number }> = new Map();
    const kardexEntries: any[] = [];
    if (type !== 'cobro_deuda' && type !== 'devolucion') {
      const itemsToDiscountList = getItemsToDiscount(cart);
      for (const discountItem of itemsToDiscountList) {
        const product = discountItem.product;
        if (!product) continue;
        const newStock = product.stock - discountItem.quantity;
        stockUpdates.set(product.id, { newStock });
        
        let kardexType: any = 'venta';
        if (isSpecial) {
          if (type === 'colaboracion') kardexType = 'colaboracion';
          else if (type === 'consumo_propio') kardexType = 'consumo';
        }
        
        kardexEntries.push({
          id: `${Date.now()}_${Math.random()}`,
          productId: product.id,
          date: tx.date,
          type: kardexType,
          quantity: -discountItem.quantity,
          previousStock: product.stock,
          newStock,
          reference: isSpecial ? `[${type}] ${paymentData.notes || 'Sin motivo'}` : `Venta #${tx.id}`,
          note: isSpecial ? `[${type}] ${paymentData.notes || 'Sin motivo'}` : `Venta #${tx.id}`,
          costUsd: product.costUsd,
          costUsdCents: product.costUsdCents || 0,
        });
      }
    }

    let accountingEntry: any = null;
    if (type === 'contado' || type === 'cobro_deuda') {
      accountingEntry = {
        id: getVenezuelaTimestamp() + 1,
        date: getVenezuelaISOString(),
        type: 'ingreso',
        category: type === 'cobro_deuda' ? 'cobro_deuda' : 'ventas',
        concept: type === 'cobro_deuda' ? 'Cobro de deuda' : 'Venta',
        description: `Cliente: ${tx.clientName || 'Cliente Final'} - Pago: ${tx.payMethod}`,
        amount: tx.total,
        amountCents: tx.totalCents || 0,
        totalUsd: tx.totalUsd,
        exchangeRate: exchangeRate,
        referenceId: tx.id,
        referenceType: type,
        createdAt: getVenezuelaISOString(),
      };
    }

    const newTxs = [...(register.txs || []), tx];
    
    await syncService.runAtomicSale(terminalId, tx, { 
      products: stockUpdates, 
      kardexEntries,
      accountingEntry: accountingEntry, 
      registerUpdate: { txs: newTxs } 
    });

    if (type !== 'cobro_deuda') setCart([]);
    return tx;
  }, [cart, register, exchangeRate, clients, products, terminalId, terminalNameId, getItemsToDiscount, currentSession, user?.uid]);
  
  const payClientDebt = useCallback(async (clientId: number, totalPaidUsd: number, payments: Payment[]) => {
    const registerData = registerRef.current;
    if (!registerData?.isOpen) throw new Error('La caja no está abierta.');

    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error('Cliente no encontrado.');

    const rateCents = rateToCents(exchangeRate);
    const totalPaidUsdCents = toCentsUsd(totalPaidUsd);
    const totalPaidBsCents = Math.round((totalPaidUsdCents * rateCents) / 100);
    const totalPaidBs = fromCentsBs(totalPaidBsCents);

    // ✅ Convertir payments a céntimos
    const paymentsInCents = payments.map((p: Payment) => ({
      ...p,
      amountCents: p.amountCents || toCentsBs(p.amount || 0),
      usdAmountCents: p.usdAmountCents || toCentsUsd(p.usdAmount || 0),
    }));

    const txId = getVenezuelaTimestamp();
    const newTransaction: Transaction = {
      id: txId,
      date: getVenezuelaISOString(),
      type: 'cobro_deuda',
      items: [],
      total: totalPaidBs,
      totalUsd: totalPaidUsd,
      subtotal: totalPaidBs,
      subtotalCents: totalPaidBsCents,
      iva: 0,
      ivaCents: 0,
      totalCents: totalPaidBsCents,
      totalUsdCents: totalPaidUsdCents,
      payMethod: payments.length > 1 ? 'multi_pago' : (payments[0]?.method || 'pago_deuda'),
      payments: paymentsInCents,
      paidBs: totalPaidBs,
      paidBsCents: totalPaidBsCents,
      change: 0,
      changeCents: 0,
      clientId: clientId,
      clientName: client.name,
      exchangeRate: exchangeRate,
      exchangeRateCents: rateCents,
      sessionId: currentSession?.id,
      terminalId: terminalNameId,
      notes: `Abono a deuda de ${client.name}`,
    };

    const accountingEntry = {
      id: txId + 1,
      date: getVenezuelaISOString(),
      type: 'ingreso',
      category: 'cobro_deuda',
      concept: `Cobro a ${client.name}`,
      description: `Pago recibido de ${client.name} por un total de $${totalPaidUsd.toFixed(2)}`,
      amount: totalPaidBs,
      amountCents: totalPaidBsCents,
      totalUsd: totalPaidUsd,
      exchangeRate: exchangeRate,
      referenceId: txId,
      referenceType: 'cobro_deuda',
      createdAt: getVenezuelaISOString(),
    };

    const currentDebtCents = client.debtCents || toCentsBs(client.debt || 0);
    const newDebtCents = Math.max(0, currentDebtCents - totalPaidBsCents);
    const updatedClient = {
      ...client,
      debt: fromCentsBs(newDebtCents),
      debtCents: newDebtCents,
    };

    const registerUpdate = {
      txs: [...(registerData.txs || []), newTransaction],
    };

    await syncService.runAtomicSale(terminalId, newTransaction, {
      products: new Map(),
      kardexEntries: [],
      accountingEntry: accountingEntry,
      registerUpdate: registerUpdate,
    });

    await syncService.saveClient(updatedClient);

    setClients(prev => prev.map(c => c.id === clientId ? updatedClient : c));
    setTransactions(prev => [...prev, newTransaction]);

    setRegister(prevRegister => {
        if (!prevRegister?.isOpen) return prevRegister;
        const updatedRegister = { 
            ...prevRegister, 
            txs: [...(prevRegister.txs || []), newTransaction] 
        };
        registerRef.current = updatedRegister;
        saveRegisterToLocalStorage(updatedRegister);
        return updatedRegister;
    });

    return newTransaction;
  }, [clients, exchangeRate, currentSession?.id, terminalNameId, terminalId, saveRegisterToLocalStorage]);


  const applyAbono = useCallback(async (clientId: number, amount: number, method: string = 'efectivo_bs') => {
     const amountUsd = amount / exchangeRate;
     const payments: Payment[] = [{ 
       id: '1', 
       method, 
       amount, 
       usdAmount: amountUsd,
       amountCents: toCentsBs(amount),
       usdAmountCents: toCentsUsd(amountUsd),
     }];
     return payClientDebt(clientId, amountUsd, payments);
  }, [exchangeRate, payClientDebt]);

  const registerCashEgress = useCallback(async (
    amount: number,
    reason: string,
    referenceId: number,
    payMethod: string = 'efectivo_bs',
    usdAmount?: number
  ) => {
    if (!register?.isOpen) throw new Error('Caja no abierta');

    const rateCents = rateToCents(exchangeRate);
    const isUsd = payMethod === 'usd_efectivo' || payMethod === 'zelle';
    
    let totalBsCents: number;
    let totalUsdCents: number;
    
    if (isUsd) {
      const usdCents = toCentsUsd(usdAmount || 0);
      totalUsdCents = usdCents;
      totalBsCents = Math.round((usdCents * rateCents) / 100);
    } else {
      totalBsCents = toCentsBs(amount);
      totalUsdCents = Math.round((totalBsCents * 100) / rateCents);
    }
    
    const totalBs = fromCentsBs(totalBsCents);
    const totalUsd = fromCentsUsd(totalUsdCents);

    const tx: Transaction = {
      id: getVenezuelaTimestamp(),
      date: getVenezuelaISOString(),
      type: 'devolucion',
      items: [],
      subtotal: totalBs,
      iva: 0,
      total: totalBs,
      totalUsd: totalUsd,
      subtotalCents: totalBsCents,
      ivaCents: 0,
      totalCents: totalBsCents,
      totalUsdCents: totalUsdCents,
      payMethod: payMethod,
      paidBs: totalBs,
      paidBsCents: totalBsCents,
      change: 0,
      changeCents: 0,
      clientId: undefined,
      clientName: 'DEVOLUCIÓN',
      exchangeRate,
      exchangeRateCents: rateCents,
      notes: reason,
      sessionId: currentSession?.id || undefined,
      terminalId: terminalNameId,
      payments: [{
        id: crypto.randomUUID(),
        method: payMethod,
        amount: isUsd ? (usdAmount || 0) : amount,
        usdAmount: isUsd ? (usdAmount || 0) : undefined,
        amountCents: isUsd ? toCentsUsd(usdAmount || 0) : toCentsBs(amount),
        usdAmountCents: isUsd ? toCentsUsd(usdAmount || 0) : undefined,
      }],
    };

    const accountingEntry = {
      id: getVenezuelaTimestamp() + 3,
      date: getVenezuelaISOString(),
      type: 'egreso',
      category: 'devolucion',
      concept: 'Devolución de venta',
      description: reason,
      amount: totalBs,
      amountCents: totalBsCents,
      totalUsd: tx.totalUsd,
      exchangeRate: exchangeRate,
      referenceId: tx.id,
      referenceType: 'devolucion',
      createdAt: getVenezuelaISOString(),
    };

    const newTxs = [...(register.txs || []), tx];
    await syncService.runAtomicSale(terminalId, tx, {
      products: new Map(),
      kardexEntries: [],
      accountingEntry: accountingEntry,
      registerUpdate: { txs: newTxs }
    });
    return tx;
  }, [register, exchangeRate, terminalId, terminalNameId, currentSession]);

  const setExchangeRateProxy = useCallback(async (newRate: number) => {
    setExchangeRate(newRate);
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, newRate.toString());
    recalcAllPricesWithNewRate(newRate);
    try {
      await syncService.saveGlobalSettings({ exchangeRate: newRate });
    } catch (error) {
      console.warn("No se pudo sincronizar la tasa con la nube (modo offline o error)", error);
    }
  }, [recalcAllPricesWithNewRate]);

  const refreshProductsList = useCallback(async () => {
    const newProducts = await syncService.getProducts();
    setProducts(newProducts);
  }, []);

  return {
    products, setProducts, addProduct, updateProduct, deleteProduct,
    clients, setClients, saveClient, deleteClient, transactions, setTransactions, accounts, setAccounts,
    register, setRegister, openCashRegister, closeCashRegister,
    exchangeRate, setExchangeRate: setExchangeRateProxy,
    cart, addToCart, removeFromCart, updateCartQty, updateCartItemPrice,
    isIvaEnabled, setIsIvaEnabled, currentPage, setCurrentPage,
    finalizeSale, applyAbono, payClientDebt, registerCashEgress,
    isHydrated, globalIvaPercentage, adminCode, checkProductStock, refreshProductsList,
    currentSession, setCurrentSession, reloadSession, createCashSession, closeCashSession,
    refreshAllData,
  };
}