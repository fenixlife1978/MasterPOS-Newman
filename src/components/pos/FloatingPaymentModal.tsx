"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, DollarSign, CreditCard, Banknote, Smartphone, Fingerprint, Plane, Plus, Trash2, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  formatBs, 
  formatUsd, 
  formatUsdNumber,
  toCentsBs,
  toCentsUsd,
  fromCentsBs,
  fromCentsUsd,
  parseCentsFromString,
} from '@/lib/currency-formatter';

// ✅ Función de redondeo local
const roundTo2 = (num: number): number => Math.round(num * 100) / 100;

interface PaymentItem {
  id: string;
  method: string;
  amount: number;      // ⚠️ DEPRECATED - usar amountCents
  usdAmount?: number;  // ⚠️ DEPRECATED - usar usdAmountCents
  amountCents: number; // ✅ MONTO EN CÉNTIMOS (según moneda del método)
  usdAmountCents?: number; // ✅ MONTO USD EN CÉNTIMOS
}

interface FloatingPaymentModalProps {
  total: number;       // ⚠️ DEPRECATED - usar totalCents
  totalCents: number;  // ✅ TOTAL EN CÉNTIMOS DE BS
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: { 
    payments: PaymentItem[]; 
    totalPaid: number; 
    totalPaidCents: number;
    change: number; 
    changeCents: number;
    method: string; 
    ajusteRedondeoBs?: number;
    ajusteRedondeoBsCents?: number;
  }) => void;
}

