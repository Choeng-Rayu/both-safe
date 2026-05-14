# Implementation Plan: BothSafe Telegram Bot MVP

## Overview

The Telegram Bot runs as a NestJS module inside the backend. It shares the same database, services, and business logic as the web application. This plan implements the bot-specific features on top of the existing backend infrastructure.

## Tasks

- [x] 1. Bot Module Infrastructure (pre-existing)
  - BotModule with Telegraf integration
  - Environment-based webhook vs long-polling configuration
  - _Requirements: 1, 35_

- [x] 2. Implement Webhook Security
  - [x] 2.1 Add webhook secret token validation middleware (BotWebhookGuard)
  - [x] 2.2 Validate X-Telegram-Bot-Api-Secret-Token header
  - [x] 2.3 Add Telegram IP range validation (structure ready, CIDR check disabled for dev)
  - _Requirements: 2_

- [x] 3. Implement Bot Rate Limiting
  - [x] 3.1 Add deal creation rate limiter (3 deals per hour per chat ID)
  - [x] 3.2 Add command spam rate limiter (10 commands per minute per chat ID)
  - [x] 3.3 Add duplicate message deduplication (2 second window)
  - _Requirements: 23, 24_

- [x] 4. Enhance Conversation State Management
  - [x] 4.1 Adjust conversation TTL to 10 minutes
  - [x] 4.2 Add automatic cleanup of expired conversation states (BotCleanupService cron job)
  - [x] 4.3 Add input validation per conversation step
  - _Requirements: 9, 10, 27_

- [x] 5. Enhance Input Validation and Sanitization
  - [x] 5.1 Add HTML/script tag sanitization for text inputs (via sanitizeText)
  - [x] 5.2 Enforce product title max 200 characters
  - [x] 5.3 Enforce note max 500 characters
  - [x] 5.4 Add amount validation with retry limits (3 retries)
  - [x] 5.5 Reject whitespace-only inputs
  - _Requirements: 10, 29_

- [x] 6. Implement Bot Audit Logging
  - [x] 6.1 Add audit log for /start (user registration)
  - [x] 6.2 Add audit log for deal creation via bot
  - [x] 6.3 Add audit log for language changes
  - _Requirements: 32_

- [x] 7. Enhance Notification Adapter
  - [x] 7.1 Verify all notification events are handled (Req 13-21)
  - [x] 7.2 Add retry logic with exponential backoff (3 retries, up to 8s delay)
  - [x] 7.3 Store failed notification attempts for admin review (failureReason in Notification table)
  - _Requirements: 13, 14, 15, 16, 17, 18, 19, 20, 21, 22_

- [x] 8. Integrate Bot Health Check
  - [x] 8.1 Add Telegram API connectivity check (getMe) to health endpoint
  - _Requirements: 34_

- [x] 9. Enhance /mydeals Command
  - [x] 9.1 Include deals where user is a participant (not just creator)
  - _Requirements: 11_

- [x] 10. Final Verification
  - [x] 10.1 Bot source files compile without errors
  - [x] 10.2 All acceptance criteria covered
