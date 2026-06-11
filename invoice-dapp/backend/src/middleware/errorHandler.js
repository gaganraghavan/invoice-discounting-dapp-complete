/**
 * errorHandler.js — Global Express error handling middleware
 * Paper: "A Non-Fungible Token Based Approach to Invoice Discounting" — PES University
 */

"use strict";

/**
 * Global error handler.
 * Express calls this when next(err) is called or an unhandled error is thrown.
 * Must have 4 parameters for Express to recognize it as an error handler.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[ERROR] ${new Date().toISOString()} — ${req.method} ${req.path}`);
  console.error(err.message || err);

  // Determine HTTP status code
  let statusCode = err.statusCode || err.status || 500;

  // Blockchain revert errors → 400 Bad Request
  if (
    err.message &&
    (err.message.includes("revert") ||
     err.message.includes("NFT already exists") ||
     err.message.includes("buyer cannot be the same") ||
     err.message.includes("Only the designated") ||
     err.message.includes("not available to buy") ||
     err.message.includes("must be signed") ||
     err.message.includes("Insufficient balance"))
  ) {
    statusCode = 400;
  }

  // Token not found → 404
  if (
    err.message &&
    (err.message.includes("Token does not exist") ||
     err.message.includes("No token found"))
  ) {
    statusCode = 404;
  }

  res.status(statusCode).json({
    error:   err.message || "Internal server error",
    status:  statusCode,
    path:    req.path,
    method:  req.method,
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
