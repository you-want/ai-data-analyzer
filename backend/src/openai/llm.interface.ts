export interface ILLMService {
  /**
   * 发送聊天请求并获取大模型的回复
   * @param prompt 用户的提示词或对话上下文
   * @param model 可选，指定使用的模型名称，如果不传则使用默认模型
   */
  chat(prompt: string, model?: string): Promise<string>;
}
