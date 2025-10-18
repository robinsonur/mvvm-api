import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'test') {
      const models = Reflect.ownKeys(this).filter(
        (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
      );

      return Promise.all(
        models.map((modelKey) => {
          const modelName = modelKey as string;
          if (this[modelName] && typeof this[modelName].deleteMany === 'function') {
            return this[modelName].deleteMany();
          }
          return Promise.resolve();
        }),
      );
    }
  }
}
