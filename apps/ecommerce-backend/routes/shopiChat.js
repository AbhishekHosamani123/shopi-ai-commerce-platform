"use strict";

/**
 * Express Route for Shopi AI Conversational Shopping Assistant
 * POST /api/shopi/chat
 * POST /api/ai/chat (backward compatibility)
 */

const express = require('express');
const router = express.Router();
const { handleCustomerMessage } = require('../shopi-assistant/shopiService');

router.post('/chat', async (req, res) => {
  try {
    const { message, conversation_id, context } = req.body || {};

    if (!message && message !== '') {
      return res.status(400).json({
        error: 'Missing required field: message'
      });
    }

    const response = await handleCustomerMessage({
      message,
      conversation_id,
      context
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('[SHOPI_AI_ERROR]', error);
    return res.status(500).json({
      error: 'Internal Shopi AI error',
      message: error.message
    });
  }
});

module.exports = router;
