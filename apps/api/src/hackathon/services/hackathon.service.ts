import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateHackathonDto, UpdateHackathonDto, CreateTeamDto, UpdateTeamDto, AddParticipantDto } from '../dto/hackathon.dto';

@Injectable()
export class HackathonService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new hackathon
   */
  async createHackathon(userId: string, dto: CreateHackathonDto) {
    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const hackathon = await this.prisma.hackathon.create({
      data: {
        name: dto.name,
        ...(dto.description !== undefined && { description: dto.description }),
        startDate,
        endDate,
        createdBy: userId,
        status: 'DRAFT',
      },
    });

    // Automatically add creator as organizer
    await this.prisma.hackathonParticipant.create({
      data: {
        hackathonId: hackathon.id,
        userId,
        role: 'ORGANIZER',
      },
    });

    return hackathon;
  }

  /**
   * Get all hackathons (with optional status filter)
   */
  async listHackathons(status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.hackathon.findMany({
      where,
      include: {
        _count: {
          select: {
            teams: true,
            participants: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get hackathon by ID
   */
  async getHackathon(id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            _count: {
              select: { participants: true },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            teams: true,
            participants: true,
          },
        },
      },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    return hackathon;
  }

  /**
   * Update hackathon
   */
  async updateHackathon(id: string, userId: string, dto: UpdateHackathonDto) {
    // Check if user is organizer
    await this.verifyOrganizer(id, userId);

    // Validate dates if provided
    if (dto.startDate || dto.endDate) {
      const hackathon = await this.prisma.hackathon.findUnique({ where: { id } });
      if (!hackathon) throw new NotFoundException('Hackathon not found');

      const startDate = dto.startDate ? new Date(dto.startDate) : hackathon.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : hackathon.endDate;

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    return this.prisma.hackathon.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      },
    });
  }

  /**
   * Update hackathon status
   */
  async updateHackathonStatus(id: string, userId: string, status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') {
    await this.verifyOrganizer(id, userId);

    return this.prisma.hackathon.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete hackathon
   */
  async deleteHackathon(id: string, userId: string) {
    await this.verifyOrganizer(id, userId);

    await this.prisma.hackathon.delete({
      where: { id },
    });

    return { message: 'Hackathon deleted successfully' };
  }

  /**
   * Create a team
   */
  async createTeam(hackathonId: string, userId: string, dto: CreateTeamDto) {
    // Verify hackathon exists and user is organizer
    await this.verifyOrganizer(hackathonId, userId);

    return this.prisma.team.create({
      data: {
        hackathonId,
        name: dto.name,
        ...(dto.repositoryId !== undefined && { repositoryId: dto.repositoryId }),
      },
    });
  }

  /**
   * List teams in a hackathon
   */
  async listTeams(hackathonId: string) {
    return this.prisma.team.findMany({
      where: { hackathonId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            participants: true,
            commitAnalyses: true,
            anomalyEvents: true,
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });
  }

  /**
   * Get team by ID
   */
  async getTeam(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        hackathon: true,
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
          },
        },
        progressSnapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            commitAnalyses: true,
            anomalyEvents: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  /**
   * Update team
   */
  async updateTeam(id: string, userId: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    await this.verifyOrganizer(team.hackathonId, userId);

    return this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.repositoryId !== undefined && { repositoryId: dto.repositoryId }),
      },
    });
  }

  /**
   * Delete team
   */
  async deleteTeam(id: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    await this.verifyOrganizer(team.hackathonId, userId);

    await this.prisma.team.delete({ where: { id } });

    return { message: 'Team deleted successfully' };
  }

  /**
   * Add participant to hackathon
   */
  async addParticipant(hackathonId: string, organizerId: string, dto: AddParticipantDto) {
    await this.verifyOrganizer(hackathonId, organizerId);

    // Check if user already participating
    const existing = await this.prisma.hackathonParticipant.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId,
          userId: dto.userId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already a participant');
    }

    return this.prisma.hackathonParticipant.create({
      data: {
        hackathonId,
        userId: dto.userId,
        ...(dto.teamId !== undefined && { teamId: dto.teamId }),
        role: dto.role || 'PARTICIPANT',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  /**
   * Remove participant from hackathon
   */
  async removeParticipant(hackathonId: string, participantId: string, organizerId: string) {
    await this.verifyOrganizer(hackathonId, organizerId);

    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant || participant.hackathonId !== hackathonId) {
      throw new NotFoundException('Participant not found');
    }

    await this.prisma.hackathonParticipant.delete({
      where: { id: participantId },
    });

    return { message: 'Participant removed successfully' };
  }

  /**
   * Assign participant to team
   */
  async assignToTeam(participantId: string, teamId: string, organizerId: string) {
    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    await this.verifyOrganizer(participant.hackathonId, organizerId);

    // Verify team belongs to same hackathon
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.hackathonId !== participant.hackathonId) {
      throw new BadRequestException('Team does not belong to this hackathon');
    }

    return this.prisma.hackathonParticipant.update({
      where: { id: participantId },
      data: { teamId },
    });
  }

  /**
   * Verify user is organizer of hackathon
   */
  private async verifyOrganizer(hackathonId: string, userId: string) {
    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId,
          userId,
        },
      },
    });

    if (!participant || participant.role !== 'ORGANIZER') {
      throw new ForbiddenException('Only organizers can perform this action');
    }
  }
}
