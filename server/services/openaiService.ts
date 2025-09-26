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
        temperature: 0.3, // Lower temperature for more focused responses
        presence_penalty: 0,
        frequency_penalty: 0
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
    const languageInstruction = language === 'hinglish' 
      ? "CRITICAL: You MUST respond ONLY in Hinglish (Hindi + English mix). Use Hindi words mixed with English naturally. NEVER use pure English. Always mix Hindi and English words."
      : "CRITICAL: You MUST respond ONLY in pure English. NEVER use Hindi words. Use only English language throughout the response.";
    
    if (level === 'low') {
      // LOW LEVEL: Grammar correction only
      return `You are a grammar correction assistant. Your ONLY task is to fix grammar errors and typos while keeping the EXACT same meaning, tone, and length.

${languageInstruction}

Guidelines for LOW level:
- Fix ONLY grammar mistakes, spelling errors, and basic sentence structure
- Keep the EXACT same emotion, tone, and message  
- Do NOT add new information or expand content
- Do NOT make it more professional or formal
- Keep the same length and style
- Preserve original meaning completely

Respond in JSON format: {"enhancedText": "your corrected text here"}`;
    } else {
      // MEDIUM LEVEL: Enhancement with existing information
      return `You are a text enhancement assistant. Your task is to improve the text quality while using ONLY the existing information provided.

${languageInstruction}

Guidelines for MEDIUM level:
- Fix grammar, spelling, and sentence structure
- Improve clarity, flow, and readability using existing information only
- Make it slightly more professional and well-structured
- Enhance presentation while keeping the same core message and emotion
- You may rearrange sentences for better flow
- Use only information that's provided or clearly implied in the original
- Make it more comprehensive and actionable while staying concise
- Do NOT add new facts or data not mentioned in the original

Respond in JSON format: {"enhancedText": "your enhanced text here"}`;
    }
  }

  /**
   * Create enhancement prompt
   */
  private static createEnhancementPrompt(text: string, language: 'english' | 'hinglish', level: 'low' | 'medium'): string {
    const languageLabel = language === 'hinglish' ? 'Hinglish (Hindi + English mix)' : 'English';
    
    if (level === 'low') {
      // LOW LEVEL: Grammar correction only
      return `Please correct grammar errors and typos in this ${languageLabel} text while keeping EXACTLY the same meaning, tone, and emotion.

Original text:
"${text}"

IMPORTANT FOR LOW LEVEL:
- Fix ONLY grammar mistakes, spelling errors, and sentence structure
- Keep the EXACT same meaning, tone, and emotion
- Do NOT add new information or make it more professional
- Do NOT expand or elaborate the content
- Keep the same length and casual/formal style as original
- CRITICAL: Your response MUST be in ${languageLabel} language only. Do not mix languages.

Only correct what's grammatically wrong, nothing else.`;
    } else {
      // MEDIUM LEVEL: Light enhancement
      return `Please enhance this ${languageLabel} text by improving clarity and structure while using ONLY the information provided in the original text.

Original text:
"${text}"

IMPORTANT FOR MEDIUM LEVEL:
- Fix grammar, spelling, and sentence structure
- Improve clarity, flow, and readability 
- Make it slightly more professional and well-structured
- Enhance presentation while keeping the same core message and emotion
- You may rearrange sentences for better flow
- Use only information that's provided or clearly implied in the original
- Make it more comprehensive and actionable while staying concise
- CRITICAL: Your response MUST be in ${languageLabel} language only. Do not mix languages.
- Do NOT add new facts, data, or information not mentioned in the original

Transform the rough text into a polished version using existing content only.`;
    }
  }
}