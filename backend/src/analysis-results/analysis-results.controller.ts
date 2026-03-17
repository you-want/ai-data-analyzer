import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AnalysisResultsService } from './analysis-results.service';
import { CreateAnalysisResultDto } from './dto/create-analysis-result.dto';
import { UpdateAnalysisResultDto } from './dto/update-analysis-result.dto';

@Controller('analysis-results')
export class AnalysisResultsController {
  constructor(
    private readonly analysisResultsService: AnalysisResultsService,
  ) {}

  @Post()
  create(@Body() createAnalysisResultDto: CreateAnalysisResultDto) {
    return this.analysisResultsService.create(createAnalysisResultDto);
  }

  @Get()
  findAll() {
    return this.analysisResultsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.analysisResultsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnalysisResultDto: UpdateAnalysisResultDto,
  ) {
    return this.analysisResultsService.update(id, updateAnalysisResultDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.analysisResultsService.remove(id);
  }
}
