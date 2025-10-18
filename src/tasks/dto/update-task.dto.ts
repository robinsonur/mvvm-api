import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
