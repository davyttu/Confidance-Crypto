const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/notifications - Récupérer les notifications de l'utilisateur
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    res.json({
      success: true,
      notifications: (notifications || []).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: Boolean(n.read),
        createdAt: n.created_at
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

    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error marking notification as read:', updateError);
      return res.status(500).json({ error: 'Failed to update notification' });
    }

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

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ Error marking all notifications as read:', error);
      return res.status(500).json({ error: 'Failed to update notifications' });
    }

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

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: inserted, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type,
          title,
          message,
          read: false
        }
      ])
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error creating notification:', error);
      return res.status(500).json({ error: 'Failed to create notification' });
    }

    res.json({
      success: true,
      notificationId: inserted?.id
    });
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;
