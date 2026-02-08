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

export class GeminiService {
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