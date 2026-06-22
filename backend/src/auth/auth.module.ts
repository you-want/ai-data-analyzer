import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Workspace } from './entities/workspace.entity';
import { Membership } from './entities/membership.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceAuditLog } from './entities/workspace-audit-log.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { WorkspaceGuard } from './guards/workspace.guard';
import { AuthAuditService } from './auth-audit.service';
import { AuthNotificationService } from './auth-notification.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: {
          expiresIn: Number(
            configService.get<string>('JWT_EXPIRES_IN_SECONDS', '604800'),
          ),
        },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      Workspace,
      Membership,
      WorkspaceInvitation,
      WorkspaceAuditLog,
      OAuthAccount,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthAuditService,
    AuthNotificationService,
    JwtStrategy,
    RolesGuard,
    WorkspaceGuard,
  ],
  exports: [
    AuthService,
    AuthAuditService,
    AuthNotificationService,
    RolesGuard,
    WorkspaceGuard,
    TypeOrmModule,
  ],
})
export class AuthModule {}
