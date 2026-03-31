import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { parse } from 'fast-csv';
import * as multer from 'multer';

@Controller('data')
export class DataController {
  @Post('upload/csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 限制 10MB
    }),
  )
  async uploadCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传 CSV 文件');
    }

    const rows: Record<string, string>[] = [];

    // 使用 fast-csv 流式解析内存中的 buffer
    await new Promise<void>((resolve, reject) => {
      const stream = parse({ headers: true, ignoreEmpty: true })
        .on('error', (error: Error) =>
          reject(new BadRequestException(`CSV 解析失败: ${error.message}`)),
        )

        .on('data', (row: Record<string, string>) => rows.push(row))
        .on('end', () => resolve());

      stream.write(file.buffer);

      stream.end();
    });

    // 这里可以进一步将 rows 存入数据库，或者直接传递给分析服务
    return {
      message: '文件解析成功',
      rowCount: rows.length,
      preview: rows.slice(0, 3), // 返回前3行作为预览
    };
  }
}
