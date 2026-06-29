import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { JwtPayload } from './auth.types';
import { AuthService } from './auth.service';

type JwtFromRequestFunction = (req: unknown) => string | null;

const extractJwtFromRequest: JwtFromRequestFunction = (request) => {
  const req = request as { headers?: Record<string, string> };
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'dev-secret-change-me',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    return this.authService.findAuthenticatedUser(payload.sub);
  }
}
