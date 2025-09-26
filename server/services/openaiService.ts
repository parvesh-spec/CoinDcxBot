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
      throw new Error(`Failed to enhance text: ${error.message}`);
    }
  }

  /**
   * Create system prompt based on language preference
   */
  private static getSystemPrompt(language: 'english' | 'hinglish'): string {
    if (language === 'hinglish') {
      return `You are a professional cryptocurrency market analyst who writes in Hinglish (Hindi + English mix). 
      Your task is to enhance rough analysis text into professional, well-structured market analysis.
      
      Guidelines:
      - Mix Hindi and English naturally like a typical Indian trader would speak
      - Use technical terms in English but explanations can be in Hindi/Hinglish
      - Maintain professional tone while being conversational
      - Focus on market analysis, technical factors, and trading insights
      - Structure the content logically with proper flow
      - Keep the enhanced text comprehensive but not overly long
      
      Respond in JSON format: {"enhancedText": "your enhanced analysis here"}`;
    } else {
      return `You are a professional cryptocurrency market analyst who writes in clear, professional English.
      Your task is to enhance rough analysis text into well-structured, comprehensive market analysis.
      
      Guidelines:
      - Use professional financial and technical analysis language
      - Maintain objective and analytical tone
      - Structure content with clear logical flow
      - Include relevant market factors and technical insights
      - Enhance clarity and readability
      - Keep analysis focused and actionable
      
      Respond in JSON format: {"enhancedText": "your enhanced analysis here"}`;
    }
  }

  /**
   * Create enhancement prompt
   */
  private static createEnhancementPrompt(text: string, language: 'english' | 'hinglish'): string {
    const languageInstruction = language === 'hinglish' 
      ? "Please enhance this text in Hinglish (Hindi + English mix) style"
      : "Please enhance this text in professional English";

    return `${languageInstruction}:

Original rough text:
"${text}"

Enhance this into a professional market analysis while:
1. Preserving all key points and insights
2. Improving structure and flow
3. Adding professional terminology where appropriate
4. Making it more comprehensive and actionable
5. Maintaining the original meaning and sentiment

Do not add any information that wasn't implied in the original text.`;
  }
}