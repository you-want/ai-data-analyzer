export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  usage: TokenUsage;
  model: string;
}

export interface ILLMService {
  chat(prompt: string, model?: string): Promise<string>;

  chatWithUsage(prompt: string, model?: string): Promise<ChatResult>;

  chatStream?(prompt: string, model?: string): Promise<AsyncIterable<string>>;
}
