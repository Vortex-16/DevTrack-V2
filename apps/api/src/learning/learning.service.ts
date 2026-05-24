import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsArray, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLearningLogDto {
  @IsString() @MaxLength(200) topic!: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsUrl() source?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(600) @Type(() => Number) duration?: number;
}

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async listLogs(userId: string, limit = 20) {
    return this.prisma.learningLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: limit,
    });
  }

  async createLog(userId: string, dto: CreateLearningLogDto) {
    return this.prisma.learningLog.create({
      data: {
        userId,
        topic: dto.topic,
        notes: dto.notes ?? null,
        source: dto.source ?? null,
        tags: dto.tags ?? [],
        duration: dto.duration ?? null,
      },
    });
  }

  async getTopics(userId: string): Promise<{ topic: string; count: number }[]> {
    const groups = await this.prisma.learningLog.groupBy({
      by: ['topic'],
      where: { userId },
      _count: { topic: true },
      orderBy: { _count: { topic: 'desc' } },
      take: 20,
    });
    return groups.map((g: { topic: string; _count: { topic: number } }) => ({
      topic: g.topic,
      count: g._count.topic,
    }));
  }

  async getTotalMinutes(userId: string): Promise<number> {
    const result = await this.prisma.learningLog.aggregate({
      where: { userId, duration: { not: null } },
      _sum: { duration: true },
    });
    return result._sum.duration ?? 0;
  }
}
