import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProjectStatus, TaskStatus, Priority } from '@devtrack/database';
import { IsString, IsOptional, IsEnum, IsDateString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsDateString() deadline?: string;
}

export class CreateTaskDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus) status!: TaskStatus;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { userId, deletedAt: null },
      include: {
        tasks: {
          where: { status: { not: 'DONE' } },
          orderBy: { priority: 'desc' },
          take: 5,
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });
  }

  async addTask(userId: string, projectId: string, dto: CreateTaskDto) {
    // Verify ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? Priority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async updateTaskStatus(userId: string, taskId: string, dto: UpdateTaskStatusDto) {
    // Join through project to verify ownership
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { userId } },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
      },
    });
  }

  async archiveProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ARCHIVED, deletedAt: new Date() },
    });
  }
}
