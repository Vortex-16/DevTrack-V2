import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuditLogService } from '../common/services/audit-log.service';

@Module({
  controllers: [AdminController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AdminModule {}
