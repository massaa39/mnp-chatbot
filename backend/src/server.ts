import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { database } from './config/database';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { securityMiddleware } from './middleware/security';
import { validationMiddleware } from './middleware/validation';

// Import routes
import apiRoutes from './routes/index';

/**
 * MNP Chatbot Backend Server
 * Express.js server with TypeScript, PostgreSQL, Redis, OpenAI integration
 */
class Server {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer | null = null;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001', 10);
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeDatabase();
  }

  /**
   * Initialize middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.openai.com"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use(rateLimitMiddleware);

    // Security headers and validation
    this.app.use(securityMiddleware);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });

    // Add request ID for tracing
    this.app.use((req, res, next) => {
      req.requestId = require('crypto').randomUUID();
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        requestId: req.requestId
      });
    });

    // API routes
    this.app.use('/api/v1', apiRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'MNP Chatbot API Server',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        documentation: '/api-docs',
        health: '/health'
      });
    });

    // API documentation (if enabled)
    if (process.env.SWAGGER_ENABLED === 'true') {
      this.setupSwagger();
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested endpoint was not found',
          path: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });
    });
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    this.app.use(errorHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown('SIGTERM');
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await database.connect();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      process.exit(1);
    }
  }

  /**
   * Setup Swagger documentation
   */
  private setupSwagger(): void {
    try {
      const swaggerUi = require('swagger-ui-express');
      const yaml = require('yamljs');
      const swaggerDocument = yaml.load(path.join(__dirname, '../docs/api/openapi.yaml'));
      
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'MNP Chatbot API Documentation'
      }));
      
      logger.info('Swagger documentation available at /api-docs');
    } catch (error) {
      logger.warn('Failed to setup Swagger documentation', { error });
    }
  }

  /**
   * Initialize WebSocket server
   */
  private initializeWebSocket(): void {
    if (process.env.WEBSOCKET_ENABLED !== 'true') {
      return;
    }

    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      socket.on('join_session', (sessionToken) => {
        socket.join(`session_${sessionToken}`);
        logger.info('Client joined session', { socketId: socket.id, sessionToken });
      });

      socket.on('leave_session', (sessionToken) => {
        socket.leave(`session_${sessionToken}`);
        logger.info('Client left session', { socketId: socket.id, sessionToken });
      });

      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', { socketId: socket.id, reason });
      });
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      this.server = createServer(this.app);
      
      // Initialize WebSocket if enabled
      this.initializeWebSocket();

      // Start listening
      this.server.listen(this.port, () => {
        logger.info('Server started successfully', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          cors: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
          websocket: process.env.WEBSOCKET_ENABLED === 'true',
          swagger: process.env.SWAGGER_ENABLED === 'true'
        });

        console.log(`
🚀 MNP Chatbot Server is running!

📍 Server URL: http://localhost:${this.port}
🔗 API Base: http://localhost:${this.port}/api/v1
💊 Health Check: http://localhost:${this.port}/health
${process.env.SWAGGER_ENABLED === 'true' ? `📚 API Docs: http://localhost:${this.port}/api-docs` : ''}
${process.env.WEBSOCKET_ENABLED === 'true' ? `🔌 WebSocket: ws://localhost:${this.port}` : ''}

Environment: ${process.env.NODE_ENV || 'development'}
        `);
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is already in use`);
          process.exit(1);
        } else {
          logger.error('Server error', { error });
          process.exit(1);
        }
      });

    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    // Stop accepting new connections
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Close WebSocket connections
    if (this.io) {
      this.io.close(() => {
        logger.info('WebSocket server closed');
      });
    }

    // Close database connections
    try {
      await database.disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', { error });
    }

    // Exit process
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    process.exit(0);
  }

  /**
   * Get Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get WebSocket server instance
   */
  public getWebSocketServer(): SocketIOServer | null {
    return this.io;
  }
}

// Create and start server
const server = new Server();

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export default server;
export { Server };