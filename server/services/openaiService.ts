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
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
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
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to enhance text: ${errorMessage}`);
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