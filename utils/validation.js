// Comprehensive Validation Utilities

const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (UAE format)
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^(\+971|0)?[5][0-9]{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validate date range
 */
const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start < end && !isNaN(start) && !isNaN(end);
};

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
  if (!str) return '';
  return str.trim().replace(/<[^>]*>/g, ''); // Remove HTML tags
};

/**
 * Validate password strength
 */
const isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page, limit) => {
  const validPage = parseInt(page) || 1;
  const validLimit = parseInt(limit) || 10;
  
  return {
    page: Math.max(1, validPage),
    limit: Math.min(100, Math.max(1, validLimit)),
    skip: (Math.max(1, validPage) - 1) * Math.min(100, Math.max(1, validLimit))
  };
};

/**
 * Validate time slot (HH:MM format)
 */
const isValidTimeSlot = (time) => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Validate price/amount
 */
const isValidAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= 0;
};

/**
 * Validate session duration
 */
const isValidDuration = (duration) => {
  const validDurations = [30, 45, 60, 90, 120];
  return validDurations.includes(parseInt(duration));
};

/**
 * Check if date is in the future
 */
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Check if time is within 24 hours
 */
const isWithin24Hours = (date) => {
  const hours = (new Date(date) - new Date()) / (1000 * 60 * 60);
  return hours < 24 && hours > 0;
};

/**
 * Validate file type
 */
const isValidFileType = (filename, allowedTypes) => {
  const ext = filename.split('.').pop().toLowerCase();
  return allowedTypes.includes(ext);
};

/**
 * Validate image file
 */
const isValidImage = (filename) => {
  return isValidFileType(filename, ['jpg', 'jpeg', 'png', 'gif', 'webp']);
};

/**
 * Validate document file
 */
const isValidDocument = (filename) => {
  return isValidFileType(filename, ['pdf', 'doc', 'docx', 'txt']);
};

/**
 * Sanitize search query
 */
const sanitizeSearchQuery = (query) => {
  if (!query) return '';
  // Remove special regex characters
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
};

/**
 * Validate status value
 */
const isValidStatus = (status, allowedStatuses) => {
  return allowedStatuses.includes(status);
};

/**
 * Build pagination response
 */
const buildPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Validate and format date
 */
const validateAndFormatDate = (date) => {
  const d = new Date(date);
  if (isNaN(d)) {
    throw new Error('Invalid date format');
  }
  return d;
};

module.exports = {
  isValidObjectId,
  isValidEmail,
  isValidPhone,
  isValidDateRange,
  sanitizeString,
  isStrongPassword,
  validatePagination,
  isValidTimeSlot,
  isValidAmount,
  isValidDuration,
  isFutureDate,
  isWithin24Hours,
  isValidFileType,
  isValidImage,
  isValidDocument,
  sanitizeSearchQuery,
  isValidStatus,
  buildPaginationResponse,
  validateAndFormatDate
};

