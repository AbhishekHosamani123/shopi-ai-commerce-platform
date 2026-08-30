import express, { Request, Response } from 'express';
import { telemetryService } from '../merchant-telemetry/telemetry-service';

const router = express.Router();

/**
 * POST /api/telemetry/event (and POST /api/telemetry)
 * Ingests a single customer behavioral event from storefront or Shopi AI.
 */
router.post('/event', async (req: Request, res: Response) => {
  try {
    const { sessionId, customerId, eventType, productId, variantId, metadata, merchantId } = req.body;

    const result = await telemetryService.recordEvent({
      sessionId,
      customerId,
      eventType,
      productId,
      variantId,
      metadata,
      merchantId
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.status(201).json({
      success: true,
      eventId: result.eventId,
      deduplicated: result.deduplicated || false
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal telemetry error' });
  }
});

// Alias POST / to /event
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, customerId, eventType, productId, variantId, metadata, merchantId } = req.body;

    const result = await telemetryService.recordEvent({
      sessionId,
      customerId,
      eventType,
      productId,
      variantId,
      metadata,
      merchantId
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.status(201).json({
      success: true,
      eventId: result.eventId,
      deduplicated: result.deduplicated || false
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal telemetry error' });
  }
});

/**
 * POST /api/telemetry/batch
 * Ingests a batch of events.
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'events must be an array' });
    }

    const result = await telemetryService.recordBatch(events);
    return res.json({
      success: result.success,
      recorded: result.recorded,
      errors: result.errors
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal telemetry error' });
  }
});

/**
 * GET /api/telemetry/timeline
 * Retrieves chronological timeline of events for an active session or authenticated user.
 */
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
    const merchantId = (req.query.merchantId as string) || 'default_merchant';

    if (!sessionId && !customerId) {
      return res.status(400).json({ success: false, error: 'Either sessionId or customerId is required' });
    }

    const timeline = await telemetryService.getCustomerTimeline({ sessionId, customerId }, merchantId);
    return res.json({
      success: true,
      count: timeline.length,
      timeline
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal telemetry error' });
  }
});

/**
 * GET /api/telemetry/stats
 * Aggregated telemetry statistics.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const merchantId = (req.query.merchantId as string) || 'default_merchant';
    const stats = await telemetryService.getEventStats(merchantId);
    return res.json({
      success: true,
      stats
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal telemetry error' });
  }
});

export default router;
