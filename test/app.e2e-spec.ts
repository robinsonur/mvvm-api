import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E Test Suite for Backend API
 * Tests authentication, CRUD operations, security, and concurrent request handling
 */
describe('Backend API End-to-End Tests', () => {
  let application: INestApplication;
  let accessToken: string;
  let authenticatedUserId: string;
  let createdTaskIds: string[] = [];

  // Test data constants
  const TEST_ENDPOINTS = {
    AUTH_SIGN_UP: '/auth/sign-up',
    AUTH_SIGN_IN: '/auth/sign-in',
    TASKS: '/tasks',
    TASK_BY_ID: (id: string) => `/tasks/${id}`,
  } as const;

  const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
  } as const;

  const ERROR_MESSAGES = {
    USER_EXISTS: 'already exists',
  } as const;

  // Test data factories
  const createTestUser = () => ({
    email: `test.user.${Date.now()}@example.com`,
    password: 'SecureP@ssw0rd123',
  });

  const createTestTask = (overrides = {}) => ({
    title: 'Default Test Task',
    description: 'Test task description',
    completed: false,
    ...overrides,
  });

  // Helper functions for API requests
  const makeAuthenticatedRequest = (
    method: 'get' | 'post' | 'patch' | 'delete',
  ) => {
    return (endpoint: string) => {
      return request(application.getHttpServer())
        [method](endpoint)
        .set('Authorization', `Bearer ${accessToken}`);
    };
  };

  const apiClient = {
    get: makeAuthenticatedRequest('get'),
    post: makeAuthenticatedRequest('post'),
    patch: makeAuthenticatedRequest('patch'),
    delete: makeAuthenticatedRequest('delete'),
  };

  /**
   * Setup test environment before all tests
   */
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    application = moduleFixture.createNestApplication();

    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    application.enableCors();

    await application.init();

    // Wait a bit for the database connection to stabilize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  /**
   * Cleanup after all tests
   */
  afterAll(async () => {
    if (application) {
      await application.close();
    }
    // Give time for connections to close properly
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  /**
   * Reset test data after each test suite
   */
  afterEach(() => {
    createdTaskIds = [];
  });

  /**
   * Authentication Module Tests
   */
  describe('Authentication Module', () => {
    let testUser: ReturnType<typeof createTestUser>;

    beforeEach(() => {
      testUser = createTestUser();
    });

    describe('User Registration (POST /auth/sign-up)', () => {
      it('should successfully register a new user with valid credentials', async () => {
        const response = await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(testUser);

        // Log the response for debugging
        if (response.status !== HTTP_STATUS.CREATED) {
          console.error('Registration failed with status:', response.status);
          console.error('Response body:', JSON.stringify(response.body, null, 2));
        }

        expect(response.status).toBe(HTTP_STATUS.CREATED);
        expect(response.body).toHaveProperty('access_token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.email).toBe(testUser.email);
        expect(typeof response.body.access_token).toBe('string');

        accessToken = response.body.access_token;
        authenticatedUserId = response.body.user.id;
      });

      it('should reject registration with duplicate email', async () => {
        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(testUser)
          .expect(HTTP_STATUS.CREATED);

        const duplicateResponse = await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(testUser)
          .expect(HTTP_STATUS.CONFLICT);

        expect(duplicateResponse.body.message).toContain(
          ERROR_MESSAGES.USER_EXISTS,
        );
      });

      it('should reject registration with invalid email format', async () => {
        const invalidUser = {
          email: 'invalid-email-format',
          password: 'ValidPassword123',
        };

        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(invalidUser)
          .expect(HTTP_STATUS.BAD_REQUEST);
      });

      it('should reject registration with password shorter than minimum length', async () => {
        const shortPasswordUser = {
          email: createTestUser().email,
          password: '12345',
        };

        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(shortPasswordUser)
          .expect(HTTP_STATUS.BAD_REQUEST);
      });

      it('should reject registration with missing required fields', async () => {
        const incompleteUser = { email: 'test@example.com' };

        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(incompleteUser)
          .expect(HTTP_STATUS.BAD_REQUEST);
      });
    });

    describe('User Authentication (POST /auth/sign-in)', () => {
      beforeEach(async () => {
        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
          .send(testUser);
      });

      it('should successfully authenticate with correct credentials', async () => {
        const response = await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_IN)
          .send(testUser)
          .expect(HTTP_STATUS.CREATED);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body.user.email).toBe(testUser.email);
      });

      it('should reject authentication with incorrect password', async () => {
        const invalidCredentials = {
          email: testUser.email,
          password: 'WrongPassword123',
        };

        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_IN)
          .send(invalidCredentials)
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });

      it('should reject authentication with non-existent email', async () => {
        const nonExistentUser = {
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        };

        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.AUTH_SIGN_IN)
          .send(nonExistentUser)
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });
    });
  });

  /**
   * Tasks CRUD Module Tests
   */
  describe('Tasks CRUD Operations', () => {
    beforeAll(async () => {
      const testUser = createTestUser();
      const response = await request(application.getHttpServer())
        .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
        .send(testUser)
        .expect(HTTP_STATUS.CREATED);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');

      accessToken = response.body.access_token;
      authenticatedUserId = response.body.user.id;
    });

    describe('Create Task (POST /tasks)', () => {
      it('should successfully create a task with valid data', async () => {
        const newTask = createTestTask({
          title: 'Complete project documentation',
          description: 'Write comprehensive API documentation',
        });

        const response = await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(newTask)
          .expect(HTTP_STATUS.CREATED);

        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe(newTask.title);
        expect(response.body.description).toBe(newTask.description);
        expect(response.body.completed).toBe(false);

        createdTaskIds.push(response.body.id);
      });

      it('should successfully create multiple tasks sequentially', async () => {
        const tasksToCreate = [
          createTestTask({ title: 'First Task', description: 'Description 1' }),
          createTestTask({
            title: 'Second Task',
            description: 'Description 2',
          }),
          createTestTask({
            title: 'Third Task',
            description: 'Description 3',
            completed: true,
          }),
        ];

        for (const taskData of tasksToCreate) {
          const response = await apiClient
            .post(TEST_ENDPOINTS.TASKS)
            .send(taskData)
            .expect(HTTP_STATUS.CREATED);

          createdTaskIds.push(response.body.id);
        }

        expect(createdTaskIds).toHaveLength(tasksToCreate.length);
      });

      it('should reject task creation without authentication token', async () => {
        const newTask = createTestTask();

        await request(application.getHttpServer())
          .post(TEST_ENDPOINTS.TASKS)
          .send(newTask)
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });

      it('should reject task creation with empty title', async () => {
        const invalidTask = createTestTask({ title: '' });

        await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(invalidTask)
          .expect(HTTP_STATUS.BAD_REQUEST);
      });

      it('should reject task creation with invalid data types', async () => {
        const invalidTask = {
          title: 'Valid Title',
          completed: 'not-a-boolean',
        };

        await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(invalidTask)
          .expect(HTTP_STATUS.BAD_REQUEST);
      });

      it('should reject task creation with disallowed extra fields', async () => {
        const taskWithExtraFields = {
          ...createTestTask(),
          unauthorizedField: 'should not be accepted',
        };

        await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(taskWithExtraFields)
          .expect(HTTP_STATUS.BAD_REQUEST);
      });
    });

    describe('Read Tasks (GET /tasks)', () => {
      const MINIMUM_EXPECTED_TASKS = 4;

      beforeAll(async () => {
        const tasksToCreate = Array.from(
          { length: MINIMUM_EXPECTED_TASKS },
          (_, index) => createTestTask({ title: `Task ${index + 1}` }),
        );

        for (const taskData of tasksToCreate) {
          const response = await apiClient
            .post(TEST_ENDPOINTS.TASKS)
            .send(taskData)
            .expect(HTTP_STATUS.CREATED);
          createdTaskIds.push(response.body.id);
        }
      });

      it('should retrieve all tasks for authenticated user', async () => {
        const response = await apiClient
          .get(TEST_ENDPOINTS.TASKS)
          .expect(HTTP_STATUS.OK);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(
          MINIMUM_EXPECTED_TASKS,
        );
        expect(
          response.body.every(
            (task: any) => task.userId === authenticatedUserId,
          ),
        ).toBe(true);
      });

      it('should reject task retrieval without authentication', async () => {
        await request(application.getHttpServer())
          .get(TEST_ENDPOINTS.TASKS)
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });
    });

    describe('Read Single Task (GET /tasks/:id)', () => {
      let existingTaskId: string;

      beforeAll(async () => {
        const response = await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(createTestTask({ title: 'Task for retrieval test' }));

        existingTaskId = response.body.id;
        createdTaskIds.push(existingTaskId);
      });

      it('should retrieve a specific task by ID', async () => {
        const response = await apiClient
          .get(TEST_ENDPOINTS.TASK_BY_ID(existingTaskId))
          .expect(HTTP_STATUS.OK);

        expect(response.body.id).toBe(existingTaskId);
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('description');
        expect(response.body).toHaveProperty('completed');
      });

      it('should return 404 for non-existent task ID', async () => {
        const nonExistentId = 'non-existent-task-id-12345';

        await apiClient
          .get(TEST_ENDPOINTS.TASK_BY_ID(nonExistentId))
          .expect(HTTP_STATUS.NOT_FOUND);
      });
    });

    describe('Update Task (PATCH /tasks/:id)', () => {
      let taskToUpdate: string;

      beforeEach(async () => {
        const response = await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(createTestTask({ title: 'Task to update' }));

        taskToUpdate = response.body.id;
        createdTaskIds.push(taskToUpdate);
      });

      it('should successfully update task with complete data', async () => {
        const updates = {
          title: 'Updated Task Title',
          description: 'Updated description',
          completed: true,
        };

        const response = await apiClient
          .patch(TEST_ENDPOINTS.TASK_BY_ID(taskToUpdate))
          .send(updates)
          .expect(HTTP_STATUS.OK);

        expect(response.body.title).toBe(updates.title);
        expect(response.body.description).toBe(updates.description);
        expect(response.body.completed).toBe(updates.completed);
      });

      it('should successfully update only completed status', async () => {
        const partialUpdate = { completed: true };

        const response = await apiClient
          .patch(TEST_ENDPOINTS.TASK_BY_ID(taskToUpdate))
          .send(partialUpdate)
          .expect(HTTP_STATUS.OK);

        expect(response.body.completed).toBe(true);
      });

      it('should return 404 when updating non-existent task', async () => {
        const nonExistentId = 'non-existent-task-id';
        const updates = { completed: true };

        await apiClient
          .patch(TEST_ENDPOINTS.TASK_BY_ID(nonExistentId))
          .send(updates)
          .expect(HTTP_STATUS.NOT_FOUND);
      });
    });

    describe('Delete Task (DELETE /tasks/:id)', () => {
      let taskToDelete: string;

      beforeEach(async () => {
        const response = await apiClient
          .post(TEST_ENDPOINTS.TASKS)
          .send(createTestTask({ title: 'Task to delete' }));

        taskToDelete = response.body.id;
      });

      it('should successfully delete an existing task', async () => {
        const response = await apiClient
          .delete(TEST_ENDPOINTS.TASK_BY_ID(taskToDelete))
          .expect(HTTP_STATUS.OK);

        expect(response.body).toHaveProperty('message');
      });

      it('should return 404 when deleting already deleted task', async () => {
        await apiClient
          .delete(TEST_ENDPOINTS.TASK_BY_ID(taskToDelete))
          .expect(HTTP_STATUS.OK);

        await apiClient
          .delete(TEST_ENDPOINTS.TASK_BY_ID(taskToDelete))
          .expect(HTTP_STATUS.NOT_FOUND);
      });

      it('should return 404 when deleting non-existent task', async () => {
        const nonExistentId = 'non-existent-task-id';

        await apiClient
          .delete(TEST_ENDPOINTS.TASK_BY_ID(nonExistentId))
          .expect(HTTP_STATUS.NOT_FOUND);
      });
    });
  });

  /**
   * Concurrency and Performance Tests
   */
  describe('Concurrent Request Handling', () => {
    const PERFORMANCE_TEST_TASK_COUNT = 5;
    const CONCURRENT_REQUEST_COUNT = 10;
    let performanceTestTaskIds: string[] = [];

    beforeAll(async () => {
      const testUser = createTestUser();
      const authResponse = await request(application.getHttpServer())
        .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
        .send(testUser)
        .expect(HTTP_STATUS.CREATED);

      expect(authResponse.body).toHaveProperty('access_token');
      accessToken = authResponse.body.access_token;

      const taskCreationPromises = Array.from(
        { length: PERFORMANCE_TEST_TASK_COUNT },
        (_, index) =>
          apiClient
            .post(TEST_ENDPOINTS.TASKS)
            .send(
              createTestTask({ title: `Performance Test Task ${index + 1}` }),
            )
            .expect(HTTP_STATUS.CREATED),
      );

      const responses = await Promise.all(taskCreationPromises);
      performanceTestTaskIds = responses.map((res) => res.body.id);
    });

    it('should demonstrate performance improvement with parallel requests', async () => {
      // Sequential execution
      const sequentialStartTime = Date.now();
      for (const taskId of performanceTestTaskIds) {
        await apiClient.get(TEST_ENDPOINTS.TASK_BY_ID(taskId));
      }
      const sequentialDuration = Date.now() - sequentialStartTime;

      // Parallel execution
      const parallelStartTime = Date.now();
      await Promise.all(
        performanceTestTaskIds.map((taskId) =>
          apiClient.get(TEST_ENDPOINTS.TASK_BY_ID(taskId)),
        ),
      );
      const parallelDuration = Date.now() - parallelStartTime;

      // Performance assertions
      expect(parallelDuration).toBeLessThanOrEqual(sequentialDuration);

      const performanceImprovement =
        ((sequentialDuration - parallelDuration) / sequentialDuration) * 100;
      const speedRatio = sequentialDuration / parallelDuration;

      expect(performanceImprovement).toBeGreaterThan(0);
      expect(speedRatio).toBeGreaterThan(1);
    });

    it('should handle multiple concurrent requests successfully', async () => {
      const startTime = Date.now();

      const concurrentRequests = Array.from(
        { length: CONCURRENT_REQUEST_COUNT },
        () => apiClient.get(TEST_ENDPOINTS.TASKS),
      );

      const responses = await Promise.all(concurrentRequests);
      const duration = Date.now() - startTime;

      const allSuccessful = responses.every(
        (response) => response.status === HTTP_STATUS.OK,
      );
      const averageResponseTime = duration / CONCURRENT_REQUEST_COUNT;

      expect(allSuccessful).toBe(true);
      expect(averageResponseTime).toBeLessThan(1000); // Should be less than 1 second per request
    });
  });

  /**
   * Security and Authorization Tests
   */
  describe('Security and Authorization', () => {
    beforeAll(async () => {
      const testUser = createTestUser();
      const response = await request(application.getHttpServer())
        .post(TEST_ENDPOINTS.AUTH_SIGN_UP)
        .send(testUser)
        .expect(HTTP_STATUS.CREATED);

      expect(response.body).toHaveProperty('access_token');
      accessToken = response.body.access_token;
    });

    it('should reject requests with invalid authentication token', async () => {
      const invalidToken = 'invalid.jwt.token.12345';

      await request(application.getHttpServer())
        .get(TEST_ENDPOINTS.TASKS)
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should reject requests without Authorization header', async () => {
      await request(application.getHttpServer())
        .get(TEST_ENDPOINTS.TASKS)
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should reject requests with malformed Authorization header', async () => {
      await request(application.getHttpServer())
        .get(TEST_ENDPOINTS.TASKS)
        .set('Authorization', 'InvalidFormat token123')
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should enforce DTO validation and reject extra fields', async () => {
      const taskWithUnauthorizedFields = {
        title: 'Valid Task',
        description: 'Valid description',
        unauthorizedField: 'This should be rejected',
        anotherBadField: 123,
      };

      await apiClient
        .post(TEST_ENDPOINTS.TASKS)
        .send(taskWithUnauthorizedFields)
        .expect(HTTP_STATUS.BAD_REQUEST);
    });
  });
});
