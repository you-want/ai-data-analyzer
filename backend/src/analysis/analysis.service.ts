import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class AnalysisService {
  constructor(private readonly openAIService: OpenAIService) {}

  async analyzeData(data: any): Promise<string> {
    // 构建 Prompt
    const prompt = `请作为数据分析师，分析以下数据并给出专业见解：\n${JSON.stringify(data)}`;

    // 调用 AI 服务
    return this.openAIService.chat(prompt);
  }

  // 保留原有方法兼容性
  getAnalysisResult(): string {
    return 'This is a detailed analysis result from the AnalysisService.';
  }
}
