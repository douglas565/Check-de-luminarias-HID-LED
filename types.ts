export enum LuminaireType {
  LED = 'LED',
  HID = 'HID', // High Intensity Discharge (Sodium, Metal Halide, Mercury)
  UNKNOWN = 'UNKNOWN'
}

export interface AnalysisResult {
  id: string; // Will use filename or unique ID
  fileName: string;
  timestamp: number;
  type: LuminaireType;
  confidence: number;
  explanation: string;
  visualCues: string[];
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface BatchItem {
  id: string;
  file: File;
  status: ProcessingStatus;
  result?: AnalysisResult;
  error?: string;
}
