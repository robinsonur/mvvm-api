import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTaskDto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para ver esta tarea');
    }

    return task;
  }

  async update(id: string, userId: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.findOne(id, userId);

    return this.prisma.task.update({
      where: { id: task.id },
      data: updateTaskDto,
    });
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id, userId);

    await this.prisma.task.delete({
      where: { id: task.id },
    });

    return { message: 'Tarea eliminada exitosamente' };
  }

  // Método extra para obtener múltiples tareas por IDs (útil para paralelización)
  async findMany(ids: string[], userId: string) {
    return this.prisma.task.findMany({
      where: {
        id: { in: ids },
        userId,
      },
    });
  }
}
