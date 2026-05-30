import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateMemoryDto {
  title: string;
  content: string;
  tags: string[];
}

export interface UpdateMemoryDto {
  title?: string;
  content?: string;
  tags?: string[];
}

@Injectable()
export class BuildMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new build memory.
   */
  async create(userId: string, data: CreateMemoryDto) {
    const memory = await this.prisma.buildMemory.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        tags: data.tags,
      },
    });

    return memory;
  }

  /**
   * Find all memories for a user with optional tag filters.
   */
  async findAll(userId: string, filters?: { tags?: string[] }) {
    const where: any = { userId };

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const memories = await this.prisma.buildMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        createdAt: true,
      },
    });

    return memories;
  }

  /**
   * Find a single memory by ID.
   */
  async findOne(id: string, userId: string) {
    const memory = await this.prisma.buildMemory.findUnique({
      where: { id },
    });

    if (!memory) {
      throw new NotFoundException('Memory not found');
    }

    if (memory.userId !== userId) {
      throw new ForbiddenException('You do not have access to this memory');
    }

    return memory;
  }

  /**
   * Update a memory.
   */
  async update(id: string, userId: string, data: UpdateMemoryDto) {
    // Verify ownership
    await this.findOne(id, userId);

    const memory = await this.prisma.buildMemory.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });

    return memory;
  }

  /**
   * Delete a memory.
   */
  async delete(id: string, userId: string) {
    // Verify ownership
    await this.findOne(id, userId);

    await this.prisma.buildMemory.delete({
      where: { id },
    });

    return { message: 'Memory deleted successfully' };
  }

  /**
   * Search memories by content (full-text search).
   */
  async search(userId: string, query: string) {
    // Simple case-insensitive search (Postgres full-text search would be better for production)
    const memories = await this.prisma.buildMemory.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        createdAt: true,
      },
    });

    return memories;
  }
}
