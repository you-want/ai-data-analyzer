import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
// 为了让 dotenv 在 TS 环境下安全运行
import 'dotenv/config';

// 实例化一个临时的 ConfigService 供 TypeORM CLI 使用
const configService = new ConfigService();

// 根据运行环境确定基础目录
const baseDir = process.cwd();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'localhost'),
  port: Number(configService.get<number>('DATABASE_PORT', 5432)),
  username: configService.get<string>('DATABASE_USER'),
  password: configService.get<string>('DATABASE_PASSWORD'),
  database: configService.get<string>('DATABASE_NAME'),
  // 实体文件路径：根据你的项目结构调整
  entities: [
    join(baseDir, 'dist/**/*.entity.js'),
    join(baseDir, 'src/**/*.entity.ts'),
  ],
  migrations: [join(baseDir, 'src/migrations/*.ts')],
  synchronize: false, // 生产环境必须为 false
  logging: true,
});
