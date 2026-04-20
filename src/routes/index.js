const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/users', userController.list);
router.post('/users', userController.create);
router.get('/users/:id', userController.get);

module.exports = router;
