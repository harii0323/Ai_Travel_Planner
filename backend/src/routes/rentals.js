const express = require('express');
const authenticate = require('../middleware/authenticate');
const carRentalService = require('../services/carRentalService');

const router = express.Router();

function handleRentalError(res, err) {
  const status = err.status || (err.code === 'ECONNABORTED' ? 504 : 502);
  const fallbackMessage = status === 504
    ? 'The car rental service timed out. Please try again.'
    : 'The car rental service is unavailable right now. Please try again or choose another transport mode.';

  res.status(status).json({
    success: false,
    error: err.status ? err.message : fallbackMessage
  });
}

router.get('/search', authenticate, async (req, res) => {
  try {
    const result = await carRentalService.searchAvailableCars(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    handleRentalError(res, err);
  }
});

router.get('/vehicles/:id', authenticate, async (req, res) => {
  try {
    const vehicle = await carRentalService.getVehicle(req.params.id, req.query);
    res.json({ success: true, vehicle });
  } catch (err) {
    handleRentalError(res, err);
  }
});

router.post('/booking', authenticate, async (req, res) => {
  try {
    const booking = await carRentalService.createBooking({
      ...req.body,
      userId: req.user.id
    });
    res.json({ success: true, booking });
  } catch (err) {
    handleRentalError(res, err);
  }
});

router.post('/payment/process', authenticate, async (req, res) => {
  try {
    const result = await carRentalService.processPayment({
      ...req.body,
      userId: req.user.id
    });
    res.json(result);
  } catch (err) {
    handleRentalError(res, err);
  }
});

router.get('/booking/:bookingId', authenticate, async (req, res) => {
  try {
    const booking = await carRentalService.getBooking(req.params.bookingId);
    res.json({ success: true, booking });
  } catch (err) {
    handleRentalError(res, err);
  }
});

module.exports = router;
