import * as React from 'react';
import { CameraView } from './components/CameraView';
import { ScanResult } from './components/ScanResult';
import { analyzeImage } from './services/geminiService';
import { BatchItem, AnalysisResult, GroupResult, LuminaireType } from './types';
import { AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = React.useState<'upload' | 'results'>('upload');
  const [batchItems, setBatchItems] = React.useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Helper to read file as base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async (files: File[]) => {
    // Group files by parent folder name
    const newItems: BatchItem[] = files.map(file => {
      // webkitRelativePath format: "RootFolder/SubFolderID/Image.jpg"
      // We want "SubFolderID".
      const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [];
      
      let groupId = 'Sem ID';
      
      // If we have a structure like Root/ID/Img, take ID (2nd to last)
      if (pathParts.length >= 2) {
        groupId = pathParts[pathParts.length - 2];
      } else {
         // Fallback for flat file upload
         groupId = 'Geral';
      }

      return {
        id: Math.random().toString(36).substring(7),
        groupId: groupId,
        file,
        status: 'pending'
      };
    });

    if (newItems.length === 0) {
      setError("Nenhuma imagem encontrada nas pastas selecionadas.");
      return;
    }

    setBatchItems(newItems);
    setView('results');
    setError(null);
    processQueue(newItems);
  };

  const processQueue = async (items: BatchItem[]) => {
    setIsProcessing(true);
    
    // Create a copy to work with for updates
    const currentQueue = [...items];

    // Process one by one to avoid hitting API rate limits
    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i];
      
      // Update status to processing
      setBatchItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'processing' } : p));

      try {
        const base64 = await fileToBase64(item.file);
        const result = await analyzeImage(base64);
        
        const fullResult: AnalysisResult = {
          ...result,
          id: item.id,
          fileName: item.file.name,
          timestamp: Date.now(),
        };

        setBatchItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'completed', result: fullResult } : p
        ));

      } catch (err: any) {
        console.error(`Error processing ${item.file.name}:`, err);
        setBatchItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'error', error: err.message || 'Failed' } : p
        ));
      }

      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsProcessing(false);
  };

  // Logic to aggregate results by Group ID
  const getAggregatedResults = (): GroupResult[] => {
    const groups: Record<string, BatchItem[]> = {};

    // Group items
    batchItems.forEach(item => {
      if (!groups[item.groupId]) groups[item.groupId] = [];
      groups[item.groupId].push(item);
    });

    return Object.keys(groups).map(groupId => {
      const items = groups[groupId];
      const totalPhotos = items.length;
      const processed = items.filter(i => i.status === 'completed' || i.status === 'error');
      
      const ledCount = items.filter(i => i.result?.type === LuminaireType.LED).length;
      const hidCount = items.filter(i => i.result?.type === LuminaireType.HID).length;
      const unknownCount = items.filter(i => i.result?.type === LuminaireType.UNKNOWN).length;

      // Majority Vote Logic
      let finalType = LuminaireType.UNKNOWN;
      if (ledCount > hidCount && ledCount >= unknownCount) {
        finalType = LuminaireType.LED;
      } else if (hidCount > ledCount && hidCount >= unknownCount) {
        finalType = LuminaireType.HID;
      } else if (ledCount === hidCount && ledCount > 0) {
        finalType = LuminaireType.UNKNOWN; // Tie or ambiguous
      }

      // Calculate Average Confidence of the WINNING type
      const relevantItems = items.filter(i => i.result?.type === finalType);
      const avgConfidence = relevantItems.length > 0
        ? relevantItems.reduce((acc, curr) => acc + (curr.result?.confidence || 0), 0) / relevantItems.length
        : 0;

      // Determine Group Status
      let status: any = 'pending';
      if (processed.length === totalPhotos) status = 'completed';
      else if (processed.length > 0) status = 'processing';

      return {
        groupId,
        totalPhotos,
        processedPhotos: processed.length,
        ledCount,
        hidCount,
        unknownCount,
        finalType,
        avgConfidence,
        status,
        items
      };
    });
  };

  const handleExportCSV = () => {
    const groups = getAggregatedResults();
    if (groups.length === 0) return;

    // Excel BOM to force UTF-8 (fixes accents)
    const BOM = "\uFEFF"; 
    
    // Header for Group Export
    const headers = [
      "ID Luminária (Pasta)", 
      "Classificação Final", 
      "Precisão Média (%)", 
      "Qtd Fotos LED", 
      "Qtd Fotos HID", 
      "Qtd Fotos Incertas",
      "Total Fotos"
    ];

    const rows = groups.map(g => {
        const typeName = g.finalType === 'HID' ? 'CONVENCIONAL' : g.finalType;
        const confidence = Math.round(g.avgConfidence * 100);
        
        return [
          `"${g.groupId}"`,
          `"${typeName}"`,
          `${confidence}`,
          `${g.ledCount}`,
          `${g.hidCount}`,
          `${g.unknownCount}`,
          `${g.totalPhotos}`
        ].join(",");
    });

    const csvContent = BOM + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LumiCheck_Consolidado_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setBatchItems([]);
    setView('upload');
    setError(null);
  };

  return (
    <div className="w-full h-[100dvh] bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header - Compact */}
      <header className="h-12 bg-slate-950 flex items-center justify-center border-b border-slate-800 z-20 shrink-0">
        <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 animate-pulse"></div>
           <h1 className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
             LumiCheck <span className="text-slate-500 font-normal">| Batch AI</span>
           </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {view === 'upload' && (
          <CameraView onUpload={handleUpload} />
        )}

        {view === 'results' && (
          <ScanResult 
            items={batchItems} 
            groups={getAggregatedResults()}
            onExport={handleExportCSV} 
            onReset={handleReset}
            isProcessing={isProcessing}
          />
        )}
      </main>

      {/* Global Error Toast */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-red-500/90 text-white p-4 rounded-xl shadow-lg flex items-start gap-3 z-[60] animate-in slide-in-from-top-4 fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Erro</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-white/70 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
};

export default App;