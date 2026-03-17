import { PartialType } from '@nestjs/mapped-types';
import { CreateAnalysisResultDto } from './create-analysis-result.dto';

export class UpdateAnalysisResultDto extends PartialType(
  CreateAnalysisResultDto,
) {}
