import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalyzeTextDto } from './dto/analyze-text.dto';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  // 提供一个 POST 接口，路径为 /analysis/text
  @Post('text')
  @HttpCode(HttpStatus.OK) // 返回 200 状态码
  async analyzeText(@Body() analyzeTextDto: AnalyzeTextDto) {
    // 调用 Service 层的方法
    const result = await this.analysisService.analyzeText(
      analyzeTextDto.content,
    );

    // 统一返回格式
    return {
      success: true,
      data: result,
    };
  }

  @Get()
  getAnalysis(): string {
    return this.analysisService.getAnalysisResult();
  }

  // 健康检查接口
  @Get('status')
  getStatus(): string {
    return 'Analysis service is up and running!';
  }
}
