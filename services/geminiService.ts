import { AnalysisResult, LuminaireType } from "../types";

// Declaration for Tesseract since we loaded it via CDN script tag
declare const Tesseract: any;

// Helper to convert RGB to HSV for better color segmentation (Yellow Phosphor detection)
const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, v * 100];
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export const analyzeImage = async (base64Image: string): Promise<Omit<AnalysisResult, 'id' | 'timestamp' | 'fileName'>> => {
  try {
    const imageSrc = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    const img = await loadImage(imageSrc);

    // 1. Setup Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context falhou");
    
    // Resize for OCR performance
    const maxWidth = 1000; // Increased slightly for better text reading
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // --- FASE 1: OCR TÉCNICO (Leitura de Carcaça) ---
    let ocrText = "";
    let ocrSignal = 0; 
    const visualCues: string[] = [];

    try {
      // Whitelist characters to improve accuracy for technical codes
      const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
        logger: () => {}
      });
      ocrText = text.toUpperCase();

      // Palavras-chave de LED
      if (ocrText.match(/\b(LED|L.E.D|DIODE|MODUL|DRIVER|IP66|IP67)\b/)) {
        ocrSignal += 4;
        visualCues.push("Texto Técnico LED identificado (LED/DRIVER/MODULE)");
      }
      
      // Palavras-chave de HID (Sódio/Metálico)
      if (ocrText.match(/\b(SON|NAV|HPS|H.P.S|SODIUM|VIALOX)\b/)) {
        ocrSignal -= 5;
        visualCues.push("Código de Lâmpada de Sódio detectado (SON/NAV/HPS)");
      }
      if (ocrText.match(/\b(MH|HPI|HQI|METAL|HALIDE|MERCURY|VAPOR|HPL)\b/)) {
        ocrSignal -= 5;
        visualCues.push("Código de Lâmpada Metálica/Mercúrio detectado");
      }
      if (ocrText.includes("E27") || ocrText.includes("E40")) {
        ocrSignal -= 2; // Soquete de rosca indica lâmpada tradicional (geralmente)
        visualCues.push("Base E27/E40 detectada (Típico de lâmpadas convencionais)");
      }

    } catch (e) {
      console.warn("OCR Silent Fail");
    }

    // --- FASE 2: ANÁLISE DE HARDWARE (Pixels Diurnos) ---
    // Como está apagada, procuramos por:
    // 1. Chips de LED: Pequenos pontos Amarelo-Limão (Fósforo)
    // 2. Bulbos HID: Áreas grandes Brancas Leitosas ou Vidro
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let yellowPhosphorPixels = 0;
    let whiteBulbPixels = 0;
    let totalAnalyzed = 0;

    for (let i = 0; i < data.length; i += 20) { // Sample rate
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const [h, s, v] = rgbToHsv(r, g, b);

      // Detecção de Fósforo de LED (Amarelo Específico)
      // Hue entre 45 e 65 (Amarelo), Saturação Média/Alta, Brilho Médio
      if (h > 45 && h < 65 && s > 40 && v > 30) {
        yellowPhosphorPixels++;
      }

      // Detecção de Bulbo Branco Leitador (Sódio/Metálico apagado)
      // Quase sem cor (S < 15), Muito brilhante (V > 70)
      if (s < 15 && v > 70) {
        whiteBulbPixels++;
      }

      totalAnalyzed++;
    }

    const phosphorRatio = yellowPhosphorPixels / totalAnalyzed;
    const bulbRatio = whiteBulbPixels / totalAnalyzed;

    let hardwareSignal = 0;

    // Ajuste de sensibilidade
    if (phosphorRatio > 0.005) { // Se 0.5% da imagem for amarelo fósforo
      hardwareSignal += 3;
      visualCues.push(`Chips de LED detectados (Fósforo Amarelo: ${(phosphorRatio*100).toFixed(2)}%)`);
    } else if (bulbRatio > 0.10) { // Se 10% da imagem for branco leitoso
      hardwareSignal -= 2;
      visualCues.push(`Provável bulbo/vidro de lâmpada detectado (Área Clara: ${(bulbRatio*100).toFixed(2)}%)`);
    }

    // --- DECISÃO FINAL ---
    let totalScore = hardwareSignal + ocrSignal;
    
    // Se não detectou nada significativo, tenta heurística de contraste
    // LEDs costumam ter alto contraste local (pontos pretos e amarelos)
    // Lâmpadas têm gradientes suaves. 
    // (Simplificado aqui para manter performance offline)

    let type = LuminaireType.UNKNOWN;
    let confidence = 0.5;
    let explanation = "";

    if (totalScore > 0) {
      type = LuminaireType.LED;
      confidence = Math.min(0.6 + (totalScore * 0.1), 0.95);
      explanation = "Identificado visualmente como LED (Chips de fósforo amarelos visíveis ou marcações 'LED/Driver' na carcaça).";
    } else if (totalScore < 0) {
      type = LuminaireType.HID;
      confidence = Math.min(0.6 + (Math.abs(totalScore) * 0.1), 0.95);
      explanation = "Identificado como CONVENCIONAL (HID) pela presença de bulbo de vidro, soquete E40/E27 ou códigos (SON/NAV).";
    } else {
      type = LuminaireType.UNKNOWN;
      confidence = 0.3;
      explanation = "Inconclusivo. Sem chips de LED visíveis ou códigos legíveis na imagem desligada.";
    }

    return {
      type,
      confidence,
      explanation,
      visualCues
    };

  } catch (error: any) {
    console.error("Local Analysis Error:", error);
    return {
      type: LuminaireType.UNKNOWN,
      confidence: 0,
      explanation: "Erro no processamento: " + error.message,
      visualCues: []
    };
  }
};