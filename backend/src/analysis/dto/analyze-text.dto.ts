import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AnalyzeTextDto {
  @IsString()
  @IsNotEmpty({ message: '分析内容不能为空' })
  @MaxLength(5000, { message: '分析内容不能超过5000字' })
  content: string;
}
