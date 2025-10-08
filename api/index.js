// Vercel serverless function entry point
const express = require("express");
const path = require("path");

// Import the main server logic
const server = require("../server/src/server.js");

// Export the Express app for Vercel
module.exports = server;
