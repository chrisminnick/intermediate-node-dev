const Joi = require('joi');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Initialize DOMPurify with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window);

class ValidationService {
  constructor() {
    this.schemas = {
      message: Joi.object({
        content: Joi.string()
          .trim()
          .min(1)
          .max(parseInt(process.env.MAX_MESSAGE_LENGTH) || 500)
          .required()
          .messages({
            'string.empty': 'Message cannot be empty',
            'string.min': 'Message must be at least 1 character',
            'string.max': `Message cannot exceed ${
              process.env.MAX_MESSAGE_LENGTH || 500
            } characters`,
          }),
        roomId: Joi.string()
          .trim()
          .alphanum()
          .min(1)
          .max(50)
          .required()
          .messages({
            'string.alphanum':
              'Room ID must contain only alphanumeric characters',
            'string.empty': 'Room ID is required',
          }),
        type: Joi.string()
          .valid('text', 'image', 'file', 'system')
          .default('text'),
      }),

      privateMessage: Joi.object({
        content: Joi.string()
          .trim()
          .min(1)
          .max(parseInt(process.env.MAX_MESSAGE_LENGTH) || 500)
          .required(),
        recipientId: Joi.string().trim().min(1).max(100).required().messages({
          'string.empty': 'Recipient ID is required',
        }),
        type: Joi.string().valid('text', 'image', 'file').default('text'),
      }),

      joinRoom: Joi.object({
        roomId: Joi.string()
          .trim()
          .alphanum()
          .min(1)
          .max(50)
          .required()
          .messages({
            'string.alphanum':
              'Room ID must contain only alphanumeric characters',
          }),
        password: Joi.string().trim().min(4).max(100).optional().allow(''),
      }),

      createRoom: Joi.object({
        name: Joi.string().trim().min(1).max(100).required().messages({
          'string.empty': 'Room name is required',
          'string.max': 'Room name cannot exceed 100 characters',
        }),
        description: Joi.string().trim().max(500).optional().allow(''),
        isPrivate: Joi.boolean().default(false),
        password: Joi.string()
          .trim()
          .min(4)
          .max(100)
          .when('isPrivate', {
            is: true,
            then: Joi.required(),
            otherwise: Joi.optional().allow(''),
          }),
        maxUsers: Joi.number().integer().min(2).max(1000).default(100),
      }),

      userLogin: Joi.object({
        username: Joi.string()
          .trim()
          .alphanum()
          .min(3)
          .max(30)
          .required()
          .messages({
            'string.alphanum':
              'Username must contain only alphanumeric characters',
            'string.min': 'Username must be at least 3 characters',
            'string.max': 'Username cannot exceed 30 characters',
          }),
        email: Joi.string().email().max(100).optional(),
        password: Joi.string().min(6).max(100).optional(),
      }),

      userUpdate: Joi.object({
        username: Joi.string().trim().alphanum().min(3).max(30).optional(),
        email: Joi.string().email().max(100).optional(),
        avatar: Joi.string().uri().max(500).optional(),
      }),

      typing: Joi.object({
        roomId: Joi.string().trim().alphanum().min(1).max(50).required(),
        isTyping: Joi.boolean().required(),
      }),
    };
  }

  validate(schema, data) {
    const { error, value } = this.schemas[schema].validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new ValidationError('Validation failed', details);
    }

    return value;
  }

  sanitizeMessage(content) {
    // Remove potentially harmful HTML/JS
    const cleaned = purify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });

    // Additional sanitization
    return cleaned
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  validateMessageContent(content) {
    const errors = [];

    // Check length
    const maxLength = parseInt(process.env.MAX_MESSAGE_LENGTH) || 500;
    if (content.length > maxLength) {
      errors.push(`Message exceeds maximum length of ${maxLength} characters`);
    }

    // Check for empty content
    if (!content.trim()) {
      errors.push('Message cannot be empty');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      {
        pattern: /(.)\1{20,}/,
        message: 'Message contains too many repeated characters',
      },
      { pattern: /<script/gi, message: 'Script tags are not allowed' },
      { pattern: /javascript:/gi, message: 'JavaScript URLs are not allowed' },
      { pattern: /on\w+\s*=/gi, message: 'Event handlers are not allowed' },
    ];

    suspiciousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        errors.push(message);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeMessage(content),
    };
  }

  validateRoomId(roomId) {
    const errors = [];

    if (!roomId || typeof roomId !== 'string') {
      errors.push('Room ID is required');
      return { isValid: false, errors };
    }

    // Check format
    if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
      errors.push(
        'Room ID can only contain letters, numbers, underscores, and hyphens'
      );
    }

    // Check length
    if (roomId.length < 1 || roomId.length > 50) {
      errors.push('Room ID must be between 1 and 50 characters');
    }

    // Check for reserved names
    const reservedNames = ['admin', 'system', 'api', 'www', 'mail', 'ftp'];
    if (reservedNames.includes(roomId.toLowerCase())) {
      errors.push('Room ID is reserved and cannot be used');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: roomId.toLowerCase().trim(),
    };
  }

  validateUsername(username) {
    const errors = [];

    if (!username || typeof username !== 'string') {
      errors.push('Username is required');
      return { isValid: false, errors };
    }

    // Check format
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push(
        'Username can only contain letters, numbers, and underscores'
      );
    }

    // Check length
    if (username.length < 3 || username.length > 30) {
      errors.push('Username must be between 3 and 30 characters');
    }

    // Check for reserved names
    const reservedNames = [
      'admin',
      'system',
      'bot',
      'moderator',
      'support',
      'guest',
    ];
    if (reservedNames.includes(username.toLowerCase())) {
      errors.push('Username is reserved and cannot be used');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: username.trim(),
    };
  }

  validateFileUpload(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB default
    if (file.size > maxSize) {
      errors.push(
        `File size exceeds maximum limit of ${Math.round(
          maxSize / 1024 / 1024
        )}MB`
      );
    }

    // Check file type
    const allowedTypes = (
      process.env.ALLOWED_FILE_TYPES ||
      'image/jpeg,image/png,image/gif,text/plain'
    ).split(',');
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check filename
    if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
      errors.push('Filename contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        ...file,
        originalname: this.sanitizeInput(file.originalname),
      },
    };
  }

  // Socket.IO middleware for validation
  createSocketValidationMiddleware(schema) {
    return (socket, next) => {
      return (data, callback) => {
        try {
          const validatedData = this.validate(schema, data);

          // Sanitize message content if present
          if (validatedData.content) {
            const contentValidation = this.validateMessageContent(
              validatedData.content
            );
            if (!contentValidation.isValid) {
              return callback({
                error: 'VALIDATION_ERROR',
                message: contentValidation.errors[0],
                details: contentValidation.errors,
              });
            }
            validatedData.content = contentValidation.sanitized;
          }

          return callback(null, validatedData);
        } catch (error) {
          if (error instanceof ValidationError) {
            return callback({
              error: 'VALIDATION_ERROR',
              message: error.message,
              details: error.details,
            });
          }

          console.error('❌ Validation middleware error:', error);
          return callback({
            error: 'VALIDATION_ERROR',
            message: 'Invalid input data',
          });
        }
      };
    };
  }
}

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

const validationService = new ValidationService();

module.exports = {
  validationService,
  ValidationError,
};
