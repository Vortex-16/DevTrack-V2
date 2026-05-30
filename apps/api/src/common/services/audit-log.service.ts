import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogData {
  action: AuditAction;
  performedBy: string;
  targetUserId?: string;
  targetResource?: string;
  targetResourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async log(data: AuditLogData): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: data.action,
        performedBy: data.performedBy,
        ...(data.targetUserId && { targetUserId: data.targetUserId }),
        ...(data.targetResource && { targetResource: data.targetResource }),
        ...(data.targetResourceId && { targetResourceId: data.targetResourceId }),
        ...(data.metadata && { metadata: data.metadata }),
        ...(data.ipAddress && { ipAddress: data.ipAddress }),
        ...(data.userAgent && { userAgent: data.userAgent }),
      },
    });
  }

  /**
   * Get audit logs for a user (admin only)
   */
  async getUserLogs(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { performedBy: userId },
          { targetUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all audit logs (admin only)
   */
  async getAllLogs(limit = 100, offset = 0) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count(),
    ]);

    return { logs, total };
  }

  /**
   * Get audit logs by action type (admin only)
   */
  async getLogsByAction(action: AuditAction, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent security-sensitive actions (admin only)
   */
  async getSecurityLogs(limit = 50) {
    const securityActions: AuditAction[] = [
      'USER_ROLE_CHANGED',
      'USER_DELETED',
      'PASSWORD_CHANGED',
      'TOKEN_REFRESHED',
    ];

    return this.prisma.auditLog.findMany({
      where: {
        action: { in: securityActions },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
