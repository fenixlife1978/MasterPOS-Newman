"use client";

import { useState, useMemo } from 'react';
import { useAccounting } from '@/hooks/use-accounting';
import { Plus, Search, X, TrendingUp, TrendingDown, DollarSign, Filter, Eye, BarChart3 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ExpenseModal from './expense-modal';
import { formatBs, formatUsd } from '@/lib/currency-formatter';
import { usePOSState } from '@/hooks/use-pos-state';

const getTimestamp = (): number => Date.now();

const getVenezuelaDate = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

const formatDateFriendly = (dateStr: string): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return dateStr; }
};

const getMonthDateRange = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toISODateString = (date: Date) => date.toISOString().split('T')[0];
    return { start: toISODateString(startDate), end: toISODateString(endDate) };
};

export default function AccountingModule() {
  const { entries, addEntry } = useAccounting();
  const state = usePOSState();
  const globalExchangeRate = state.exchangeRate || 1;
  
  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [startDate, setStartDate] = useState(getMonthDateRange().start);
  const [endDate, setEndDate] = useState(getMonthDateRange().end);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const categoriesList = [
    { id: 'ventas', label: 'Ventas' },
    { id: 'compra_mercancia', label: 'Compra de Mercancía' },
    { id: 'pagos_proveedores', label: 'Pagos a Proveedores' },
    { id: 'servicios_publicos', label: 'Servicios Públicos' },
    { id: 'alquiler', label: 'Alquiler' },
    { id: 'telefonia', label: 'Telefonía' },
    { id: 'impuestos_municipales', label: 'Impuestos Municipales' },
    { id: 'declaracion_renta', label: 'Declaración de Renta' },
    { id: 'servicios_profesionales', label: 'Servicios Profesionales' },
    { id: 'reparacion_local', label: 'Reparación de Local' },
    { id: 'sueldos', label: 'Sueldos y Salarios' },
    { id: 'otros', label: 'Otros Gastos' },
    { id: 'devolucion', label: 'Devolución' },
    { id: 'cobro_deuda', label: 'Cobro de Deuda' },
    { id: 'cuenta_por_cobrar', label: 'Venta a Crédito' }
  ];

  const filteredEntries = useMemo(() => {
    return (entries || []).filter(entry => {
      if (entry.category === 'ajuste_inventario') return false;
      if (filterType !== 'todos' && entry.type !== filterType) return false;
      if (filterCategory !== 'todas' && entry.category !== filterCategory) return false;
      if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (new Date(entry.date) < start) return false;
      }
      if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(entry.date) > end) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, filterType, filterCategory, startDate, endDate]);

  const totals = useMemo(() => {
    const getRate = (e: any) => e.exchangeRate || globalExchangeRate;
    const totalIngresosUsd = filteredEntries.filter(e => e.type === 'ingreso').reduce((sum, e) => sum + (e.totalUsd || (e.amount / getRate(e))), 0);
    const totalEgresosUsd = filteredEntries.filter(e => e.type === 'egreso').reduce((sum, e) => sum + (e.totalUsd || (e.amount / getRate(e))), 0);
    const totalIngresosBs = filteredEntries.filter(e => e.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
    const totalEgresosBs = filteredEntries.filter(e => e.type === 'egreso').reduce((sum, e) => sum + e.amount, 0);
    const balanceUsd = totalIngresosUsd - totalEgresosUsd;
    const balanceBs = totalIngresosBs - totalEgresosBs;
    return { totalIngresosUsd, totalEgresosUsd, totalIngresosBs, totalEgresosBs, balanceUsd, balanceBs };
  }, [filteredEntries, globalExchangeRate]);

  const handleExpenseConfirm = async (data: any) => {
    if (!addEntry) return;
    const rateToSave = data.exchangeRate || globalExchangeRate;
    await addEntry({
      id: getTimestamp(),
      date: data.date || getVenezuelaDate(),
      type: 'egreso',
      category: data.category,
      subcategory: data.subcategory,
      concept: data.concept || data.category,
      description: data.description || '',
      amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
      totalUsd: data.amount / rateToSave,
      exchangeRate: rateToSave,
      referenceType: 'expense',
      createdAt: new Date().toISOString()
    });
    setShowExpenseModal(false);
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-headline font-black text-black uppercase">Libro Diario - Contabilidad</h2>
          <p className="text-sm text-black font-black mt-1 uppercase tracking-widest">Registro de Ingresos y Egresos en Tiempo Real</p>
        </div>
        <Button onClick={() => setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-black border-2 border-black shadow-lg h-10 px-6 text-sm">
          <Plus size={18} className="mr-2" /> REGISTRAR EGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><p className="text-[10px] font-black text-black uppercase tracking-widest">Ingresos del Mes</p></div>
          <p className="text-2xl font-black text-green-700">{formatUsd(totals.totalIngresosUsd)}</p>
          <p className="text-xs text-black font-black font-mono mt-0.5">{formatBs(totals.totalIngresosBs)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#9E9E9E] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={18} className="text-red-600" /><p className="text-[10px] font-black text-black uppercase tracking-widest">Egresos del Mes</p></div>
          <p className="text-2xl font-black text-red-700">{formatUsd(totals.totalEgresosUsd)}</p>
          <p className="text-xs text-black font-black font-mono mt-0.5">{formatBs(totals.totalEgresosBs)}</p>
        </div>
        <div className={cn("bg-white rounded-xl border-2 p-4 shadow-md", totals.balanceUsd >= 0 ? "border-green-500" : "border-red-500")}>
          <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className={totals.balanceUsd >= 0 ? "text-green-600" : "text-red-600"} /><p className="text-[10px] font-black text-black uppercase tracking-widest">Balance del Mes</p></div>
          <p className={cn("text-3xl font-black", totals.balanceUsd >= 0 ? "text-green-700" : "text-red-700")}>{formatUsd(totals.balanceUsd)}</p>
          <p className={cn("text-xs font-black font-mono mt-1", totals.balanceUsd >= 0 ? "text-green-600" : "text-red-600")}>{formatBs(totals.balanceBs)}</p>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Tipo</label>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); }} className="w-full h-9 bg-white border border-[#9E9E9E] rounded-lg px-3 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="todos">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Categoría</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-9 bg-white border border-[#9E9E9E] rounded-lg px-3 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="todas">Todas</option>{categoriesList.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Desde</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 border-[#9E9E9E] text-xs font-black" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-black tracking-widest mb-1 block">Hasta</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 border-[#9E9E9E] text-xs font-black" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#9E9E9E] rounded-xl overflow-hidden shadow-md flex-1">
        <Table>
          <TableHeader className="bg-[#E8E8E8]">{/* ... */}</TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-black font-black italic text-sm">No hay registros para el período seleccionado</TableCell></TableRow>
            ) : (
              filteredEntries.map((entry, idx) => (
                <TableRow key={`${entry.id}_${idx}`} className="border-b border-[#9E9E9E]/40 hover:bg-primary/5 transition-colors">
                  <TableCell className="text-xs font-black text-black p-3">{formatDateFriendly(entry.date)}</TableCell>
                  <TableCell className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", entry.type === 'ingreso' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>{entry.type.toUpperCase()}</span></TableCell>
                  <TableCell className="p-3"><p className="text-xs font-black text-black uppercase">{entry.concept}</p><p className="text-[10px] font-black text-black truncate max-w-xs">{entry.description || entry.concept}</p></TableCell>
                  <TableCell className={cn("text-right font-black text-sm p-3", entry.type === 'ingreso' ? "text-green-700" : "text-red-700")}>{entry.type === 'ingreso' ? '+' : '-'} {formatUsd(entry.totalUsd || (entry.amount / (entry.exchangeRate || globalExchangeRate)))}</TableCell>
                  <TableCell className="text-right text-xs font-black text-black font-mono p-3">{formatBs(entry.amount)}</TableCell>
                  <TableCell className="text-center p-3"><button onClick={() => { setSelectedEntry(entry); setShowEntryDetail(true); }} className="text-blue-600 hover:scale-110 p-1 rounded-lg transition-transform"><Eye size={16} /></button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ExpenseModal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} onConfirm={handleExpenseConfirm} exchangeRate={globalExchangeRate} />
      
      <Dialog open={showEntryDetail} onOpenChange={setShowEntryDetail}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black font-headline text-black uppercase">Detalle del Movimiento</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-black text-black uppercase tracking-widest text-[10px]">Fecha:</span>
                <span className="font-mono font-black text-black">{formatDateFriendly(selectedEntry.date)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-black text-black uppercase tracking-widest text-[10px]">Tipo:</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border", selectedEntry.type === 'ingreso' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>{selectedEntry.type.toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-black text-black uppercase tracking-widest text-[10px]">Categoría:</span>
                <span className="font-black text-black capitalize">{categoriesList.find(c => c.id === selectedEntry.category)?.label || selectedEntry.category.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex flex-col border-b border-gray-200 pb-2">
                <span className="font-black text-black uppercase tracking-widest text-[10px] mb-1">Concepto:</span>
                <p className="font-black text-black text-xs">{selectedEntry.concept}</p>
              </div>
              {selectedEntry.description &&
                <div className="flex flex-col border-b border-gray-200 pb-2">
                  <span className="font-black text-black uppercase tracking-widest text-[10px] mb-1">Descripción:</span>
                  <p className="font-black text-black text-xs">{selectedEntry.description}</p>
                </div>
              }
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-black text-black uppercase tracking-widest text-[10px]">Monto USD:</span>
                <span className={cn("font-black text-lg", selectedEntry.type === 'ingreso' ? "text-green-600" : "text-red-600")}>
                  {selectedEntry.type === 'ingreso' ? '+' : '-'} {formatUsd(selectedEntry.totalUsd || (selectedEntry.amount / (selectedEntry.exchangeRate || globalExchangeRate)))}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-black text-black uppercase tracking-widest text-[10px]">Monto Bs.:</span>
                <span className="font-mono font-black text-black">{formatBs(selectedEntry.amount)}</span>
              </div>
              {selectedEntry.exchangeRate &&
                <div className="flex justify-between items-center">
                  <span className="font-black text-black uppercase tracking-widest text-[10px]">Tasa de Cambio:</span>
                  <span className="font-mono font-black text-black">{formatBs(selectedEntry.exchangeRate)}</span>
                </div>
              }
            </div>
          )}
          <div className="flex justify-end mt-6">
            <Button onClick={() => setShowEntryDetail(false)} variant="outline" className="font-black">Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
