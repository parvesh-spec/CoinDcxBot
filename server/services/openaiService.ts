import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000 // 30 second timeout for faster responses
});

export interface EnhancementRequest {
  text: string;
  language: 'english' | 'hinglish';
  level: 'low' | 'medium';
}

export interface EnhancementResponse {
  enhancedText: string;
  originalText: string;
  language: string;
}

export class OpenAIService {
  /**
   * Enhance analysis text using GPT-5
   */
  static async enhanceAnalysisText(request: EnhancementRequest): Promise<EnhancementResponse> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    if (!request.text?.trim()) {
      throw new Error("Text is required for enhancement");
    }

    try {
      const prompt = this.createEnhancementPrompt(request.text, request.language, request.level);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Using GPT-4o for better stability
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(request.language, request.level)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500, // Limit response length for faster processing
        temperature: 0.3, // Lower temperature for more focused responses
        presence_penalty: 0, // Reduce computational overhead
        frequency_penalty: 0 // Reduce computational overhead
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      if (!result.enhancedText) {
        throw new Error("Invalid response from OpenAI");
      }

      return {
        enhancedText: result.enhancedText,
        originalText: request.text,
        language: request.language
      };

    } catch (error) {
      console.error("OpenAI Enhancement Error:", error);
      
      // Handle specific error types for better user feedback
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
          throw new Error("Enhancement request timed out. Please try again.");
        }
        
        if (error.message.includes('rate_limit') || error.message.includes('429')) {
          throw new Error("AI service is busy. Please wait a moment and try again.");
        }
        
        if (error.message.includes('Invalid API key') || error.message.includes('401')) {
          throw new Error("AI service configuration error. Please contact support.");
        }
        
        if (error.message.includes('insufficient_quota') || error.message.includes('billing')) {
          throw new Error("AI service quota exceeded. Please contact support.");
        }
        
        // Generic OpenAI API error
        if (error.message.includes('OpenAI')) {
          throw new Error("AI enhancement service is temporarily unavailable. Please try again.");
        }
        
        throw new Error(`Enhancement failed: ${error.message}`);
      }
      
      throw new Error("Enhancement service is currently unavailable. Please try again later.");
    }
  }

  /**
   * Create system prompt based on language preference
   */
  private static getSystemPrompt(language: 'english' | 'hinglish', level: 'low' | 'medium'): string {
    if (level === 'low') {
      // LOW LEVEL: Grammar correction only
      return `Fix grammar errors in ${language} text. Keep same meaning and length. Return JSON: {"enhancedText": "corrected text"}`;
    } else {
      // MEDIUM LEVEL: Light enhancement  
      return `Improve ${language} text - fix grammar and enhance clarity. Keep same meaning, don't add new info. Return JSON: {"enhancedText": "enhanced text"}`;
    }
  }

  /**
   * Create enhancement prompt
   */
  private static createEnhancementPrompt(text: string, language: 'english' | 'hinglish', level: 'low' | 'medium'): string {
    if (level === 'low') {
      return `Text: "${text}"\n\nFix grammar and typos only. Keep same meaning.`;
    } else {
      return `Text: "${text}"\n\nImprove grammar and clarity. Use only existing information.`;
    }
  }
}