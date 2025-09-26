import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface EnhancementRequest {
  text: string;
  language: 'english' | 'hinglish';
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
      const prompt = this.createEnhancementPrompt(request.text, request.language);
      
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(request.language)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
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
  private static getSystemPrompt(language: 'english' | 'hinglish'): string {
    if (language === 'hinglish') {
      return `You are a grammar correction assistant for Hinglish (Hindi + English mix) text. 
      Your ONLY task is to fix grammar and improve readability while keeping the EXACT same meaning and emotion.
      
      Guidelines:
      - Fix grammar errors and typos only
      - Maintain the EXACT same emotion, tone, and message
      - Keep the same length - do NOT add new information
      - Use natural Hinglish mixing (Hindi + English)
      - DO NOT expand or elaborate the content
      - Only correct what's grammatically wrong
      
      Respond in JSON format: {"enhancedText": "corrected text here"}`;
    } else {
      return `You are a grammar correction assistant for English text.
      Your ONLY task is to fix grammar and improve readability while keeping the EXACT same meaning and emotion.
      
      Guidelines:
      - Fix grammar errors, typos, and sentence structure only
      - Maintain the EXACT same emotion, tone, and message
      - Keep the same length - do NOT add new information
      - Use clear, professional English
      - DO NOT expand or elaborate the content
      - Only correct what's grammatically wrong
      
      Respond in JSON format: {"enhancedText": "corrected text here"}`;
    }
  }

  /**
   * Create enhancement prompt
   */
  private static createEnhancementPrompt(text: string, language: 'english' | 'hinglish'): string {
    const languageInstruction = language === 'hinglish' 
      ? "Fix grammar errors and typos in this Hinglish text:"
      : "Fix grammar errors and typos in this English text:";

    return `${languageInstruction}

Original text:
"${text}"

Please correct ONLY the following:
1. Grammar mistakes
2. Spelling errors  
3. Sentence structure issues
4. Basic readability improvements

IMPORTANT:
- Keep the EXACT same meaning and emotion
- Do NOT add new content or information
- Do NOT make it longer
- Do NOT change the overall message
- Only fix what's grammatically wrong`;
  }
}