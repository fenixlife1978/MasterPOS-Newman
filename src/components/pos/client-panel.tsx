"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, CartItem, Transaction } from '@/lib/types';
import { UserCircle, X, CheckCircle, HandCoins, Eye, History, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSState } from '@/hooks/use-pos-state';
import FloatingPaymentModal from './FloatingPaymentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatBs, formatUsd, formatBsNumber, formatUsdNumber } from '@/lib/currency-formatter';
import ReceiptModal from '@/components/receipt-modal';

// ✅ Función para convertir decimal a céntimos
const decimalToCents = (amount: number): number => Math.round(amount * 100);

interface ClientPanelProps {
  client: Client;
  state: ReturnType<typeof usePOSState>;
  onClose: () => void;
}

interface ProductItem {
  name: string;
  qty: number;
  priceBs: number;
  priceUsd: number;
}

export default function ClientPanel({ client, state, onClose }: ClientPanelProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(state.exchangeRate);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // State for new payment UI
  const [inputCurrency, setInputCurrency] = useState<'bs' | 'usd'>('bs');
  const [amountStr, setAmountStr] = useState('');

  useEffect(() => {
    setCurrentExchangeRate(state.exchangeRate);
  }, [state.exchangeRate]);

  const clientAccounts = useMemo(() => {
    return state.accounts
      .filter(a => a.clientId === client.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.accounts, client.id]);

  const totalDebt = useMemo(() => {
    return clientAccounts
      .filter(a => a.status !== 'pagada')
      .reduce((sum, a) => {
        const totalUsd = a.amountUsd || (a.amountBs / (a.exchangeRate || currentExchangeRate));
        const paidUsd = (a.paidAmount || 0) / (a.exchangeRate || currentExchangeRate);
        const remainingUsd = totalUsd - paidUsd;
        const remainingBs = remainingUsd * currentExchangeRate;
        return sum + Math.max(0, remainingBs);
      }, 0);
  }, [clientAccounts, currentExchangeRate]);

  const totalDebtUsd = totalDebt / currentExchangeRate;

  const getHistoricalExchangeRate = useCallback(() => {
    if (selectedTransaction?.accountInfo?.exchangeRate) return selectedTransaction.accountInfo.exchangeRate;
    if (selectedTransaction?.exchangeRate) return selectedTransaction.exchangeRate;
    return null;
  }, [selectedTransaction]);

  const getRemainingBsForAccount = useCallback((account: any): number => {
    const totalUsd = account.amountUsd || (account.amountBs / (account.exchangeRate || currentExchangeRate));
    const paidUsd = (account.paidAmount || 0) / (account.exchangeRate || currentExchangeRate);
    const remainingUsd = totalUsd - paidUsd;
    return Math.max(0, remainingUsd * currentExchangeRate);
  }, [currentExchangeRate]);

  const getTotalUsdForAccount = useCallback((account: any): number => {
    return account.amountUsd || (account.amountBs / (account.exchangeRate || currentExchangeRate));
  }, [currentExchangeRate]);

  const handleAmountChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setAmountStr(sanitized);
  };

  const bsValue = useMemo(() => {
    const num = parseFloat(amountStr) || 0;
    return inputCurrency === 'bs' ? num : num * currentExchangeRate;
  }, [amountStr, inputCurrency, currentExchangeRate]);

  const usdValue = useMemo(() => {
    const num = parseFloat(amountStr) || 0;
    return inputCurrency === 'usd' ? num : num / currentExchangeRate;
  }, [amountStr, inputCurrency, currentExchangeRate]);

  const handleSetPayment = (percentage: number) => {
    const targetDebt = totalDebt * (percentage / 100);
    if (inputCurrency === 'bs') {
      setAmountStr(targetDebt.toFixed(2));
    } else {
      setAmountStr((targetDebt / currentExchangeRate).toFixed(2));
    }
  };

  const handleOpenPaymentModal = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const amount = bsValue;
    if (amount <= 0) {
      alert('Ingrese un monto válido');
      setIsProcessing(false);
      return;
    }
    if (amount > totalDebt + 0.01) {
      alert('El abono no puede ser mayor a la deuda total');
      setIsProcessing(false);
      return;
    }
    setPaymentAmount(amount);
    setShowPaymentModal(true);
  }, [bsValue, totalDebt, isProcessing]);

  const handlePaymentConfirm = useCallback(async (paymentData: any) => {
    const tx = await state.applyAbono(client.id, paymentData);
    
    setShowPaymentModal(false);
    setIsProcessing(false);
    setAmountStr('');
    
    if (tx) {
      setLastTx(tx);
      setShowReceipt(true);
    } else {
      alert(`Pago registrado correctamente. Monto: ${formatBs(paymentData.totalPaid)}`);
    }
  }, [state, client.id]);

  const handleTransactionClick = useCallback((account: any) => {
    const transaction = state.transactions.find(t => t.id === account.txId);
    setSelectedTransaction({ ...transaction, accountInfo: account });
    setShowDetailModal(true);
  }, [state.transactions]);

  // ... (Other functions like getStatusColor, formatDate, getTransactionItems remain the same)
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pagada': return 'bg-green-100 text-green-700 border-green-200';
      case 'parcial': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-red-100 text-red-700 border-red-200';
    }
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, []);

  const getTransactionItems = useCallback((): ProductItem[] => {
    if (selectedTransaction?.items?.length > 0) {
      return selectedTransaction.items.map((item: CartItem) => ({ name: item.name, qty: item.qty, priceBs: item.priceBs || 0, priceUsd: item.priceUsd || 0 }));
    }
    if (selectedTransaction?.accountInfo?.products) {
        const productsStr = selectedTransaction.accountInfo.products;
        if (typeof productsStr === 'string') {
            const items = productsStr.split(',').map((item: string) => item.trim());
            return items.map((item: string): ProductItem => {
                const match = item.match(/(.+)\sx(\d+)$/);
                if (match) return { name: match[1], qty: parseInt(match[2], 10), priceBs: 0, priceUsd: 0 };
                const name = item.trim();
                if (name.includes("DEUDA INICIAL")) return { name, qty: 1, priceBs: selectedTransaction.accountInfo.amountBs, priceUsd: selectedTransaction.accountInfo.amountUsd };
                return { name: item, qty: 1, priceBs: 0, priceUsd: 0 };
            });
        }
    }
    return [];
}, [selectedTransaction]);

  const getAbonosForCurrentAccount = useCallback(() => {
    if (!selectedTransaction?.accountInfo) return [];
    const currentTxId = String(selectedTransaction.accountInfo.txId);
    return state.transactions
      .filter(t => {
        if (t.type !== 'cobro_deuda' && t.type !== 'devolucion') return false;
        if (t.referenceId && String(t.referenceId) === currentTxId) return true;
        if (t.notes && t.notes.includes(currentTxId)) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.transactions, selectedTransaction]);

  const historicalRate = getHistoricalExchangeRate();

  return (
    <>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-black">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-black/20">
            <UserCircle size={22} className="text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold truncate text-black">{client.name}</div>
            <div className="text-[11px] font-medium text-black">{client.cedula} | {client.phone}</div>
          </div>
          <button onClick={onClose} className="text-black/60 hover:text-black transition-colors p-1" aria-label="Cerrar panel">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Deuda Total */}
          <div>
             <div className="text-[10px] font-bold text-black uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <span>Deuda Actual</span>
              <span className="text-[8px] text-black/40 flex items-center gap-1"><RefreshCw size={8} /> Tasa actualizada</span>
            </div>
            <div className="bg-white border border-black rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold text-black uppercase tracking-wider">Total Pendiente</div>
              <div className={cn("text-2xl font-black mt-1", totalDebt > 0 ? "text-[#E74C3C]" : "text-[#2ECC71]")}>{formatBs(totalDebt)}</div>
              <div className="text-[12px] font-bold text-black mt-0.5">{formatUsd(totalDebtUsd)}</div>
              <div className="text-[9px] font-bold text-black mt-1">Tasa: 1 USD = {formatBsNumber(currentExchangeRate)}</div>
            </div>
          </div>

          {/* Payment UI */}
          {totalDebt > 0 && (
            <div className="bg-white border-2 border-primary rounded-xl p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleSetPayment(100)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-green-600 text-white text-[11px] font-bold rounded-lg hover:brightness-110 transition-all uppercase shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={12} /> Pagar Total
                </button>
                <button 
                  onClick={() => handleSetPayment(50)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-yellow-500 text-black text-[11px] font-bold rounded-lg hover:brightness-110 transition-all uppercase shadow-md disabled:opacity-50"
                >
                  Pagar 50%
                </button>
              </div>

              <div className="relative">
                  <input 
                      id="abono-input"
                      type="text" 
                      value={amountStr}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder={`Monto en ${inputCurrency.toUpperCase()}`}
                      className="w-full bg-background border-2 border-black rounded-lg px-3 py-3 text-lg font-black text-black outline-none focus:border-primary transition-colors text-center placeholder:text-black/40 disabled:opacity-50"
                      disabled={isProcessing}
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                      <button onClick={() => setInputCurrency('bs')} className={cn("px-2 py-0.5 text-[10px] rounded-md font-bold", inputCurrency === 'bs' ? "bg-primary text-black" : "bg-gray-300 text-black/60")}>BS</button>
                      <button onClick={() => setInputCurrency('usd')} className={cn("px-2 py-0.5 text-[10px] rounded-md font-bold", inputCurrency === 'usd' ? "bg-green-500 text-white" : "bg-gray-300 text-black/60")}>USD</button>
                  </div>
              </div>

              <div className="text-center bg-gray-100 rounded-lg py-1.5 px-2">
                  <span className="text-xs font-bold text-gray-500">Equivale a: </span>
                  <span className="text-sm font-black text-black">{inputCurrency === 'bs' ? formatUsd(usdValue) : formatBs(bsValue)}</span>
              </div>
              
              <button 
                onClick={handleOpenPaymentModal}
                disabled={isProcessing || bsValue <= 0}
                className="w-full py-3 bg-primary text-black text-sm font-black rounded-lg hover:brightness-110 transition-all uppercase shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <><Loader2 size={16} className="animate-spin"/> PROCESANDO...</> : <><HandCoins size={14}/> PROCEDER AL PAGO</>}
              </button>
              
              <p className="text-[10px] font-bold text-black/70 leading-tight text-center">
                Los abonos se aplican cronológicamente desde la deuda más antigua.
              </p>
            </div>
          )}

          {/* Credit Transactions */}
           <div>
            <div className="text-[10px] font-bold text-black uppercase tracking-widest mb-2 flex items-center justify-between px-1">
              <span>Transacciones de Crédito ({clientAccounts.length})</span>
            </div>
            <div className="space-y-1.5">
              {clientAccounts.length === 0 ? (
                <div className="text-center py-6 text-black/50 italic text-[12px]">Sin historial de crédito</div>
              ) : (
                clientAccounts.map(a => {
                  const remainingBs = getRemainingBsForAccount(a);
                  const totalUsd = getTotalUsdForAccount(a);
                  const isPaid = a.status === 'pagada';
                  const isPartial = a.status === 'parcial';
                  return (
                    <div 
                      key={a.id} 
                      onClick={() => handleTransactionClick(a)}
                      className="flex items-center gap-3 p-2.5 bg-white border border-black/40 rounded-lg transition-all hover:border-black hover:shadow-md cursor-pointer"
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTransactionClick(a); } }}
                    >
                      <div className="text-[11px] font-bold text-black w-12 shrink-0">
                        {new Date(a.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-black truncate">{a.products}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", getStatusColor(a.status))}>
                            {a.status === 'pagada' ? 'PAGADA' : a.status === 'parcial' ? 'PARCIAL' : 'PENDIENTE'}
                          </span>
                        </div>
                        <div className="text-[8px] font-bold text-black mt-0.5">Original: {formatUsd(totalUsd)} al {a.exchangeRate ? formatBsNumber(a.exchangeRate) : 'tasa histórica'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn("text-[13px] font-bold", isPaid ? "text-[#2ECC71]" : isPartial ? "text-[#F39C12]" : "text-[#E74C3C]")}>{formatBs(remainingBs)}</div>
                        <div className="text-[9px] font-bold text-black">{formatUsd(remainingBs / currentExchangeRate)}</div>
                      </div>
                      <Eye size={14} className="text-black font-bold flex-shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <FloatingPaymentModal 
          total={paymentAmount}
          totalCents={decimalToCents(paymentAmount)}
          exchangeRate={state.exchangeRate}
          onClose={() => {
            setShowPaymentModal(false);
            setIsProcessing(false);
          }}
          onConfirm={handlePaymentConfirm}
        />
      )}

      {/* Detail Modal and Receipt Modal remain the same... */}
       <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-white border border-[#9E9E9E] text-black max-w-2xl p-0 overflow-hidden rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del Crédito</DialogTitle></DialogHeader>
          {selectedTransaction && selectedTransaction.accountInfo && (
            <div className="flex flex-col h-full">
              <div className="bg-[#1A2C4E] p-5 text-white sticky top-0 z-10">
                <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 hover:opacity-70" aria-label="Cerrar detalle"><X size={20} /></button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center"><HandCoins size={24} className="text-primary" /></div>
                  <div>
                    <h3 className="text-xl font-black">Detalle del Crédito</h3>
                    <p className="text-white/60 text-sm">#{selectedTransaction.accountInfo.txId} • {selectedTransaction.accountInfo.clientName}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#9E9E9E]">
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Fecha</label>
                    <p className="text-sm font-bold text-black">{formatDate(selectedTransaction.accountInfo.date)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-black/60 uppercase tracking-widest">Monto Original (USD)</label>
                    <p className="text-lg font-black text-black">{formatUsd(selectedTransaction.accountInfo.amountUsd || (selectedTransaction.accountInfo.amountBs / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate)))}</p>
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-amber-700" />
                      <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Tasa BCV del Crédito</label>
                    </div>
                    <div className="text-right">
                      {historicalRate ? <p className="text-lg font-black text-amber-800">1 USD = {formatBsNumber(historicalRate)}</p> : <p className="text-sm font-bold text-red-600">No registrada</p>}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-black/60 uppercase flex items-center gap-2 mb-3">📦 PRODUCTOS</label>
                  <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#E8E8E8]"><tr className="border-b border-[#9E9E9E]">
                          <th className="text-left p-3 text-[10px] font-black text-black uppercase">CANT</th>
                          <th className="text-left p-3 text-[10px] font-black text-black uppercase">PRODUCTO</th>
                          <th className="text-right p-3 text-[10px] font-black text-black uppercase">TOTAL</th>
                      </tr></thead>
                      <tbody>{(() => {
                          const items = getTransactionItems();
                          if (items.length > 0) {
                            return items.map((item: ProductItem, idx: number) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50 hover:bg-[#F5F5F5]">
                                <td className="p-3 text-xs font-bold text-black">{item.qty}</td>
                                <td className="p-3 text-xs font-bold text-black">{item.name}</td>
                                <td className="p-3 text-right text-xs font-bold text-black">{item.priceUsd > 0 ? formatUsd(item.priceUsd * item.qty) : '—'}</td>
                              </tr>
                            ));
                          } return (<tr><td colSpan={3} className="text-center p-4 text-black/50 italic">No se pudieron cargar los productos</td></tr>);
                        })()}</tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-[#F5F5F5] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Pagado en Bs:</span>
                    <span className="font-bold text-green-600">{formatBs(selectedTransaction.accountInfo.paidAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-dashed border-[#9E9E9E]">
                    <span className="text-black/60 font-bold">Saldo Pendiente (USD Fijo):</span>
                    <span className="font-bold text-red-600">{formatUsd((selectedTransaction.accountInfo.amountUsd || 0) - ((selectedTransaction.accountInfo.paidAmount || 0) / (selectedTransaction.accountInfo.exchangeRate || currentExchangeRate)))}</span>
                  </div>
                </div>
                {(() => {
                  const abonos = getAbonosForCurrentAccount();
                  return abonos.length > 0 ? (
                    <div>
                      <label className="text-[10px] font-black text-black/60 uppercase flex items-center gap-2 mb-3"><History size={12} /> HISTORIAL DE ABONOS - Cuenta #{selectedTransaction.accountInfo.txId}</label>
                      <div className="border border-[#9E9E9E] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#E8E8E8]"><tr>
                              <th className="text-left p-3 text-[10px] font-black uppercase">FECHA</th>
                              <th className="text-right p-3 text-[10px] font-black uppercase">MONTO</th>
                              <th className="text-left p-3 text-[10px] font-black uppercase">MÉTODO</th>
                          </tr></thead>
                          <tbody>{abonos.map((abono, idx) => (
                              <tr key={idx} className="border-b border-[#9E9E9E]/50">
                                <td className="p-3 text-xs text-black font-bold">{new Date(abono.date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                <td className="p-3 text-right text-xs font-bold text-green-600">{formatBs(abono.total)}</td>
                                <td className="p-3 text-xs text-black">{abono.payMethod || 'Efectivo BS'}</td>
                              </tr>
                            ))}</tbody>
                        </table>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="bg-[#F5F5F5] p-4 border-t border-[#9E9E9E] flex justify-end">
                <Button onClick={() => setShowDetailModal(false)} className="bg-[#E8E8E8] text-black font-bold hover:bg-[#D4A017]">CERRAR</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showReceipt && lastTx && (
        <ReceiptModal 
          transaction={lastTx}
          exchangeRate={state.exchangeRate}
          onClose={() => { setShowReceipt(false); setLastTx(null); }}
        />
      )}
    </>
  );
}