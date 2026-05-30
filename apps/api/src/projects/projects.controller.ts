import { Controller, Get, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ProjectsService, CreateProjectDto, CreateTaskDto, UpdateTaskStatusDto } from './projects.service';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { RequireOwnership } from '../common/decorators/require-ownership.decorator';

@Controller({ path: 'projects', version: '1' })
@UseGuards(ClerkAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listProjects(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(user.id, dto);
  }

  @Post(':id/tasks')
  @UseGuards(OwnershipGuard)
  @RequireOwnership('project')
  @HttpCode(HttpStatus.CREATED)
  addTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.projectsService.addTask(user.id, projectId, dto);
  }

  @Patch('tasks/:taskId/status')
  @UseGuards(OwnershipGuard)
  @RequireOwnership('task', 'taskId')
  updateTaskStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.projectsService.updateTaskStatus(user.id, taskId, dto);
  }

  @Patch(':id/archive')
  @UseGuards(OwnershipGuard)
  @RequireOwnership('project')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') projectId: string) {
    return this.projectsService.archiveProject(user.id, projectId);
  }
}
