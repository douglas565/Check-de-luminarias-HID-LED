import * as React from 'react';
import { BatchItem, GroupResult, LuminaireType } from '../types';
import { Download, CheckCircle2, Loader2, XCircle, FileSpreadsheet, ArrowLeft, ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ScanResultProps {
  items: BatchItem[];
  groups: GroupResult[];
  onExport: () => void;
  onReset: () => void;
  isProcessing: boolean;
}

export const ScanResult: React.FC<ScanResultProps> = ({ items, groups, onExport, onReset, isProcessing }) => {
  const completedCount = items.filter(i => i.status === 'completed' || i.status === 'error').length;
  const progress = (completedCount / items.length) * 100;
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setExpandedGroups(newSet);
  };

  const ledGroups = groups.filter(g => g.finalType === LuminaireType.LED).length;
  const hidGroups = groups.filter(g => g.finalType === LuminaireType.HID).length;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Dashboard Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="text-green-500" />
              Relatório Consolidado
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {isProcessing 
                ? `Processando imagem ${completedCount} de ${items.length}...` 
                : 'Análise concluída.'}
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
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">IDs Identificados</div>
            <div className="text-2xl font-black text-white">{groups.length}</div>
          </div>
          <div className="bg-cyan-950/30 p-3 rounded-xl border border-cyan-900/50">
            <div className="text-cyan-400 text-xs uppercase font-bold tracking-wider mb-1">LED Confirmados</div>
            <div className="text-2xl font-black text-cyan-400">{ledGroups}</div>
          </div>
          <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-900/50">
            <div className="text-amber-400 text-xs uppercase font-bold tracking-wider mb-1">HID Confirmados</div>
            <div className="text-2xl font-black text-amber-400">{hidGroups}</div>
          </div>
        </div>
      </div>

      {/* Group Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-bold tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">ID Luminária (Pasta)</th>
                <th className="px-6 py-4">Decisão Final</th>
                <th className="px-6 py-4">Placar (Votos)</th>
                <th className="px-6 py-4">Confiança Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.groupId);
                
                return (
                  <React.Fragment key={group.groupId}>
                    <tr 
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-800/30' : ''}`}
                      onClick={() => toggleGroup(group.groupId)}
                    >
                      <td className="px-6 py-4 text-slate-500">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap w-12">
                        {group.status === 'processing' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                        {group.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        {group.status === 'pending' && <div className="w-2 h-2 bg-slate-600 rounded-full" />}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-200">
                        {group.groupId}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                          group.finalType === LuminaireType.LED 
                            ? 'bg-cyan-950 text-cyan-400 border-cyan-800' 
                            : group.finalType === LuminaireType.HID 
                              ? 'bg-amber-950 text-amber-400 border-amber-800'
                              : 'bg-slate-800 text-slate-400 border-slate-600'
                        }`}>
                          {group.finalType === 'HID' ? 'CONVENCIONAL' : group.finalType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        <span className="text-cyan-400 font-bold">{group.ledCount} LED</span> / <span className="text-amber-400 font-bold">{group.hidCount} HID</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${group.avgConfidence > 0.8 ? 'bg-green-500' : group.avgConfidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${group.avgConfidence * 100}%` }}
                            />
                          </div>
                          <span className="text-slate-400 text-xs">{Math.round(group.avgConfidence * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-950/30 p-4 border-b border-slate-800">
                          <div className="grid grid-cols-1 gap-2 pl-12">
                             <div className="text-xs font-bold text-slate-500 uppercase mb-2">Imagens Analisadas no ID {group.groupId}</div>
                             {group.items.map(item => (
                               <div key={item.id} className="flex items-center gap-4 bg-slate-900 p-2 rounded border border-slate-800">
                                  <ImageIcon className="w-4 h-4 text-slate-600" />
                                  <span className="text-sm text-slate-300 w-64 truncate">{item.file.name}</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                    item.result?.type === 'LED' ? 'text-cyan-400 bg-cyan-950/50' : 
                                    item.result?.type === 'HID' ? 'text-amber-400 bg-amber-950/50' : 'text-slate-500'
                                  }`}>
                                    {item.result?.type || (item.status === 'error' ? 'Erro' : 'Pendente')}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {item.result ? `${Math.round(item.result.confidence * 100)}% Conf.` : ''}
                                  </span>
                                  <span className="text-xs text-slate-600 truncate flex-1">
                                     {item.result?.explanation}
                                  </span>
                               </div>
                             ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          
          {groups.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Nenhuma pasta carregada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};