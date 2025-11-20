import express from "express";
import { fetchEmailsController, getScheduledJobsController, cancelScheduledJobController } from "../controllers/emailController.js";
import { getInvoicesByVendor, getVendorsByUser } from "../controllers/driveController.js";
import { getUserSyncStatus, resetUserSyncStatus } from "../controllers/userController.js";

import { getInvoicesByVendor, getVendorsByUser, getVendorMaster } from "../controllers/driveController.js";
import { getUserSyncStatus, resetUserSyncStatus, disconnectGoogleAccount } from "../controllers/userController.js";

const router = express.Router();

/**
 * @route   POST /api/v1/email/fetch
 * @desc    Fetch emails from Gmail and upload invoice attachments to Google Drive
 * @access  Public (requires valid userId with Google OAuth tokens)
 * @consumers
 *   - Frontend web applications (React, Angular, Vue.js)
 *   - Mobile applications (iOS, Android)
 *   - Backend automation services
 *   - Third-party integrations (Zapier, Make.com)
 * @requires
 *   - userId: MongoDB ObjectId of authenticated user
 *   - fromDate: ISO date string (YYYY-MM-DD)
 *   - User must have completed Google OAuth flow
 *   - User must have valid Google refresh token
 * @body
 *   - userId (required): string - MongoDB ObjectId
 *   - fromDate (required): string - Start date for email search
 *   - email (optional): string - Single or comma-separated vendor emails (e.g., "ship-confirm@amazon.in" or "ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com")
 *   - onlyPdf (optional): boolean - Process only PDF files (default: true)
 *   - schedule (optional): string|object - 'manual' or schedule config
 * @returns {200} Success - Emails fetched and files uploaded
 * @returns {400} Bad Request - Missing required fields
 * @returns {404} Not Found - User not found
 * @returns {500} Server Error - Failed to fetch emails or upload files
 * @example
 *   POST /api/v1/email/fetch
 *   Body: {
 *     "userId": "690c7d0ee107fb31784c1b1b",
 *     "fromDate": "2024-01-01",
 *     "email": "ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com",
 *     "onlyPdf": true,
 *     "schedule": "manual"
 *   }
 */
router.post("/email/fetch", fetchEmailsController);

/**
 * @route   GET /api/v1/drive/users/:userId/vendors
 * @desc    List all vendor folders from user's Google Drive
 * @access  Public (requires valid userId with Google OAuth tokens)
 * @consumers
 *   - Frontend dashboards for vendor selection dropdowns
 *   - Mobile apps for vendor list display
 *   - Analytics services for vendor tracking
 *   - Reporting systems for invoice summaries
 * @requires
 *   - userId: MongoDB ObjectId (path parameter)
 *   - User must have completed Google OAuth flow
 *   - User must have valid Google refresh token
 *   - invoiceAutomation folder must exist in user's Drive
 * @params
 *   - userId (path): string - MongoDB ObjectId of user
 * @returns {200} Success - Array of vendor folders with metadata
 * @returns {400} Bad Request - User has not connected Google Drive
 * @returns {404} Not Found - User not found
 * @returns {500} Server Error - Failed to access Google Drive
 * @example
 *   GET /api/v1/drive/users/690c7d0ee107fb31784c1b1b/vendors
 *   Response: {
 *     "userId": "690c7d0ee107fb31784c1b1b",
 *     "total": 3,
 *     "vendors": [
 *       { "id": "1MND...", "name": "Amazon", "createdTime": "..." }
 *     ]
 *   }
 */
router.get("/drive/users/:userId/vendors", getVendorsByUser);

/**
 * @route   GET /api/v1/drive/users/:userId/vendors/:vendorId/invoices
 * @desc    List all invoice files for a specific vendor from Google Drive
 * @access  Public (requires valid userId with Google OAuth tokens)
 * @consumers
 *   - Frontend invoice viewers and download interfaces
 *   - Mobile apps for invoice display and download
 *   - OCR services for invoice data extraction
 *   - Accounting integrations (QuickBooks, Xero)
 *   - Data analytics and reporting systems
 * @requires
 *   - userId: MongoDB ObjectId (path parameter)
 *   - vendorId: Google Drive folder ID (path parameter)
 *   - User must have completed Google OAuth flow
 *   - User must have valid Google refresh token
 *   - Vendor folder must exist in user's Drive
 * @params
 *   - userId (path): string - MongoDB ObjectId of user
 *   - vendorId (path): string - Google Drive folder ID of vendor
 * @returns {200} Success - Array of invoice files with metadata and download links
 * @returns {400} Bad Request - User has not connected Google Drive or missing parameters
 * @returns {404} Not Found - User not found
 * @returns {500} Server Error - Failed to access Google Drive
 * @example
 *   GET /api/v1/drive/users/690c7d0ee107fb31784c1b1b/vendors/1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp/invoices
 *   Response: {
 *     "userId": "690c7d0ee107fb31784c1b1b",
 *     "vendorFolderId": "1MND...",
 *     "invoiceFolderId": "3XYZ...",
 *     "total": 25,
 *     "invoices": [
 *       {
 *         "id": "4PDF...",
 *         "name": "invoice_001.pdf",
 *         "webViewLink": "https://drive.google.com/...",
 *         "webContentLink": "https://drive.google.com/uc?id=..."
 *       }
 *     ]
 *   }
 */
router.get("/drive/users/:userId/vendors/:vendorId/invoices", getInvoicesByVendor);
router.get("/drive/users/:userId/vendors/:vendorId/master", getVendorMaster);