const methods = [
  { id: 'efectivo_bs', label: 'EFECTIVO Bs', icon: Banknote, currency: 'Bs' },
  { id: 'usd_efectivo', label: 'EFECTIVO USD', icon: DollarSign, currency: 'USD' },
  { id: 'tarjeta', label: 'TARJETA', icon: CreditCard, currency: 'Bs' },
  { id: 'biopago', label: 'BIOPAGO', icon: Fingerprint, currency: 'Bs' },
  { id: 'pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, currency: 'Bs' },
  { id: 'zelle', label: 'ZELLE', icon: Plane, currency: 'USD' },
];

export default function FloatingPaymentModal({ 
  total, 
  totalCents, 
  exchangeRate, 
  onClose, 
  onConfirm 
}: FloatingPaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [currentMethod, setCurrentMethod] = useState('efectivo_bs');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMethodObj = methods.find(m => m.id === currentMethod);
  const isUsd = currentMethodObj?.currency === 'USD';

  // ✅ Total pagado en céntimos
  const totalPaidCents = payments.reduce((sum, p) => sum + (p.amountCents || toCentsBs(p.amount)), 0);
  const totalPaid = fromCentsBs(totalPaidCents);
  
  // ✅ RECONCILIACIÓN BIMONETARIA EXACTA EN CÉNTIMOS
  const totalUsdCents = Math.round((totalCents * 100) / Math.round(exchangeRate * 100));
  const totalUsd = fromCentsUsd(totalUsdCents);
  
  const totalPaidUsdCents = payments.reduce((sum, p) => {
    if (p.usdAmountCents) return sum + p.usdAmountCents;
    // Si no tiene usdAmountCents, calcular desde amountCents
    const amountCents = p.amountCents || toCentsBs(p.amount);
    return sum + Math.round((amountCents * 100) / Math.round(exchangeRate * 100));
  }, 0);
  const totalPaidUsd = fromCentsUsd(totalPaidUsdCents);

  // ✅ Una factura se considera pagada si la suma en USD cubre el total en USD
  // o si la suma en Bs cubre el total en Bs
  const isPaidByUsd = totalPaidUsdCents >= (totalUsdCents - 1); // Tolerancia de 1 céntimo
  const isFullyPaid = isPaidByUsd || (totalPaidCents >= totalCents - 1); // Tolerancia de 1 céntimo

  const remainingCents = isFullyPaid ? 0 : Math.max(0, totalCents - totalPaidCents);
  const remaining = fromCentsBs(remainingCents);
  
  // ✅ LÓGICA DE VUELTO RECONCILIADO EN CÉNTIMOS
  let changeCents = Math.max(0, totalPaidCents - totalCents);
  
  // Si el pago en USD es IDÉNTICO al total en USD (margen de 1 céntimo), 
  // forzamos el vuelto a 0 si la diferencia en Bs es despreciable (error de redondeo)
  if (isPaidByUsd && Math.abs(totalPaidUsdCents - totalUsdCents) <= 1 && changeCents <= 5) {
    changeCents = 0;
  }
  
  const change = fromCentsBs(changeCents);
  
  // Si está pagado por USD pero faltan céntimos en Bs, calculamos el ajuste
  const ajusteRedondeoBsCents = (isPaidByUsd && totalPaidCents < totalCents) ? (totalCents - totalPaidCents) : 0;
  const ajusteRedondeoBs = fromCentsBs(ajusteRedondeoBsCents);

  // BLINDAJE VISUAL: Si ya se pagó exacto en USD, forzamos a la interfaz a mostrar que se pagó el 100% en Bs
  const displayedTotalPaidBsCents = (isPaidByUsd && (ajusteRedondeoBsCents > 0 || (totalPaidCents > totalCents && changeCents === 0))) ? totalCents : totalPaidCents;
  const displayedTotalPaidBs = fromCentsBs(displayedTotalPaidBsCents);

  const addPayment = () => {
    let rawAmount = parseFloat(inputValue);
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    if (isUsd) {
      const usdAmount = rawAmount;
      const usdAmountCents = toCentsUsd(usdAmount);
      const bsAmountCents = Math.round((usdAmountCents * Math.round(exchangeRate * 100)) / 100);
      const bsAmount = fromCentsBs(bsAmountCents);
      const newPayment: PaymentItem = {
        id: crypto.randomUUID(),
        method: currentMethod,
        amount: bsAmount,
        usdAmount: usdAmount,
        amountCents: bsAmountCents,
        usdAmountCents: usdAmountCents,
      };
      setPayments([...payments, newPayment]);
    } else {
      const bsAmount = rawAmount;
      const bsAmountCents = toCentsBs(bsAmount);
      const newPayment: PaymentItem = {
        id: crypto.randomUUID(),
        method: currentMethod,
        amount: bsAmount,
        amountCents: bsAmountCents,
      };
      setPayments([...payments, newPayment]);
    }
    setInputValue('');
    inputRef.current?.focus();
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const setExactAmount = () => {
    const currentRemainingCents = Math.max(0, totalCents - totalPaidCents);
    if (currentRemainingCents <= 0) return;
    
    let amountToAdd = fromCentsBs(currentRemainingCents);
    if (isUsd) {
      // Si no hay pagos cargados, usamos directamente el total en USD calculado
      if (payments.length === 0) {
        amountToAdd = fromCentsUsd(totalUsdCents);
      } else {
        amountToAdd = fromCentsUsd(Math.round((currentRemainingCents * 100) / Math.round(exchangeRate * 100)));
      }
    }
    setInputValue(amountToAdd.toFixed(2));
  };

  const confirmPayment = useCallback(() => {
    if (!isFullyPaid) return;
    setIsProcessing(true);
    const mainPayment = payments[0] || { method: 'efectivo_bs' };
    
    // Aplicar la misma lógica de redondeo exacto al confirmar
    let finalChangeCents = Math.max(0, totalPaidCents - totalCents);
    if (isPaidByUsd && Math.abs(totalPaidUsdCents - totalUsdCents) <= 1 && finalChangeCents <= 5) {
      finalChangeCents = 0;
    }
    
    const finalChange = fromCentsBs(finalChangeCents);
    const finalTotalPaid = fromCentsBs(totalPaidCents);

    onConfirm({ 
      payments, 
      totalPaid: finalTotalPaid,
      totalPaidCents: totalPaidCents,
      change: finalChange,
      changeCents: finalChangeCents,
      method: mainPayment.method,
      ajusteRedondeoBs,
      ajusteRedondeoBsCents,
    });
    setIsProcessing(false);
  }, [payments, totalPaidCents, totalCents, isFullyPaid, isPaidByUsd, totalPaidUsdCents, totalUsdCents, ajusteRedondeoBs, ajusteRedondeoBsCents, onConfirm]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (isFullyPaid) confirmPayment();
      }
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        addPayment();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullyPaid, confirmPayment, addPayment, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatPaymentAmount = (payment: PaymentItem) => {
    const methodInfo = methods.find(m => m.id === payment.method);
    if (methodInfo?.currency === 'USD') {
      const usdValue = payment.usdAmount ?? fromCentsUsd(payment.usdAmountCents || 0);
      return formatUsd(usdValue);
    }
    return formatBs(payment.amount);
  };

  return (
    <div
      className="fixed z-[200] bg-white rounded-2xl shadow-2xl w-[500px] max-w-[90vw] border border-gray-200 overflow-hidden"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed'
      }}
    >
      <div className="bg-[#1A2C4E] p-2 text-white flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <Calculator size={18} />
          <h3 className="font-black text-sm">Pago / Cobro</h3>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-xl text-center shadow-sm">
            <span className="text-[10px] font-black text-black/60 uppercase tracking-wider">Total a pagar</span>
            <p className="text-3xl font-black mt-1 text-black">{formatBs(total)}</p>
            <p className="text-xs font-bold text-black/60 mt-0.5">≈ {formatUsd(total / exchangeRate)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl text-center shadow-sm">
            <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">Pagado</span>
            <p className="text-3xl font-black mt-1 text-green-700">{formatBs(displayedTotalPaidBs)}</p>
            {totalPaidUsd > 0 && <p className="text-xs font-bold text-green-600 mt-0.5">USD {formatUsdNumber(totalPaidUsd)}</p>}
          </div>
        </div>

        <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
          {payments.length === 0 ? (
            <div className="text-center py-3 text-xs text-black/40">No hay pagos registrados</div>
          ) : (
            <div className="divide-y">
              {payments.map(p => {
                const methodInfo = methods.find(m => m.id === p.method);
                return (
                  <div key={p.id} className="flex justify-between items-center p-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      {methodInfo?.icon && <methodInfo.icon size={14} />}
                      <span className="font-bold">{methodInfo?.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatPaymentAmount(p)}</span>
                      <button onClick={() => removePayment(p.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[8px] font-black uppercase text-black/60 block mb-0.5">Método de pago</label>
            <select
              value={currentMethod}
              onChange={(e) => setCurrentMethod(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
            >
              {methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[8px] font-black uppercase text-black/60 block mb-0.5">Monto</label>
            <div className="flex gap-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
                className="flex-1 border rounded-lg px-2 py-1.5 text-xs font-mono text-right"
                placeholder="0.00"
              />
              <button onClick={addPayment} className="bg-primary px-2.5 rounded-lg text-black font-bold text-[10px]">
                <Plus size={12} />
              </button>
            </div>
            <p className="text-[7px] text-black/40 mt-0.5 text-right">
              {isUsd ? 'Monto en USD' : 'Monto en Bs'}
            </p>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <button
            onClick={setExactAmount}
            className="flex-1 py-1.5 bg-gray-100 text-black text-[10px] font-bold rounded-lg border hover:bg-gray-200 transition"
          >
            Monto Exacto
          </button>
          <button
            onClick={addPayment}
            className="flex-1 py-1.5 bg-[#D4A017] text-black text-[10px] font-bold rounded-lg hover:brightness-110 transition"
          >
            Agregar pago
          </button>
        </div>

        {/* Banner de respuesta dinámica */}
        <div className={cn(
          "rounded-xl p-2.5 text-center border transition-colors",
          remainingCents > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        )}>
          {remainingCents > 0 ? (
            <>
              <p className="text-[9px] font-black text-red-700 uppercase tracking-wider">Faltante</p>
              <p className="text-3xl font-black text-red-700 mt-0.5">{formatBs(remaining)}</p>
              <p className="text-sm font-bold text-red-600 mt-0.5">≈ {formatUsd(remaining / exchangeRate)}</p>
            </>
          ) : changeCents > 0 ? (
            <>
              <p className="text-[9px] font-black text-green-700 uppercase tracking-wider">Vuelto en Bs</p>
              <p className="text-3xl font-black text-green-700 mt-0.5">{formatBs(change)}</p>
              <p className="text-sm font-bold text-green-600 mt-0.5">≈ {formatUsd(change / exchangeRate)}</p>
            </>
          ) : (
            <p className="text-sm font-black text-green-700 py-1">✅ Pago exacto - Sin vuelto</p>
          )}
        </div>

        <button
          onClick={confirmPayment}
          disabled={!isFullyPaid || isProcessing}
          className={cn(
            "w-full py-2 rounded-xl text-white font-black text-sm transition-all",
            isFullyPaid ? "bg-[#2ECC71] hover:brightness-110 shadow-md" : "bg-gray-400 cursor-not-allowed"
          )}
        >
          {isProcessing ? "Procesando..." : (changeCents > 0 ? `COMPLETAR - Vuelto ${formatBs(change)}` : "COMPLETAR PAGO")}
        </button>
        <p className="text-center text-[8px] text-black/40">
          ␣ Espacio para finalizar | ESC para cerrar | Enter agrega monto
        </p>
      </div>
    </div>
  );
}