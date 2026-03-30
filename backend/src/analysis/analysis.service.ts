import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class AnalysisService {
  // 日志记录器
  private readonly logger = new Logger(AnalysisService.name);

  // 构造函数，注入 OpenAIService
  constructor(private readonly openAIService: OpenAIService) {}

  /**
   * 数据预处理：清理文本
   */
  private preprocessText(text: string): string {
    if (!text) return '';

    // 1. 去除前后空白字符
    let cleanedText = text.trim();
    // 2. 替换多个连续的换行符为单个换行符
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');

    return cleanedText;
  }

  /**
   * 分析文本数据
   */
  async analyzeText(rawContent: string): Promise<string> {
    // 1. 数据预处理
    const cleanContent = this.preprocessText(rawContent);
    this.logger.debug(`预处理完成，文本长度: ${cleanContent.length}`);

    // 2. 构建 Prompt
    const prompt = `你是一个专业的数据分析专家。请仔细阅读并分析以下文本数据，提取出关键信息、主要观点，并给出你的专业总结或建议：\n\n"""\n${cleanContent}\n"""`;

    // 3. 调用 AI 服务
    return this.openAIService.chat(prompt);
  }

  // 保留原有方法兼容性
  getAnalysisResult(): string {
    return 'This is a detailed analysis result from the AnalysisService.';
  }
}
