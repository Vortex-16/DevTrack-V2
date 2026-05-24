import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global() — PrismaService is available everywhere without re-importing.
 * Only one connection pool is maintained across the entire application.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
