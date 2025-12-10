import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, LuminaireType } from "../types";

// Helper to convert base64 to standard format if needed, though GenAI handles raw base64 often.
// We assume the input is a full data URL (data:image/jpeg;base64,...) but handle raw base64 too.
const cleanBase64 = (dataUrl: string) => {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : dataUrl;
};

export const analyzeImage = async (base64Image: string): Promise<Omit<AnalysisResult, 'id' | 'timestamp' | 'fileName'>> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Chave da API não encontrada. Configure a variável de ambiente API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Define the schema for structured output
  const schema = {
    type: Type.OBJECT,
    properties: {
      classification: {
        type: Type.STRING,
        enum: ["LED", "HID", "UNKNOWN"],
        description: "Classify the luminaire as LED or HID (High Intensity Discharge). If unclear, use UNKNOWN."
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence score between 0 and 1."
      },
      explanation: {
        type: Type.STRING,
        description: "A brief explanation in Portuguese explaining why this classification was made, focusing purely on visual characteristics (bulb vs diodes, color, housing shape)."
      },
      visualCues: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of visual features observed (e.g., 'múltiplos diodos', 'luz alaranjada', 'dissipador de calor'). In Portuguese."
      }
    },
    required: ["classification", "confidence", "explanation", "visualCues"],
    propertyOrdering: ["classification", "confidence", "explanation", "visualCues"]
  };

  const prompt = `
    Atue como um especialista em inventário de iluminação pública (IP).
    Sua ÚNICA missão é classificar a tecnologia da fonte luminosa na imagem.
    
    CLASSIFICAÇÃO BINÁRIA (LED vs HID):
    1. LED: Tecnologia moderna.
    2. HID (Convencional): Inclui Vapor de Sódio (HPS), Vapor Metálico (HPI/MH), Mercúrio (HPL/HQL).

    REGRAS RÍGIDAS:
    - NÃO tente ler etiquetas de potência (Watts). Ignore números escritos na carcaça.
    - NÃO tente estimar luminosidade ou eficiência.
    - Foque puramente na aparência do EMISSOR DE LUZ e do CORPO da luminária.

    CRITÉRIOS VISUAIS PARA LED:
    - Pontos de luz múltiplos (chips/diodos amarelos ou brancos).
    - Lentes individuais sobre cada ponto de LED (matriz).
    - Corpo da luminária geralmente fino (slim), plano ou com aletas de dissipação visíveis em cima.
    - Luz branca, fria e direcional (se estiver acesa).
    - Ausência de vidro côncavo profundo.

    CRITÉRIOS VISUAIS PARA HID (CONVENCIONAL):
    - Presença de um bulbo/lâmpada de vidro grande (formato oval, tubular ou elíptico) dentro da luminária.
    - Grande refletor espelhado curvo atrás da lâmpada.
    - Luz amarela/alaranjada (Sódio) ou branca brilhante difusa (Metálico).
    - Corpo da luminária geralmente profundo, bojo grande, formato "cabeça de cobra" ou ovalado.
    - Difusor prismático antigo (acrílico/vidro raiado).

    Se não for possível ver a fonte de luz ou a luminária, classifique como UNKNOWN.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(base64Image)
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1 // Very low temperature for consistent classification
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from AI");

    const data = JSON.parse(jsonText);

    let type = LuminaireType.UNKNOWN;
    if (data.classification === 'LED') type = LuminaireType.LED;
    if (data.classification === 'HID') type = LuminaireType.HID;

    return {
      type,
      confidence: data.confidence,
      explanation: data.explanation,
      visualCues: data.visualCues || []
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Falha ao analisar a imagem. Tente novamente.");
  }
};