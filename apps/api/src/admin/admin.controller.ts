import { Controller, Get, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { Request } from 'express';

@Controller({ path: 'admin', version: '1' })
@ApiTags('admin')
@ApiBearerAuth('JWT')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * List all users (admin only)
   */
  @Get('users')
  @ApiOperation({ summary: 'List all users', description: 'Get a list of all users in the system (admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        plan: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return { users, total: users.length };
  }

  /**
   * Get user details (admin only)
   */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        githubAccount: {
          select: {
            login: true,
            lastSyncedAt: true,
          },
        },
        _count: {
          select: {
            repositories: true,
            projects: true,
            learningLogs: true,
            aiInsights: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user role (admin only)
   */
  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: 'USER' | 'ADMIN' | 'MODERATOR',
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    // Get old role before update
    const oldUser = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, email: true },
    });

    if (!oldUser) {
      throw new Error('User not found');
    }

    // Update role
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // Log the role change
    await this.auditLog.log({
      action: 'USER_ROLE_CHANGED',
      performedBy: admin.id,
      targetUserId: id,
      metadata: {
        oldRole: oldUser.role,
        newRole: role,
        targetEmail: user.email,
      },
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
    });

    return { message: 'User role updated', user };
  }

  /**
   * Update user plan (admin only)
   */
  @Patch('users/:id/plan')
  @HttpCode(HttpStatus.OK)
  async updateUserPlan(
    @Param('id') id: string,
    @Body('plan') plan: 'FREE' | 'PRO' | 'ENTERPRISE',
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const oldUser = await this.prisma.user.findUnique({
      where: { id },
      select: { plan: true, email: true },
    });

    if (!oldUser) {
      throw new Error('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { plan },
      select: {
        id: true,
        email: true,
        plan: true,
      },
    });

    await this.auditLog.log({
      action: 'USER_PLAN_CHANGED',
      performedBy: admin.id,
      targetUserId: id,
      metadata: {
        oldPlan: oldUser.plan,
        newPlan: plan,
        targetEmail: user.email,
      },
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
    });

    return { message: 'User plan updated', user };
  }

  /**
   * Soft delete user (admin only)
   */
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    // Prevent self-deletion
    if (id === admin.id) {
      throw new Error('Cannot delete your own account');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        email: true,
      },
    });

    await this.auditLog.log({
      action: 'USER_DELETED',
      performedBy: admin.id,
      targetUserId: id,
      metadata: {
        targetEmail: user.email,
      },
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
    });

    return { message: 'User deleted', user };
  }

  /**
   * Get system statistics (admin only)
   */
  @Get('stats')
  async getSystemStats() {
    const [
      totalUsers,
      activeUsers,
      totalRepos,
      totalCommits,
      totalProjects,
      totalAIInsights,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          updatedAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
      this.prisma.repository.count(),
      this.prisma.commit.count(),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.aIInsight.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      repositories: totalRepos,
      commits: totalCommits,
      projects: totalProjects,
      aiInsights: totalAIInsights,
    };
  }

  /**
   * Get all audit logs (admin only)
   */
  @Get('audit-logs')
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditLog.getAllLogs(
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0,
    );
  }

  /**
   * Get audit logs for a specific user (admin only)
   */
  @Get('audit-logs/user/:userId')
  async getUserAuditLogs(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLog.getUserLogs(
      userId,
      limit ? parseInt(limit) : 50,
    );
  }

  /**
   * Get security-sensitive audit logs (admin only)
   */
  @Get('audit-logs/security')
  async getSecurityLogs(@Query('limit') limit?: string) {
    return this.auditLog.getSecurityLogs(
      limit ? parseInt(limit) : 50,
    );
  }
}
