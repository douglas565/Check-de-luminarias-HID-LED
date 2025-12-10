import React from 'react';
import { BatchItem, LuminaireType } from '../types';
import { Download, CheckCircle2, AlertTriangle, Loader2, XCircle, FileSpreadsheet, ArrowLeft } from 'lucide-react';

interface ScanResultProps {
  items: BatchItem[];
  onExport: () => void;
  onReset: () => void;
  isProcessing: boolean;
}

export const ScanResult: React.FC<ScanResultProps> = ({ items, onExport, onReset, isProcessing }) => {
  const completedCount = items.filter(i => i.status === 'completed' || i.status === 'error').length;
  const progress = (completedCount / items.length) * 100;
  
  const ledCount = items.filter(i => i.result?.type === LuminaireType.LED).length;
  const hidCount = items.filter(i => i.result?.type === LuminaireType.HID).length;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Dashboard Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="text-green-500" />
              Relatório de Inventário
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {isProcessing 
                ? `Processando imagem ${completedCount + 1} de ${items.length}...` 
                : 'Processamento concluído.'}
            </p>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={onReset}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Nova Análise
            </button>
            <button 
              onClick={onExport}
              disabled={isProcessing || completedCount === 0}
              className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar Excel (.csv)
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Total</div>
            <div className="text-2xl font-black text-white">{items.length}</div>
          </div>
          <div className="bg-cyan-950/30 p-3 rounded-xl border border-cyan-900/50">
            <div className="text-cyan-400 text-xs uppercase font-bold tracking-wider mb-1">LED Detectados</div>
            <div className="text-2xl font-black text-cyan-400">{ledCount}</div>
          </div>
          <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-900/50">
            <div className="text-amber-400 text-xs uppercase font-bold tracking-wider mb-1">HID Detectados</div>
            <div className="text-2xl font-black text-amber-400">{hidCount}</div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-bold tracking-wider sticky top-0">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Nome do Arquivo</th>
                <th className="px-6 py-4">Classificação</th>
                <th className="px-6 py-4">Precisão Visual</th>
                <th className="px-6 py-4 hidden md:table-cell">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap w-12">
                    {item.status === 'pending' && <div className="w-2 h-2 bg-slate-600 rounded-full" />}
                    {item.status === 'processing' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                    {item.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {item.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-200 truncate max-w-[200px]" title={item.file.name}>
                    {item.file.name}
                  </td>
                  <td className="px-6 py-4">
                    {item.result ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        item.result.type === LuminaireType.LED 
                          ? 'bg-cyan-950 text-cyan-400 border-cyan-800' 
                          : item.result.type === LuminaireType.HID 
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : 'bg-slate-800 text-slate-400 border-slate-600'
                      }`}>
                        {item.result.type === 'HID' ? 'CONVENCIONAL' : item.result.type}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.result ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.result.confidence > 0.8 ? 'bg-green-500' : item.result.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${item.result.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-xs">{Math.round(item.result.confidence * 100)}%</span>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-slate-500 max-w-[300px] truncate" title={item.result?.explanation}>
                    {item.result?.explanation || item.error || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {items.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Nenhum arquivo na fila.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};