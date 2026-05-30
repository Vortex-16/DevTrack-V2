import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { HackathonService } from './services/hackathon.service';
import { HackathonScoringService } from './scoring/hackathon-scoring.service';
import {
  CreateHackathonDto,
  UpdateHackathonDto,
  CreateTeamDto,
  UpdateTeamDto,
  AddParticipantDto,
} from './dto/hackathon.dto';
import { ScoreHackathonTeamDto } from './dto/scoring.dto';

@Controller({ path: 'hackathons', version: '1' })
@ApiTags('hackathons')
@ApiBearerAuth('JWT')
@UseGuards(ClerkAuthGuard)
export class HackathonController {
  constructor(
    private readonly hackathonService: HackathonService,
    private readonly hackathonScoringService: HackathonScoringService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // HACKATHON CRUD
  // ─────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new hackathon' })
  @ApiResponse({ status: 201, description: 'Hackathon created successfully' })
  createHackathon(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHackathonDto,
  ) {
    return this.hackathonService.createHackathon(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all hackathons' })
  @ApiResponse({ status: 200, description: 'Hackathons retrieved' })
  listHackathons(@Query('status') status?: string) {
    return this.hackathonService.listHackathons(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hackathon details' })
  @ApiResponse({ status: 200, description: 'Hackathon retrieved' })
  @ApiResponse({ status: 404, description: 'Hackathon not found' })
  getHackathon(@Param('id') id: string) {
    return this.hackathonService.getHackathon(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update hackathon (organizer only)' })
  updateHackathon(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHackathonDto,
  ) {
    return this.hackathonService.updateHackathon(id, user.id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update hackathon status (organizer only)' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('status') status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  ) {
    return this.hackathonService.updateHackathonStatus(id, user.id, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete hackathon (organizer only)' })
  deleteHackathon(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hackathonService.deleteHackathon(id, user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // TEAM MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  @Post(':id/teams')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a team (organizer only)' })
  createTeam(
    @Param('id') hackathonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamDto,
  ) {
    return this.hackathonService.createTeam(hackathonId, user.id, dto);
  }

  @Get(':id/teams')
  @ApiOperation({ summary: 'List teams in hackathon' })
  listTeams(@Param('id') hackathonId: string) {
    return this.hackathonService.listTeams(hackathonId);
  }

  @Get('teams/:teamId')
  @ApiOperation({ summary: 'Get team details' })
  getTeam(@Param('teamId') teamId: string) {
    return this.hackathonService.getTeam(teamId);
  }

  @Patch('teams/:teamId')
  @ApiOperation({ summary: 'Update team (organizer only)' })
  updateTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.hackathonService.updateTeam(teamId, user.id, dto);
  }

  @Delete('teams/:teamId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete team (organizer only)' })
  deleteTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hackathonService.deleteTeam(teamId, user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // SCORING PIPELINE
  // ─────────────────────────────────────────────────────────────

  @Post(':id/teams/:teamId/score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Score a team commit batch' })
  @ApiResponse({ status: 200, description: 'Hackathon scoring completed' })
  scoreTeam(
    @Param('id') hackathonId: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScoreHackathonTeamDto,
  ) {
    return this.hackathonScoringService.scoreTeam(hackathonId, teamId, user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // PARTICIPANT MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  @Post(':id/participants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add participant to hackathon (organizer only)' })
  addParticipant(
    @Param('id') hackathonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddParticipantDto,
  ) {
    return this.hackathonService.addParticipant(hackathonId, user.id, dto);
  }

  @Delete(':id/participants/:participantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove participant (organizer only)' })
  removeParticipant(
    @Param('id') hackathonId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hackathonService.removeParticipant(hackathonId, participantId, user.id);
  }

  @Patch('participants/:participantId/team')
  @ApiOperation({ summary: 'Assign participant to team (organizer only)' })
  assignToTeam(
    @Param('participantId') participantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('teamId') teamId: string,
  ) {
    return this.hackathonService.assignToTeam(participantId, teamId, user.id);
  }
}
