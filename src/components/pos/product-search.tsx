"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Product } from '@/lib/types';
import { Search, Barcode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSState } from '@/hooks/use-pos-state';
import { formatUsd } from '@/lib/currency-formatter';

const DEFAULT_MIN_STOCK = 5;

interface ProductSearchProps {
  state: ReturnType<typeof usePOSState>;
  onAdd: (id: number) => boolean;
}

export default function ProductSearch({ state, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const productListRef = useRef<HTMLDivElement>(null);

  const getProductMinStock = (product: any) => {
    return (product as any).minStock || DEFAULT_MIN_STOCK;
  };

  const getStockColor = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "text-red-600 bg-red-50";
    } else if (product.stock <= minStock) {
      return "text-black bg-yellow-200";
    } else {
      return "text-black bg-green-200";
    }
  };

  const getStockText = (product: any) => {
    const minStock = getProductMinStock(product);
    if (product.stock === 0) {
      return "AGOTADO";
    } else if (product.stock <= minStock) {
      return `STOCK MÍNIMO (${product.stock}/${minStock})`;
    } else {
      return `STOCK: ${product.stock}`;
    }
  };

  const productResults = useMemo(() => {
    if (!query.trim() && !isFocused) return [];
    const q = query.toLowerCase();
    let filtered = state.products;
    
    if (q) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.includes(q)) || 
        (p.category && (p.category as any).name.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q))
      );
    }
    
    return filtered.slice(0, 30);
  }, [query, state.products, isFocused]);

  const groupedProductResults = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    productResults.forEach(p => {
      const categoryName = (p.category as any)?.name || 'Varios';
      if (!groups[categoryName]) groups[categoryName] = [];
      groups[categoryName].push(p);
    });
    return groups;
  }, [productResults]);

  const allFlatProducts = useMemo(() => {
    return productResults;
  }, [productResults]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allFlatProducts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && allFlatProducts[selectedIndex]) {
        e.preventDefault();
        onAdd(allFlatProducts[selectedIndex].id);
        setQuery('');
        setIsFocused(false);
        setSelectedIndex(-1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, allFlatProducts, selectedIndex, onAdd]);

  useEffect(() => {
    if (selectedIndex >= 0 && productListRef.current) {
      const selectedElement = document.getElementById(`product-${selectedIndex}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="flex flex-col h-full bg-primary relative">
      <div className="p-3.5">
        <div className={cn(
          "flex items-center bg-background border-2 border-black rounded-xl px-3 transition-all duration-200",
          isFocused && "border-black shadow-lg"
        )}>
          <Search size={18} className="text-black font-black" />
          <input 
            id="pos-search-input"
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setSelectedIndex(-1);
            }}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={"BUSCAR PRODUCTO O ESCANEAR..."}
            className="flex-1 bg-transparent border-none text-black px-2 py-3 text-base font-black focus:outline-none font-body placeholder:text-black"
          />
          <Barcode size={22} className="text-black font-black" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-3.5 space-y-2 scrollbar-thin" ref={productListRef}>
        {(query || isFocused) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            {Object.entries(groupedProductResults).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-black font-black text-base">No se encontraron productos</p>
              </div>
            ) : (
              Object.entries(groupedProductResults).map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <div className="text-xs font-black text-black uppercase tracking-widest px-2 mb-1 bg-white/30 rounded py-0.5 inline-block">
                    {category}
                  </div>
                  {items.map((p, idx) => {
                    const globalIndex = productResults.findIndex(prod => prod.id === p.id);
                    const stockColor = getStockColor(p);
                    const stockText = getStockText(p);
                    const isSelected = selectedIndex === globalIndex;
                    
                    return (
                      <button 
                        key={p.id}
                        id={`product-${globalIndex}`}
                        onClick={() => {
                          onAdd(p.id);
                          setQuery('');
                          setIsFocused(false);
                          setSelectedIndex(-1);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left shadow-sm",
                          isSelected 
                            ? "bg-black text-white border-black" 
                            : "bg-white border-black/20 hover:border-black hover:shadow-md"
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center text-black border border-black/10">
                          <Barcode size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-base font-black truncate", isSelected ? "text-white" : "text-black")}>{p.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn("text-base font-black", isSelected ? "text-primary" : "text-black")}>{formatUsd(p.priceUsd)}</span>
                            <span className={cn(
                              "text-[11px] font-black px-2 py-0.5 rounded-full border border-black/10",
                              stockColor
                            )}>
                              {stockText}
                            </span>
                            {p.department && (
                              <span className={cn("text-[11px] font-black uppercase", isSelected ? "text-white/70" : "text-black")}>📁 {p.department}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
