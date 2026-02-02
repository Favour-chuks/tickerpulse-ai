import { GoogleGenAI } from '@google/genai';
import type {
  GeminiFilingAnalysis,
  GeminiContradictionResult,
  GeminiDivergenceHypothesis,
  GeminiTicker,
} from '../../../shared/types/domain.js';
import { envConfig } from '../../../config/environmentalVariables.js';
import { logger } from '../../../config/logger.js';
import { tools } from '../constants/aiTools.js';
import { SYSTEM_PROMPT } from '../constants/prompts.js';
import { ToolExecutionService } from './toolExecution.service.js';
import type { Message, AnalysisResponse } from '../types/analysis.type.js';

class GeminiService {
  private genAI: GoogleGenAI;
  private static instance: GeminiService;
  private toolExecutionService: ToolExecutionService;

  private constructor() {
    this.genAI = new GoogleGenAI({ apiKey: envConfig.gemini_api_key });
    this.toolExecutionService = new ToolExecutionService();     
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  async analyzeMessage(
    message: string,
    conversationHistory: Message[] = [],
    userId?: string
  ): Promise<AnalysisResponse> {
    try {
      const chat = this.genAI.chats.create({
        model: 'gemini-3-pro',
        history: conversationHistory,
        config: {
          tools: [tools],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
        }
      });

      const toolCalls: Array<{ tool: string; input: any; result: any }> = [];
      let responseText = '';
      let currentMessage: any = message;
      let continueLoop = true;

      while (continueLoop) {
        const response = await chat.sendMessage({ message: currentMessage });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          const functionResponses = await Promise.all(
            functionCalls.map(async (call: any) => {
              logger.info(`Tool: ${call.name}, Input: ${JSON.stringify(call.args)}`);

              const toolResult = await this.toolExecutionService.executeTool(
                call.name,
                call.args,
                userId
              );

              toolCalls.push({
                tool: call.name,
                input: call.args,
                result: toolResult,
              });

              return {
                functionResponse: {
                  name: call.name,
                  response: { result: toolResult },
                },
              };
            })
          );

          currentMessage = {
            parts: functionResponses,
          };
        } else {
          responseText = response.text || '';
          continueLoop = false;
        }
      }

      const finalHistory: Message[] = [
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: message }],
        },
        {
          role: 'model',
          parts: [{ text: responseText }],
        },
      ];

      return {
        response: responseText,
        conversation_history: finalHistory,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error: any) {
      logger.error('Gemini analysis error:', error);
      throw error
    }
  }

  /**
   * Quick filter using Gemini Flash to determine if filing is material
   */
  async filterMaterialFiling(
    ticker: string,
    filingType: string,
    filingExcerpt: string
  ): Promise<{ isMaterial: boolean; reason: string }> {
    const prompt = `You are a financial analyst screening SEC filings for material changes.

Filing Type: ${filingType}
Company: ${ticker}
Excerpt (first 5000 chars):
${filingExcerpt.substring(0, 5000)}

Quick assessment - Does this filing contain ANY of the following MATERIAL items?
- Major business operation changes
- Significant risk factor updates
- Financial guidance changes (revenue, earnings)
- C-suite leadership changes
- M&A activity (acquisitions, mergers, divestitures)
- Legal issues with material impact
- Regulatory compliance issues
- Material weaknesses in internal controls

Answer with EXACTLY:
MATERIAL: YES or NO
REASON: [one sentence]

Example response:
MATERIAL: YES
REASON: Filing discloses surprise CEO departure and preliminary earnings miss.`;

    try {
      const result = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-flash',
       contents: prompt,
       config: { temperature: 0.2 }});

      const response = result.text;
       if (!response) {
          throw new Error("Empty response from Gemini API");
        }
      const isMaterial = response.includes('MATERIAL: YES');
      const reasonMatch = response.match(/REASON:\s*(.+?)(?:\n|$)/);
      let reason = reasonMatch ? reasonMatch[1]?.trim() : 'Analysis complete';
      
        if(!reason){
         reason = 'Analysis complete';
        }
      return { isMaterial, reason};
    } catch (error) {
      console.error('Error filtering material filing', error);
      throw error;
    }
  }

  /**
   * Deep narrative analysis using Gemini Pro
   */
  async analyzeFilingNarrative(
    ticker: string,
    filingType: string,
    filingDate: string,
    currentFilingText: string,
    previousFilingText?: string
  ): Promise<GeminiFilingAnalysis> {
    const previousContext = previousFilingText
      ? `
PREVIOUS FILING (for comparison):
${previousFilingText.substring(0, 10000)}
`
      : '';

    const prompt = `You are an expert financial analyst. Analyze this SEC filing in depth.

Company: ${ticker}
Filing Type: ${filingType}
Filing Date: ${filingDate}

CURRENT FILING:
${currentFilingText.substring(0, 15000)}

${previousContext}

Perform comprehensive analysis:

1. EXECUTIVE SUMMARY
   - What are the 3 most important changes?
   - Overall tone: bullish, bearish, neutral, or cautious?

2. LANGUAGE ANALYSIS
   - Management confidence level (1-10): __
   - New hedging language? (list specific phrases)
   - Removed positive language? (list what's missing)
   - Tone shift from last filing? (explain)

3. KEY CHANGES
   - Business operations
   - Financial metrics
   - Risk factors (new/removed)
   - Forward guidance

4. CONTRADICTIONS & RED FLAGS
   - Does this contradict previous statements?
   - Any concerning omissions?
   - Unexplained changes in risk factors?

5. ACTIONABLE INSIGHTS
   - What should traders watch next?
   - Expected market reaction?
   - Follow-up questions for management?

Format response as JSON:
{
  "summary": "...",
  "confidence_score": 7,
  "tone": "cautious|bullish|bearish|neutral",
  "key_changes": [
    {
      "category": "operations|financial|risk|guidance",
      "description": "...",
      "impact": "positive|negative|neutral"
    }
  ],
  "language_shifts": {
    "hedging_language": ["phrase1", "phrase2"],
    "removed_positive_language": ["phrase1"],
    "new_cautionary_statements": ["phrase1"]
  },
  "contradictions": [
    {
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "type": "...",
      "explanation": "..."
    }
  ],
  "red_flags": ["flag1", "flag2"],
  "watch_for": ["item1", "item2"]
}`.trim();

    try {
      const result = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-pro',
       contents: prompt,
       config: { temperature: 0.2 }});
      const response = result.text;

      // Extract JSON from response
      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from Gemini response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return analysis as GeminiFilingAnalysis;
    } catch (error) {
      console.error('Error analyzing filing narrative', error);
      throw error;
    }
  }

  /**
   * Detect contradictions between historical and new narratives
   */
  async detectContradictions(
    ticker: string,
    startDate: string,
    endDate: string,
    historicalStatements: string,
    newStatement: string
  ): Promise<GeminiContradictionResult> {
    const prompt = `You are a forensic financial analyst checking for inconsistencies.

Company: ${ticker}
Date Range: ${startDate} to ${endDate}

HISTORICAL STATEMENTS (chronological):
${historicalStatements}

NEW STATEMENT:
${newStatement}

Your task:
1. Identify ANY contradictions between statements
2. Flag significant strategic pivots
3. Note broken promises or missed guidance

For each contradiction:
- Severity: LOW / MEDIUM / HIGH / CRITICAL
- Type: guidance_miss / strategy_change / risk_reversal / broken_promise
- Explanation: What changed and why it matters

Response format:
{
  "contradictions": [
    {
      "type": "guidance_miss|strategy_change|risk_reversal|broken_promise",
      "severity": "HIGH",
      "old_statement": "...",
      "old_quarter": "2025 Q2",
      "new_statement": "...",
      "explanation": "..."
    }
  ]
}`;

    try {
      const result = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-flash',
       contents: prompt,
       config: { temperature: 0.2 }});

      const response = result.text;

      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { contradictions: [] };
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return analysis as GeminiContradictionResult;
    } catch (error) {
      console.error('Error detecting contradictions', error);
      throw error;
    }
  }

  /**
   * Generate hypothesis for volume divergence
   */
  async generateDivergenceHypothesis(
    ticker: string,
    spikeTime: string,
    currentVolume: number,
    avgVolume: number,
    deviation: number,
    priceChange: number,
    recentFilings: string,
    recentNews: string,
    socialSentiment: string
  ): Promise<GeminiDivergenceHypothesis> {
    const prompt = `A significant volume spike has been detected without an obvious public catalyst.

SPIKE DETAILS:
Ticker: ${ticker}
Time: ${spikeTime}
Volume: ${currentVolume} (normal: ${avgVolume})
Deviation: ${deviation}x normal volume
Price change: ${priceChange}%

RECENT CONTEXT:
Filings (last 48h): ${recentFilings}
News (last 48h): ${recentNews}
Social sentiment: ${socialSentiment}

QUESTION: Why is this stock moving?

Generate 3 hypotheses ranked by likelihood:

Hypothesis 1 (Most Likely):
- Explanation: [Why is this happening?]
- Evidence: [What supports this?]
- What to watch: [What would confirm this?]
- Timeline: [When would we know?]

Hypothesis 2:
- Explanation: ...
- Evidence: ...
- What to watch: ...
- Timeline: ...

Hypothesis 3:
- Explanation: ...
- Evidence: ...
- What to watch: ...
- Timeline: ...

TRADER ACTION ITEMS:
1. [Immediate: what to do right now]
2. [Next 24h: what to monitor]
3. [Next week: confirmation signals]

RISK ASSESSMENT:
- Insider trading probability: LOW/MEDIUM/HIGH
- Recommended action: BUY/SELL/HOLD/WAIT
- Risk level: LOW/MEDIUM/HIGH/CRITICAL

Response format:
{
  "hypotheses": [
    {
      "rank": 1,
      "confidence": 60,
      "explanation": "...",
      "evidence": ["...", "..."],
      "what_to_watch": ["...", "..."],
      "timeline": "..."
    },
    {
      "rank": 2,
      "confidence": ...,
      "explanation": "...",
      "evidence": ["...", "..."],
      "what_to_watch": ["...", "..."],
      "timeline": "..."
    },
    {
      "rank": 3,
      "confidence": ...,
      "explanation": "...",
      "evidence": ["...", "..."],
      "what_to_watch": ["...", "..."],
      "timeline": "..."
    },
  ],
  "trader_actions": {
    "immediate": ["...", "..."],
    "next_24h": ["...", "..."],
    "next_week": ["...", "..."]
  },
  "risk_assessment": {
    "insider_trading_probability": "LOW|MEDIUM|HIGH",
    "recommended_action": "BUY|SELL|HOLD|WAIT",
    "risk_level": "LOW|MEDIUM|HIGH|CRITICAL"
  }
}`;

    try {
      const result = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-flash',
       contents: prompt,
       config: { temperature: 0.2 }});
      const response = result.text;

      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const hypothesis = JSON.parse(jsonMatch[0]);
      return hypothesis as GeminiDivergenceHypothesis;
    } catch (error) {
      console.error('Error generating divergence hypothesis', error);
      throw error;
    }
  }

  /**
   * Check if a promise was kept based on new filing
   */
  async checkPromiseFulfillment(
    ticker: string,
    promiseText: string,
    promiseDate: string,
    newFilingContent: string
  ): Promise<{
    status: 'kept' | 'broken' | 'pending';
    evidence: string;
    explanation: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const prompt = `The company previously stated:
"${promiseText}"
(Made on: ${promiseDate})

Company: ${ticker}

New filing content:
${newFilingContent.substring(0, 10000)}

Was this promise kept, broken, or still pending?
Provide evidence from the new filing.

Response format:
{
  "status": "kept|broken|pending",
  "evidence": "..."
}`;

    try {
      const result = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-flash',
       contents: prompt,
       config: { temperature: 0.2 }});
      const response = result.text;

      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { status: 'pending', evidence: 'Unable to determine', explanation: '', severity: undefined };
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return analysis;
    } catch (error) {
      console.error('Error checking promise fulfillment', error);
      throw error;
    }
  }

  async analyzeText(text: string): Promise<string> {
   try {
    const result = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-flash',
       contents: text,
       config: { temperature: 0.2 }});
       
       const response = result.text;
       
       if (!response) {
          throw new Error("Empty response from Gemini API");
        }
        return response;
   } catch (error) {
    console.error('Error filtering material filing', error);
      throw error;
   }
  }

  async getTickerDetails(ticker: string): Promise<GeminiTicker> {
    const prompt = `
      Return a JSON array containing a single object for the stock ticker: ${ticker}. 
      The object must follow this exact structure to match my database schema:

      [{
        "symbol": "Ticker string",
        "company_name": "Full company name",
        "exchange": "Exchange name (e.g. NASDAQ, NYSE)",
        "sector": "Industrial sector",
      }]

      Important: Return ONLY the JSON array. Do not include markdown code blocks or conversational text.`;

    try {
      const response = await this.genAI.models.generateContent({ 
       model: 'gemini-1.5-flash',
       contents: prompt,
       config: { temperature: 0.2 }});
      

      if (!response.text) {
          throw new Error("Empty response from Gemini API");
        }

        const parsed = JSON.parse(response.text);

        // 1. Check if it's an array
        if (Array.isArray(parsed)) {
            const firstItem = parsed[0];
            
            // 2. If the first item is somehow still a string, parse it again (safety net)
            if (typeof firstItem === 'string') {
                return JSON.parse(firstItem);
            }
            
            return firstItem; // This is your GeminiTicker object
        }

      return parsed;

    } catch (error) {
      console.error('Error getting ticker details', error);
      throw error;
    }
  }
}

