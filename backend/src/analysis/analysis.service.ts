import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class AnalysisService {
  // 日志记录器
  private readonly logger = new Logger(AnalysisService.name);

  // 构造函数，注入 OpenAIService
  constructor(private readonly openAIService: OpenAIService) {}

  /**
   * 将 JSON 数组转换为 Markdown 表格，大幅节省 Token
   */
  private jsonArrayToMarkdownTable(rows: Record<string, any>[]): string {
    if (!rows || rows.length === 0) return '';

    // 获取所有可能的表头
    const headers = Array.from(new Set(rows.flatMap(Object.keys)));

    const head = `| ${headers.join(' | ')} |`;
    const sep = `| ${headers.map(() => '---').join(' | ')} |`;

    const body = rows
      .map((r) => {
        return `| ${headers
          .map((h) => {
            // 简单的数据清洗：处理 null、undefined，替换换行符防止破坏表格
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const val = r[h] ?? '';
            return String(val).replace(/\n/g, ' ');
          })
          .join(' | ')} |`;
      })
      .join('\n');

    return [head, sep, body].join('\n');
  }

  /**
   * 数据预处理主管道
   */
  public preprocessPayload(input: string | Record<string, any>[]): string {
    if (Array.isArray(input)) {
      // 结构化数据：转为表格并去掉首尾多余空格
      return this.jsonArrayToMarkdownTable(input).trim();
    }

    // 纯文本数据：去除多余的连续换行和空白
    return String(input)
      .trim()
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ +/g, ' ');
  }

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

  /**
   * 结合预处理进行综合数据分析
   * 支持传入纯文本或结构化 JSON 数组（CSV 解析结果）
   */
  async analyzeData(data: string | Record<string, any>[], prompt: string) {
    // 1. 数据预处理（清洗 + 降维压缩）
    const cleanData = this.preprocessPayload(data);

    // 2. 组装最终发给大模型的提示词
    const finalPrompt = `
      作为专业的数据分析师，请基于以下提供的数据回答问题。
      要求：结论清晰，分点陈述，如发现数据异常请指出。

      【分析需求】
      ${prompt}

      【数据内容】
      ${cleanData}
          `;

    // 3. 调用 AI 服务
    return this.openAIService.chat(finalPrompt);
  }

  // 保留原有方法兼容性
  getAnalysisResult(): string {
    return 'This is a detailed analysis result from the AnalysisService.';
  }
}
