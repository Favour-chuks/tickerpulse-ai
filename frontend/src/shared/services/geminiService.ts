import { GoogleGenAI, Type } from "@google/genai";
import { Narrative, Contradiction, VolumeSpike } from "../types";
import { DEMO_Data } from "./demoData";

const getAI = () => new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
const { user, ...data } = DEMO_Data;
export const chatWithAura = async (message: string): Promise<string> => {
  const ai = getAI();
  const systemPrompt = `
    YOUR IDENTITY: 
    You are Aura, a personal, human-like AI stock analyst for TickerPulse. 
    You aren't a robot; you're a partner who is passionate about market data.
    Help analysts detect narrative divergences and understand unusual market movements.

    TONE RULES:
    - Be conversational and warm while still being concise, professional. Use "I" and "you".
    - Use contractions (e.g., "I'm" instead of "I am", "don't" instead of "do not").
    - If the user's data shows something exciting (like a 20% gain), acknowledge it!
    - Keep responses brief but insightful.

    DEMO CONTEXT (The user's data):
    ${JSON.stringify(data)}

    IMPORTANT: Use as much data as possible to prove the point that you are trying to makeUse the data above to answer. If they ask about something else, 
    stay in character and say: "I'd love to help with that, but for this demo, 
    I only have eyes for your current portfolio holdings."
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: message,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  return response.text || "Aura is currently unavailable.";
};



export const analyzeFilingNarrative = async (ticker: string, filingContent: string): Promise<Partial<Narrative>> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this SEC filing for ${ticker}: ${filingContent}. Extract a summary, key changes, and tone analysis.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          toneShift: { type: Type.STRING },
          managementConfidence: { type: Type.INTEGER, description: "1-10 scale" },
          keyChanges: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['summary', 'toneShift', 'managementConfidence', 'keyChanges']
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateDivergenceHypothesis = async (spike: Partial<VolumeSpike>): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `A volume spike of ${spike.deviationMultiple}x moving average was detected for ${spike.tickerSymbol} at price ${spike.priceAtSpike}. No major news was found. Generate a professional market hypothesis for this divergence.`,
    config: {
      systemInstruction: "You are a senior market analyst specializing in unusual options activity and dark pool flows."
    }
  });

  return response.text || "Insufficient data for hypothesis.";
};

export const detectContradictions = async (ticker: string, s1: string, s2: string): Promise<Partial<Contradiction> | null> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare these two statements from ${ticker} and identify if they contradict each other or represent a significant pivot. 
    Statement 1: ${s1}
    Statement 2: ${s2}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hasContradiction: { type: Type.BOOLEAN },
          type: { type: Type.STRING },
          explanation: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] }
        },
        required: ['hasContradiction', 'type', 'explanation', 'severity']
      }
    }
  });

  const res = JSON.parse(response.text || '{}');
  return res.hasContradiction ? res : null;
};

export const validateContradiction = async (contradiction: Contradiction): Promise<{ isValid: boolean; confidence: number; reasoning: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a forensic accountant. Validate this potential market contradiction.
    Ticker: ${contradiction.tickerSymbol}
    Statement 1: "${contradiction.quote_1}"
    Statement 2: "${contradiction.quote_2}"
    Context: ${contradiction.explanation}
    
    Determine if this is a genuine contradiction reflecting a material change in strategy or guidance. Return a JSON object.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER, description: "0.0 to 1.0" },
          reasoning: { type: Type.STRING }
        },
        required: ['isValid', 'confidence', 'reasoning']
      }
    }
  });

  return JSON.parse(response.text || '{}');
};
