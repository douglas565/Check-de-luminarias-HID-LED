import { AnalysisResult, LuminaireType } from "../types";

// Declaration for Tesseract since we loaded it via CDN script tag
declare const Tesseract: any;

const cleanBase64 = (dataUrl: string) => {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : dataUrl;
};

// Helper to load image for canvas processing
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

    // 1. Setup Canvas for Analysis
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context falhou");
    
    // Resize for performance optimization (OCR works faster on smaller imgs, but needs quality)
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // --- FASE 1: OCR (Reconhecimento de Texto) ---
    // Usamos Tesseract para ler etiquetas na luminária
    let ocrText = "";
    let ocrSignal = 0; // -1 (HID) a 1 (LED)
    const visualCues: string[] = [];

    try {
      const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
        logger: () => {} // Silence logs
      });
      ocrText = text.toUpperCase();
      
      if (ocrText.includes("LED")) {
        ocrSignal += 5; 
        visualCues.push("Texto 'LED' detectado na carcaça");
      }
      if (ocrText.includes("SODIUM") || ocrText.includes("SON") || ocrText.includes("HPS")) {
        ocrSignal -= 5;
        visualCues.push("Texto 'SODIUM/HPS' detectado");
      }
      if (ocrText.includes("MERCURY") || ocrText.includes("VAPOR")) {
        ocrSignal -= 5;
        visualCues.push("Texto 'VAPOR/MERCURY' detectado");
      }
    } catch (e) {
      console.warn("OCR falhou ou nada detectado, seguindo para análise visual.");
    }

    // --- FASE 2: Análise Colorimétrica (Pixel Data) ---
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let rTotal = 0, gTotal = 0, bTotal = 0;
    let brightnessTotal = 0;
    let pixelCount = 0;

    // Amostrar a cada 10 pixels para performance
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Ignorar pixels muito escuros (fundo) ou muito claros (estouro) para a média de cor
      const brightness = (r + g + b) / 3;
      if (brightness > 40 && brightness < 250) {
        rTotal += r;
        gTotal += g;
        bTotal += b;
        pixelCount++;
      }
      brightnessTotal += brightness;
    }

    const avgR = rTotal / pixelCount;
    const avgG = gTotal / pixelCount;
    const avgB = bTotal / pixelCount;

    let colorSignal = 0; // -1 (HID) a 1 (LED)

    // Lógica de Cor:
    // Vapor de Sódio (HID): Muito Vermelho e Verde (Amarelo/Laranja), Pouco Azul.
    // LED: Geralmente tem mais Azul proporcionalmente ou espectro balanceado (Branco).
    
    // Razão Vermelho/Azul
    const rbRatio = avgR / (avgB + 1); // +1 evita divisão por zero

    if (avgR > avgB * 1.5 && avgG > avgB) {
      // Tom Quente/Alaranjado -> Típico Sódio
      colorSignal -= 2; 
      visualCues.push(`Espectro Quente (R:${Math.round(avgR)} G:${Math.round(avgG)} B:${Math.round(avgB)}) indica Vapor de Sódio`);
    } else if (avgB > avgR * 0.8) {
      // Tom Frio/Branco -> Típico LED ou Metal Metálico (mas vamos pesar para LED pois é o moderno)
      colorSignal += 1.5;
      visualCues.push(`Espectro Frio/Branco indica provável LED`);
    } else {
      visualCues.push("Espectro de cor neutro/inconclusivo");
    }

    // --- DECISÃO FINAL ---
    // Somamos os sinais. OCR tem peso infinito (se leu LED, é LED).
    // Se não leu nada, a cor decide.
    
    let totalScore = colorSignal + ocrSignal;
    let type = LuminaireType.UNKNOWN;
    let confidence = 0.5;
    let explanation = "";

    if (totalScore > 0.5) {
      type = LuminaireType.LED;
      confidence = Math.min(0.6 + (Math.abs(totalScore) * 0.1), 0.99);
      explanation = "Identificado como LED baseado em análise espectral de luz fria e/ou leitura de caracteres OCR.";
    } else if (totalScore < -0.5) {
      type = LuminaireType.HID;
      confidence = Math.min(0.6 + (Math.abs(totalScore) * 0.1), 0.99);
      explanation = "Identificado como CONVENCIONAL (HID) baseado no espectro de cor amarelado (Sódio) ou etiquetas detectadas.";
    } else {
      // Inconclusivo
      type = LuminaireType.UNKNOWN;
      confidence = 0.4;
      explanation = "Análise inconclusiva. A imagem pode estar escura demais ou sem características visuais ou textuais claras.";
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
      explanation: "Erro no processamento local da imagem: " + error.message,
      visualCues: []
    };
  }
};