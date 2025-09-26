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
    const baseLanguageRules = language === 'hinglish' 
      ? "Use natural Hinglish mixing (Hindi + English)" 
      : "Use clear, professional English";
    
    if (level === 'low') {
      // LOW LEVEL: Grammar correction only
      return `You are a grammar correction assistant for ${language === 'hinglish' ? 'Hinglish (Hindi + English mix)' : 'English'} text. 
      Your ONLY task is to fix grammar and improve readability while keeping the EXACT same meaning and emotion.
      
      Guidelines:
      - Fix grammar errors and typos only
      - Maintain the EXACT same emotion, tone, and message
      - Keep the same length - do NOT add new information
      - ${baseLanguageRules}
      - DO NOT expand or elaborate the content
      - Only correct what's grammatically wrong
      
      Respond in JSON format: {"enhancedText": "corrected text here"}`;
    } else {
      // MEDIUM LEVEL: Light enhancement with existing information
      return `You are a text enhancement assistant for ${language === 'hinglish' ? 'Hinglish (Hindi + English mix)' : 'English'} text.
      Your task is to improve the text while keeping it concise and using ONLY the information provided.
      
      Guidelines:
      - Fix grammar, spelling, and sentence structure
      - Improve clarity and flow using existing information only
      - Keep the EXACT same emotion, tone, and core message
      - ${baseLanguageRules}
      - DO NOT add new facts or information not implied in the original
      - Make it slightly more professional but not lengthy
      - Enhance readability while preserving original meaning
      
      Respond in JSON format: {"enhancedText": "enhanced text here"}`;
    }
  }

  /**
   * Create enhancement prompt
   */
  private static createEnhancementPrompt(text: string, language: 'english' | 'hinglish', level: 'low' | 'medium'): string {
    const languageLabel = language === 'hinglish' ? 'Hinglish' : 'English';
    
    if (level === 'low') {
      // LOW LEVEL: Grammar correction only
      const instruction = `Fix grammar errors and typos in this ${languageLabel} text:`;
      
      return `${instruction}

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
    } else {
      // MEDIUM LEVEL: Light enhancement
      const instruction = `Enhance this ${languageLabel} text while using only existing information:`;
      
      return `${instruction}

Original text:
"${text}"

Please improve the following while keeping it concise:
1. Grammar, spelling, and sentence structure
2. Clarity and flow using existing information only
3. Professional tone while maintaining emotion
4. Readability without changing meaning

IMPORTANT:
- Keep the SAME core message and emotion
- Do NOT add new facts or information
- Use only what's provided or implied in the original
- Make it better but not lengthy
- Preserve the original meaning and intent`;
    }
  }
}