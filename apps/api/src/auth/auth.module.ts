import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ClerkStrategy } from './clerk.strategy';
import { ClerkAuthGuard } from './clerk.guard';
import { PlansGuard } from './plans.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'clerk-jwt' }),
    UsersModule,
  ],
  providers: [ClerkStrategy, ClerkAuthGuard, PlansGuard],
  exports: [ClerkAuthGuard, PlansGuard, PassportModule],
})
export class AuthModule {}
