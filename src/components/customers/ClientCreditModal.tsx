
"use client";

import { useState, useMemo } from 'react';
import { Client, Transaction } from '@/lib/types';
import { usePOSState } from '@/hooks/use-pos-state';
import ClientPanel from '@/components/pos/client-panel';
import { X, UserCircle } from 'lucide-react';
import { formatUsd } from '@/lib/currency-formatter';

interface ClientCreditModalProps {
  show: boolean;
  onClose: () => void;
  state: ReturnType<typeof usePOSState>;
}

export default function ClientCreditModal({ show, onClose, state }: ClientCreditModalProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const clientsWithCredit = useMemo(() => {
    const clientDebts: { [key: string]: number } = {};

    for (const account of state.accounts) {
        if (account.status === 'pagada' || !account.clientId) {
            continue;
        }

        if (!clientDebts[account.clientId]) {
            clientDebts[account.clientId] = 0;
        }

        const totalUsd = account.amountUsd || (account.amountBs / (account.exchangeRate || state.exchangeRate));
        const paidBs = account.paidAmount || 0;
        const paidUsd = paidBs / (account.exchangeRate || state.exchangeRate);
        const remainingUsd = totalUsd - paidUsd;

        clientDebts[account.clientId] += Math.max(0, remainingUsd);
    }

    return state.clients
      .map(client => ({
        ...client,
        debt: clientDebts[client.id] || 0,
      }))
      .filter(client => client.debt > 0.01)
      .sort((a, b) => b.debt - a.debt);

  }, [state.accounts, state.clients, state.exchangeRate]);

  const handleClose = () => {
    setSelectedClient(null);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-in fade-in">
      <div className="bg-white text-black rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border-4 border-black">
        <div className="flex justify-between items-center p-4 border-b-2 border-black/10 bg-gray-50">
          <h2 className="text-xl font-black uppercase">
            {selectedClient ? `Ficha de Cliente: ${selectedClient.name}` : 'Clientes con Crédito'}
          </h2>
          <button onClick={handleClose} className="text-black hover:bg-gray-200 p-2 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedClient ? (
            <ClientPanel client={selectedClient} state={state} onClose={() => setSelectedClient(null)} />
          ) : (
            <div className="p-4 space-y-2">
              {clientsWithCredit.length > 0 ? (
                clientsWithCredit.map(client => (
                  <button 
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-100 hover:bg-primary hover:text-black border-2 border-transparent hover:border-black transition-all text-left group"
                  >
                    <UserCircle size={32} className="text-gray-500 group-hover:text-black" />
                    <div className="flex-1">
                      <p className="font-bold text-lg">{client.name}</p>
                      <p className="text-sm text-gray-600">{client.cedula}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600 text-lg">{formatUsd(client.debt)}</p>
                      <p className="text-sm text-gray-500">Deuda Total</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-lg font-semibold text-gray-500">No hay clientes con deudas pendientes.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
