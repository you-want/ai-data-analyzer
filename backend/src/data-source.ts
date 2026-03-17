import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
// 为了让 dotenv 在 TS 环境下安全运行
import 'dotenv/config';

// 手动配置路径
process.env.DOTENV_CONFIG_PATH = join(__dirname, '../../.env');

// 实例化一个临时的 ConfigService 供 TypeORM CLI 使用
const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'localhost'),
  port: Number(configService.get<number>('DATABASE_PORT', 5432)),
  username: configService.get<string>('DATABASE_USER'),
  password: configService.get<string>('DATABASE_PASSWORD'),
  database: configService.get<string>('DATABASE_NAME'),
  // 实体文件路径：根据你的项目结构调整
  // 如果是 ts-node 运行，指向 src/**/*.entity.ts
  // 如果是编译后运行，指向 dist/**/*.entity.js
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false, // 生产环境必须为 false
  logging: true,
});
