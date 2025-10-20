import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * POST /tasks - Crear nueva tarea
   */
  @Post()
  create(@Request() req, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(req.user.userId, createTaskDto);
  }

  /**
   * GET /tasks - Listar tareas
   * Query params:
   *   - deleted=true: incluir tareas eliminadas
   *   - deleted=only: solo tareas eliminadas
   */
  @Get()
  findAll(
    @Request() req,
    @Query('deleted') deleted?: string,
  ) {
    if (deleted === 'only') {
      return this.tasksService.findDeleted(req.user.userId);
    }
    const includeDeleted = deleted === 'true';
    return this.tasksService.findAll(req.user.userId, includeDeleted);
  }

  /**
   * GET /tasks/:id - Obtener una tarea específica
   */
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.tasksService.findOne(id, req.user.userId);
  }

  /**
   * PUT /tasks/:id - Actualizar tarea completa
   * (Reemplaza todos los campos)
   */
  @Put(':id')
  replace(
    @Request() req,
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, req.user.userId, updateTaskDto);
  }

  /**
   * PATCH /tasks/:id - Actualizar tarea parcialmente
   * Body puede incluir:
   *   - title, description, imageUrl, completed: actualiza esos campos
   *   - restore: true: restaura una tarea eliminada
   */
  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpdateTaskDto & { restore?: boolean },
  ) {
    // Si viene restore: true, restaurar la tarea
    if (body.restore) {
      return this.tasksService.restore(id, req.user.userId);
    }

    // Si no, actualización normal
    const { restore, ...updateTaskDto } = body;
    return this.tasksService.update(id, req.user.userId, updateTaskDto);
  }

  /**
   * DELETE /tasks/:id - Eliminar tarea (soft delete)
   * Query params:
   *   - permanent=true: eliminar permanentemente
   */
  @Delete(':id')
  remove(
    @Request() req,
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    if (permanent === 'true') {
      return this.tasksService.permanentDelete(id, req.user.userId);
    }
    return this.tasksService.remove(id, req.user.userId);
  }
}
