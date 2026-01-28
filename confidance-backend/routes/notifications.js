const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications - Récupérer les notifications de l'utilisateur
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = req.app.get('db');

    // Récupérer les notifications de l'utilisateur
    const notifications = await db.all(
      `SELECT id, type, title, message, read, created_at as createdAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read === 1,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/:id/read - Marquer une notification comme lue
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;
    const db = req.app.get('db');

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await db.get(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Marquer comme lue
    await db.run(
      'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PATCH /api/notifications/read-all - Marquer toutes les notifications comme lues
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = req.app.get('db');

    await db.run(
      'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0',
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// POST /api/notifications - Créer une notification (pour usage interne/système)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { userId, type, title, message } = req.body;
    const db = req.app.get('db');

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.run(
      `INSERT INTO notifications (user_id, type, title, message, read, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      [userId, type, title, message]
    );

    res.json({
      success: true,
      notificationId: result.lastID
    });
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;
