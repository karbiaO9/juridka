const Notification = require('../Model/Notification');

// GET /api/notifications
// Returns notifications for the authenticated user's role, newest first.
const getNotifications = async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user._id;

        // Match notifications that are:
        //  - broadcast to the role (recipientId is null), OR
        //  - targeted specifically at this user
        const query = {
            recipientRole: role,
            $or: [{ recipientId: null }, { recipientId: userId }],
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ ...query, read: false });

        res.status(200).json({ notifications, unreadCount });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to load notifications' });
    }
};

// PUT /api/notifications/mark-read
// Marks ALL unread notifications for the caller's role as read.
const markRead = async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user._id;
        await Notification.updateMany(
            {
                recipientRole: role,
                $or: [{ recipientId: null }, { recipientId: userId }],
                read: false,
            },
            { read: true, readAt: new Date() }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error marking notifications read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notifications read' });
    }
};

// PATCH /api/notifications/:id/read
// Marks a single notification as read.
const markOneRead = async (req, res) => {
    try {
        const { id } = req.params;
        const role = req.user.role;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipientRole: role },
            { read: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, notification });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notification read' });
    }
};

module.exports = {
    getNotifications,
    markRead,
    markOneRead,
};
