export enum LuminaireType {
  LED = 'LED',
  HID = 'HID', // High Intensity Discharge (Sodium, Metal Halide, Mercury)
  UNKNOWN = 'UNKNOWN'
}

export interface AnalysisResult {
  id: string; // ID of the specific image analysis
  fileName: string;
  timestamp: number;
  type: LuminaireType;
  confidence: number;
  explanation: string;
  visualCues: string[];
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface BatchItem {
  id: string; // Unique ID for the file processing
  groupId: string; // The folder name (Luminaire ID)
  file: File;
  status: ProcessingStatus;
  result?: AnalysisResult;
  error?: string;
}

export interface GroupResult {
  groupId: string;
  totalPhotos: number;
  processedPhotos: number;
  ledCount: number;
  hidCount: number;
  unknownCount: number;
  finalType: LuminaireType; // The majority vote
  avgConfidence: number;
  status: ProcessingStatus;
  items: BatchItem[];
}