export default GeminiService.getInstance();



// ! this is the beginning of the new gemini servie 
// import { GoogleGenAI } from '@google/genai';
// import { envConfig } from '../../../config/environmentalVariables.js';
// import { logger } from '../../../config/logger.js';
// import { tools } from '../constants/aiTools.js';
// import { SYSTEM_PROMPT } from '../constants/prompts.js';
// import { ToolExecutionService } from './toolExecution.service.js';
// import type { Message, AnalysisResponse } from '../types/analysis.type.js';
import { env } from 'node:process';

export class NewGeminiService {
  private genAI: GoogleGenAI;
  private toolExecutionService: ToolExecutionService;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: envConfig.gemini_api_key });
    this.toolExecutionService = new ToolExecutionService();
  }

  async analyzeMessage(
    message: string,
    conversationHistory: Message[] = [],
    userId?: string
  ): Promise<AnalysisResponse> {
    try {
      const chat = this.genAI.chats.create({
        model: 'gemini-3-pro',
        history: conversationHistory,
        config: {
          tools: [tools],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
        }
      });

      const toolCalls: Array<{ tool: string; input: any; result: any }> = [];
      let responseText = '';
      let currentMessage: any = message;
      let continueLoop = true;

      while (continueLoop) {
        const response = await chat.sendMessage({ message: currentMessage });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          const functionResponses = await Promise.all(
            functionCalls.map(async (call: any) => {
              logger.info(`Tool: ${call.name}, Input: ${JSON.stringify(call.args)}`);

              const toolResult = await this.toolExecutionService.executeTool(
                call.name,
                call.args,
                userId
              );

              toolCalls.push({
                tool: call.name,
                input: call.args,
                result: toolResult,
              });

              return {
                functionResponse: {
                  name: call.name,
                  response: { result: toolResult },
                },
              };
            })
          );

          currentMessage = {
            parts: functionResponses,
          };
        } else {
          responseText = response.text || '';
          continueLoop = false;
        }
      }

      const finalHistory: Message[] = [
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: message }],
        },
        {
          role: 'model',
          parts: [{ text: responseText }],
        },
      ];

      return {
        response: responseText,
        conversation_history: finalHistory,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error: any) {
      logger.error('Gemini analysis error:', error);
      throw error
    }
  }
}