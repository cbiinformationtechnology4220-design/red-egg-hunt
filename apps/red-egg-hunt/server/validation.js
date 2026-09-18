import { createHmac } from 'node:crypto';
import { AppError } from './errors.js';

const CODE_PATTERN = /^\d{8}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

function text(value, name, { max = 200 } = {}) {
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > max) {
    throw new AppError('VALIDATION_ERROR', `${name} is invalid.`);
  }
  return value.trim();
}

export function normalizePrintedCode(value) {
  const code = typeof value === 'string' ? value.trim() : '';
  if (!CODE_PATTERN.test(code)) throw new AppError('VALIDATION_ERROR', 'The printed code must contain exactly eight digits.');
  return code;
}

export function normalizeMobileNumber(value) {
  const raw = text(value, 'Mobile number', { max: 32 }).replace(/[\s().-]/g, '');
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^\+639\d{9}$/.test(raw)) return raw;
  throw new AppError('VALIDATION_ERROR', 'Enter a valid Philippine mobile number.');
}

export function normalizeParticipantName(value) {
  return text(value, 'Name', { max: 120 }).replace(/[<>]/g, '');
}

export function normalizeRequestId(value) {
  const requestId = text(value, 'Request identifier', { max: 128 });
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new AppError('VALIDATION_ERROR', 'The request identifier is invalid.');
  return requestId;
}

export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('VALIDATION_ERROR');
  const allowed = new Set(['name', 'mobileNumber', 'printedCode', 'requestId']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new AppError('VALIDATION_ERROR');
  return Object.freeze({
    name: normalizeParticipantName(input.name),
    mobileNumber: normalizeMobileNumber(input.mobileNumber),
    printedCode: normalizePrintedCode(input.printedCode),
    requestId: normalizeRequestId(input.requestId),
  });
}

export function validateCodeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('VALIDATION_ERROR');
  const allowed = new Set(['printedCode', 'requestId']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new AppError('VALIDATION_ERROR');
  return Object.freeze({
    printedCode: normalizePrintedCode(input.printedCode),
    requestId: input.requestId === undefined ? null : normalizeRequestId(input.requestId),
  });
}

export function hashRequestId(requestId, secret) {
  return createHmac('sha256', secret).update(requestId, 'utf8').digest('hex');
}

export function hashSubmissionPayload({ name, mobileNumber, printedCode }, secret) {
  return createHmac('sha256', secret).update(`${printedCode}\n${name}\n${mobileNumber}`, 'utf8').digest('hex');
}

export { CODE_PATTERN };
