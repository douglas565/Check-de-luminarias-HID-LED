import * as React from 'react';
import { Upload, Image as ImageIcon, FileUp, FolderUp, FolderSearch } from 'lucide-react';

interface CameraViewProps {
  onUpload: (files: File[]) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onUpload }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Filter for images only
      const imageFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onUpload(imageFiles);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        // @ts-ignore - webkitdirectory is standard in modern browsers but missing in generic React definitions
        webkitdirectory="" 
        directory=""
        multiple 
        onChange={handleFileSelect}
      />

      <div 
        className={`w-full max-w-2xl aspect-video min-h-[400px] rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-8 cursor-pointer hover:bg-slate-800/50 ${isDragging ? 'border-cyan-400 bg-slate-800/80 scale-[1.02]' : 'border-slate-700 bg-slate-900'}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full opacity-20 blur-lg animate-pulse"></div>
          <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center shadow-xl shadow-black/40 border border-slate-700">
            <FolderSearch className={`w-14 h-14 text-cyan-400 transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`} />
          </div>
        </div>
        
        <div className="text-center space-y-3 px-6">
          <h3 className="text-3xl font-bold text-white tracking-tight">Carregar Pastas</h3>
          <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
            Selecione a <strong>pasta raiz</strong>. <br/>
            O sistema identificará automaticamente os IDs pelas <strong>subpastas</strong> (ex: <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">/1234/img1.jpg</code>).
          </p>
        </div>

        <div className="flex gap-4">
          <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center gap-2 text-slate-400 text-sm">
            <FolderUp className="w-4 h-4" />
            <span>Upload de Diretório</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center gap-2 text-slate-400 text-sm">
            <FileUp className="w-4 h-4" />
            <span>Consolidação por ID</span>
          </div>
        </div>
      </div>
    </div>
  );
};