/**
 * @route   GET /api/v1/users/:userId/sync-status
 * @desc    Get user's last email sync timestamp and Google connection status
 * @access  Public (requires valid userId)
 * @consumers
 *   - Frontend dashboards for sync status display
 *   - Mobile apps for last sync time indicators
 *   - Monitoring services for sync health checks
 *   - Admin panels for user sync troubleshooting
 * @requires
 *   - userId: MongoDB ObjectId (path parameter)
 *   - User record must exist in MongoDB
 * @params
 *   - userId (path): string - MongoDB ObjectId of user
 * @returns {200} Success - Sync status with lastSyncedAt timestamp
 * @returns {404} Not Found - User not found
 * @returns {500} Server Error - Database query failed
 * @example
 *   GET /api/v1/users/690c7d0ee107fb31784c1b1b/sync-status
 *   Response: {
 *     "userId": "690c7d0ee107fb31784c1b1b",
 *     "email": "user@example.com",
 *     "lastSyncedAt": "2025-11-18T19:24:34.602Z",
 *     "hasGoogleConnection": true,
 *     "message": "User last synced on 2025-11-18..."
 *   }
 */
router.get("/users/:userId/sync-status", getUserSyncStatus);

/**
 * @route   DELETE /api/v1/users/:userId/sync-status
 * @desc    Reset user's sync status to enable re-fetching all historical emails
 * @access  Public (requires valid userId)
 * @consumers
 *   - Frontend admin interfaces for sync management
 *   - Support tools for troubleshooting sync issues
 *   - Testing and development environments
 *   - Data migration and re-import workflows
 * @requires
 *   - userId: MongoDB ObjectId (path parameter)
 *   - User record must exist in MongoDB
 * @params
 *   - userId (path): string - MongoDB ObjectId of user
 * @returns {200} Success - Sync status reset, lastSyncedAt set to null
 * @returns {404} Not Found - User not found
 * @returns {500} Server Error - Database update failed
 * @warning
 *   This will cause duplicate files in Drive if emails were already processed.
 *   Consider manually cleaning Drive folders before reset or use a different user account.
 * @example
 *   DELETE /api/v1/users/690c7d0ee107fb31784c1b1b/sync-status
 *   Response: {
 *     "message": "Sync status reset successfully. Next fetch will use the fromDate parameter.",
 *     "userId": "690c7d0ee107fb31784c1b1b"
 *   }
 */
router.delete("/users/:userId/sync-status", resetUserSyncStatus);

/**
 * @route   POST /api/v1/users/:userId/disconnect-google
 * @desc    Remove stored Google OAuth tokens for user (disconnect Drive integration)
 * @access  Public (requires valid userId)
 * @returns {200} Success - Tokens cleared
 * @returns {404} Not Found - User not found
 */
router.post("/users/:userId/disconnect-google", disconnectGoogleAccount);

/**
 * @route   GET /api/v1/emails/schedule/:userId
 * @desc    Get all scheduled email fetch jobs for a user
 * @access  Public (requires valid userId)
 * @consumers
 *   - Frontend scheduled jobs management UI
 *   - Admin dashboards
 *   - Monitoring systems
 * @requires
 *   - userId: MongoDB ObjectId (path parameter)
 * @returns {200} Success - Array of scheduled jobs
 * @returns {400} Bad Request - Invalid userId format
 * @returns {500} Server Error - Failed to retrieve jobs
 * @example
 *   GET /api/v1/emails/schedule/690c7d0ee107fb31784c1b1b
 *   Response: {
 *     "message": "Scheduled jobs retrieved successfully.",
 *     "count": 2,
 *     "jobs": [
 *       {
 *         "jobId": "690c7d0ee107fb31784c1b1b_1735123456789_hourly",
 *         "userId": "690c7d0ee107fb31784c1b1b",
 *         "filters": { "emails": ["ship-confirm@amazon.in"], "onlyPdf": true, "forceSync": false, "fromDate": "2024-01-01" },
 *         "frequency": "hourly",
 *         "createdAt": "2024-12-25T10:30:56.789Z",
 *         "status": "active"
 *       }
 *     ]
 *   }
 */
router.get("/emails/schedule/:userId", getScheduledJobsController);

/**
 * @route   DELETE /api/v1/emails/schedule/:userId/:jobId
 * @desc    Cancel a scheduled email fetch job
 * @access  Public (requires valid userId and jobId)
 * @consumers
 *   - Frontend scheduled jobs management UI
 *   - Admin dashboards
 *   - Automation cleanup scripts
 * @requires
 *   - userId: MongoDB ObjectId (path parameter)
 *   - jobId: Unique job identifier (path parameter, format: userId_timestamp_frequency)
 * @returns {200} Success - Job cancelled
 * @returns {400} Bad Request - Invalid userId or missing jobId
 * @returns {404} Not Found - Job not found
 * @returns {500} Server Error - Failed to cancel job
 * @example
 *   DELETE /api/v1/emails/schedule/690c7d0ee107fb31784c1b1b/690c7d0ee107fb31784c1b1b_1735123456789_hourly
 *   Response: {
 *     "message": "Scheduled job cancelled successfully.",
 *     "jobId": "690c7d0ee107fb31784c1b1b_1735123456789_hourly"
 *   }
 */
router.delete("/emails/schedule/:userId/:jobId", cancelScheduledJobController);

export default router;
