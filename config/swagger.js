// Swagger Configuration for API Documentation

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hyphen Gym Management System API',
      version: '1.0.0',
      description: 'Complete REST API documentation for Hyphen Gym Management System',
      contact: {
        name: 'Hyphen Support',
        email: 'support@hyphen.com',
        url: 'https://hyphen.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5001/api',
        description: 'Local Development Server'
      },
      {
        url: 'https://your-production-url.com/api',
        description: 'Production Server'
      }
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Members', description: 'Member management endpoints' },
      { name: 'Packages', description: 'Package management endpoints' },
      { name: 'Appointments', description: 'Appointment/Session management' },
      { name: 'Payments', description: 'Payment processing' },
      { name: 'Trainers', description: 'Trainer management' },
      { name: 'Check-in', description: 'Gym check-in/out' },
      { name: 'Profile', description: 'User profile management' },
      { name: 'Dashboard', description: 'Dashboard statistics' },
      { name: 'Notifications', description: 'Notification system' },
      { name: 'Calendar', description: 'Calendar and scheduling' },
      { name: 'Classes', description: 'Class management' },
      { name: 'Support', description: 'Support tickets' },
      { name: 'Admin', description: 'Admin operations' },
      { name: 'Equipment', description: 'Equipment management' },
      { name: 'System', description: 'System health and info' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password', 'role'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique user identifier'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            role: {
              type: 'string',
              enum: ['admin', 'member', 'trainer', 'staff'],
              description: 'User role'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password (hashed)'
            },
            assignedTrainer: {
              type: 'string',
              description: 'Assigned trainer ID (for members)'
            }
          }
        },
        Package: {
          type: 'object',
          required: ['name', 'sessionsTotal', 'validityDays', 'price'],
          properties: {
            _id: {
              type: 'string',
              description: 'Package ID'
            },
            name: {
              type: 'string',
              description: 'Package name'
            },
            sessionsTotal: {
              type: 'number',
              description: 'Total sessions in package'
            },
            validityDays: {
              type: 'number',
              description: 'Package validity in days'
            },
            price: {
              type: 'number',
              description: 'Package price'
            }
          }
        },
        Appointment: {
          type: 'object',
          required: ['client', 'staff', 'startTime', 'duration'],
          properties: {
            _id: {
              type: 'string',
              description: 'Appointment ID'
            },
            client: {
              type: 'string',
              description: 'Member/Client ID'
            },
            staff: {
              type: 'string',
              description: 'Trainer/Staff ID'
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              description: 'Appointment start time'
            },
            duration: {
              type: 'number',
              description: 'Duration in minutes'
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
              description: 'Appointment status'
            },
            location: {
              type: 'string',
              description: 'Location/venue'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object'
            }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Authentication required'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Validation error',
                details: ['field1 is required', 'field2 must be valid email']
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './routes/*.js',
    './routes/**/*.js',
    './server/routes/*.js',
    './server/routes/**/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

