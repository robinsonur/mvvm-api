import { PrismaClient } from '../generated/prisma';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Limpiar datos existentes
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Usuario 1: Con varias tareas
  const hashedPassword1 = await bcrypt.hash('password123', 10);
  const user1 = await prisma.user.create({
    data: {
      email: 'robinson@test.com',
      password: hashedPassword1,
    },
  });

  console.log('✅ Created user 1:', user1.email);

  // Crear tareas para usuario 1
  const tasksUser1 = await prisma.task.createMany({
    data: [
      {
        title: 'Completar proyecto de algoritmos',
        description: 'Implementar app Android con NestJS backend',
        imageUrl: 'https://picsum.photos/400/300?random=1',
        completed: false,
        userId: user1.id,
      },
      {
        title: 'Estudiar para examen de programación',
        description: 'Repasar concurrencia y coroutines en Kotlin',
        imageUrl: 'https://picsum.photos/400/300?random=2',
        completed: true,
        userId: user1.id,
      },
      {
        title: 'Hacer ejercicios de MVVM',
        description: 'Practicar arquitectura MVVM con ejemplos',
        imageUrl: 'https://picsum.photos/400/300?random=3',
        completed: false,
        userId: user1.id,
      },
      {
        title: 'Documentar API REST',
        description: 'Crear documentación con Swagger para el proyecto',
        imageUrl: 'https://picsum.photos/400/300?random=4',
        completed: true,
        userId: user1.id,
      },
      {
        title: 'Implementar tests E2E',
        description: 'Completar suite de tests para el backend',
        imageUrl: 'https://picsum.photos/400/300?random=5',
        completed: true,
        userId: user1.id,
      },
      {
        title: 'Optimizar base de datos',
        description: 'Agregar índices y optimizar queries',
        imageUrl: null, // Tarea sin imagen
        completed: false,
        userId: user1.id,
      },
      {
        title: 'Preparar presentación',
        description: 'Crear slides para demostrar el proyecto',
        imageUrl: 'https://picsum.photos/400/300?random=6',
        completed: false,
        userId: user1.id,
      },
    ],
  });

  console.log(`✅ Created ${tasksUser1.count} tasks for user 1`);

  // Usuario 2: Sin tareas
  const hashedPassword2 = await bcrypt.hash('password456', 10);
  const user2 = await prisma.user.create({
    data: {
      email: 'usuario2@test.com',
      password: hashedPassword2,
    },
  });

  console.log('✅ Created user 2:', user2.email);
  console.log('ℹ️  User 2 has 0 tasks (empty state)');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('-----------------------------------');
  console.log('User 1 (with tasks):');
  console.log('  Email: robinson@test.com');
  console.log('  Password: password123');
  console.log('  Tasks: 7 tasks (3 completed, 4 pending)');
  console.log('\nUser 2 (no tasks):');
  console.log('  Email: usuario2@test.com');
  console.log('  Password: password456');
  console.log('  Tasks: 0 tasks');
  console.log('-----------------------------------\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

