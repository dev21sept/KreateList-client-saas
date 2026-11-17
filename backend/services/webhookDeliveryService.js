const crypto = require('crypto');
const axios = require('axios');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookDelivery = require('../models/WebhookDelivery');
const { assertSafeWebhookUrl } = require('./webhookUrlValidator');

const MAX_ATTEMPTS = 6;

function signPayload(secret, timestamp, bodyString) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${bodyString}`).digest('hex');
}

function backoffMs(attemptCount) {
  const base = Math.min(2 ** attemptCount, 60) * 1000;
  return base + Math.floor(Math.random() * 1000); // jitter
}

/**
 * Queues a webhook delivery for every one of the user's active endpoints
 * subscribed to this event type. Never throws into the caller.
 */
async function enqueueWebhookEvent(userId, eventType, data) {
  try {
    const endpoints = await WebhookEndpoint.find({ user: userId, status: 'active', subscribedEvents: eventType });
    for (const endpoint of endpoints) {
      await WebhookDelivery.create({
        endpoint: endpoint._id,
        eventId: `evt_${crypto.randomUUID()}`,
        eventType,
        payload: {
          id: `evt_${crypto.randomUUID()}`,
          type: eventType,
          created_at: new Date().toISOString(),
          tenant_id: String(userId),
          data
        }
      });
    }
  } catch (err) {
    console.error('[webhookDeliveryService] enqueueWebhookEvent failed:', err.message);
  }
}

async function attemptDelivery(delivery) {
  const endpoint = await WebhookEndpoint.findById(delivery.endpoint);
  if (!endpoint || endpoint.status !== 'active') {
    delivery.status = 'failed';
    delivery.responseCode = null;
    await delivery.save();
    return;
  }

  try {
    await assertSafeWebhookUrl(endpoint.url); // re-validated at delivery time, not just registration
    const bodyString = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(endpoint.secret, timestamp, bodyString);

    const res = await axios.post(endpoint.url, delivery.payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Elister-Signature': signature,
        'X-Elister-Timestamp': String(timestamp)
      },
      validateStatus: () => true
    });

    delivery.responseCode = res.status;
    delivery.attemptCount += 1;

    if (res.status >= 200 && res.status < 300) {
      delivery.status = 'delivered';
    } else if (delivery.attemptCount >= MAX_ATTEMPTS) {
      delivery.status = 'failed';
    } else {
      delivery.nextAttemptAt = new Date(Date.now() + backoffMs(delivery.attemptCount));
    }
  } catch (err) {
    delivery.attemptCount += 1;
    delivery.responseCode = null;
    if (delivery.attemptCount >= MAX_ATTEMPTS) {
      delivery.status = 'failed';
    } else {
      delivery.nextAttemptAt = new Date(Date.now() + backoffMs(delivery.attemptCount));
    }
  }

  await delivery.save();
}

async function runWebhookDeliveryCycle() {
  const due = await WebhookDelivery.find({ status: 'pending', nextAttemptAt: { $lte: new Date() } }).limit(100);
  let delivered = 0, failed = 0, retried = 0;

  for (const delivery of due) {
    await attemptDelivery(delivery);
    if (delivery.status === 'delivered') delivered++;
    else if (delivery.status === 'failed') failed++;
    else retried++;
  }

  return { scanned: due.length, delivered, failed, retried };
}

module.exports = { enqueueWebhookEvent, runWebhookDeliveryCycle, signPayload };
