import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

const AGENT_SYSTEM_PROMPT = `
  你是一个专业的数据分析 AI Agent。请根据用户的请求和提供的数据，逐步进行分析。
  你可以使用以下工具（Tools）来辅助你的分析：

  1. [calculate_total]: 计算指定列的总和。参数格式: {"column": "金额列名"}
  2. [find_max]: 找出指定列的最大值及对应行。参数格式: {"column": "金额列名"}

  【执行规范】
  你必须按照以下格式进行思考和行动：
  Thought: 我需要做什么。
  Action: 工具名称 (如果不需要工具，请填写 NONE)
  Action Input: 工具的 JSON 参数 (如果没有，请填写 {})
  --- (等待系统返回 Observation) ---

  如果你已经得到了最终结论，请按照以下格式输出：
  Thought: 我已经得出结论。
  Final Answer: 你的最终自然语言回复。
  `;

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

  /**
   * 工具执行器：根据 AI 的指令执行对应的本地代码
   */

  private executeTool(
    action: string,
    actionInput: string,
    data: any[],
  ): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const input = JSON.parse(actionInput);

      switch (action.trim()) {
        case 'calculate_total': {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const colName = input.column as string;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const total = data.reduce(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
            (sum, row) => sum + (Number(row[colName]) || 0),
            0,
          );
          return `列 [${colName}] 的总和为: ${total}`;
        }
        case 'find_max': {
          if (data.length === 0) return '数据为空';
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const colName = input.column as string;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const maxRow = data.reduce((max, row) =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
            (Number(row[colName]) || 0) > (Number(max[colName]) || 0)
              ? row
              : max,
          );
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return `列 [${colName}] 的最大值为: ${maxRow[colName]}，完整行数据: ${JSON.stringify(maxRow)}`;
        }

        case 'NONE':
          return '无需调用工具';

        default:
          return `未知的工具: ${action}`;
      }
    } catch (error) {
      const err = error as Error;
      return `工具执行失败: ${err.message}`;
    }
  }

  /**
   * Agent 核心循环
   * @param rawData 解析后的结构化数据 (例如 CSV rows)
   * @param userPrompt 用户的自然语言请求
   */

  async runAgentLoop(rawData: any[], userPrompt: string): Promise<string> {
    // 为了节省 Token，如果数据量适中，我们可以将其转为 Markdown 表格作为上下文
    const dataContext = this.preprocessPayload(rawData);

    // 初始化对话上下文
    let conversationHistory = `
      ${AGENT_SYSTEM_PROMPT}

      【当前数据片段】
      ${dataContext}

      【用户请求】
      ${userPrompt}
      `;

    const MAX_ITERATIONS = 5; // 防止死循环
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      this.logger.debug(`Agent Iteration ${iterations}...`);

      // 1. 调用大模型
      const aiResponse = await this.openAIService.chat(conversationHistory);
      this.logger.debug(`AI Response:\n${aiResponse}`);
      conversationHistory += `\n${aiResponse}\n`; // 记录 AI 的回复

      // 2. 解析 AI 的意图：是否得出了最终结论？
      if (aiResponse.includes('Final Answer:')) {
        const finalAnswer = aiResponse.split('Final Answer:')[1].trim();
        return finalAnswer;
      }

      // 3. 解析 AI 的意图：是否需要调用工具？
      const actionMatch = aiResponse.match(/Action:\s*(.+)/);
      const inputMatch = aiResponse.match(/Action Input:\s*(.+)/);

      if (actionMatch && inputMatch) {
        const action = actionMatch[1].trim();
        const actionInput = inputMatch[1].trim();

        if (action !== 'NONE') {
          this.logger.debug(
            `Executing Tool: ${action} with input: ${actionInput}`,
          );

          // 4. 执行本地工具
          const observation = this.executeTool(action, actionInput, rawData);

          // 5. 将观察结果追加到上下文中，进入下一次循环
          const observationLog = `Observation: ${observation}`;
          conversationHistory += `${observationLog}\n`;
          this.logger.debug(observationLog);
        }
      } else {
        // 容错处理：AI 没有按格式输出
        conversationHistory += `Observation: 请严格按照 Thought / Action / Action Input / Final Answer 的格式输出。\n`;
      }
    }

    return 'Agent 执行达到了最大迭代次数，未能得出最终结论。';
  }
}
