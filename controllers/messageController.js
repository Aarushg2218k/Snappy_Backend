const Messages = require("../models/messageModel");

module.exports.getMessages = async (req, res) => {
  try {
    const { from, to } = req.body;
    const messages = await Messages
      .find({ users: { $all: [from, to] } })
      .sort({ createdAt: 1 });

    const projected = messages.map(msg => ({
      _id: msg._id,
      fromSelf: msg.sender.toString() === from,
      message: msg.message.text,
      createdAt: msg.createdAt
    }));

    return res.status(200).json({ status: true, messages: projected });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, msg: "Internal server error" });
  }
};

module.exports.addMessage = async (req, res) => {
  try {
    const { from, to, message } = req.body;
    const data = await Messages.create({
      message: { text: message },
      users: [from, to],
      sender: from,
    });

    // Notify receiver in real-time
    const sendUserSocket = global.onlineUsers.get(to);
    if (sendUserSocket) {
      global.io.to(sendUserSocket).emit("msg-recieve", {
        _id: data._id,
        from,
        to,
        message: data.message.text,
        createdAt: data.createdAt,
      });
    }

    return res.status(201).json({
      status: true,
      message: {
        id: data._id,
        fromSelf: true,
        message: data.message.text,
        createdAt: data.createdAt,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, msg: "Failed to add message" });
  }
};

module.exports.editMessage = async (req, res) => {
  console.log(req.body);
  try {
    const { messageId, message: newText, userId, to } = req.body;

    const msg = await Messages.findById(messageId);
    if (!msg) {
      return res.status(404).json({ status: false, msg: "Message not found" });
    }

    if (msg.sender.toString() !== userId) {
      return res.status(403).json({ status: false, msg: "You can only edit your own messages" });
    }

    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    if (msg.createdAt.getTime() < tenMinAgo) {
      return res.status(403).json({
        status: false,
        msg: "You can only edit messages within 10 minutes"
      });
    }

    msg.message.text = newText;
    await msg.save();

    const targetSocket = global.onlineUsers.get(to);
    if (targetSocket) {
      global.io.to(targetSocket).emit("msg-edited", {
        messageId,
        newMessage: newText,
      });
    }

    return res.status(200).json({
      status: true,
      message: {
        id: msg._id,
        fromSelf: true,
        message: msg.message.text,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    console.error("Edit error:", err);
    return res.status(500).json({ status: false, msg: "Failed to edit message" });
  }
};

module.exports.deleteMessage = async (req, res) => {
  console.log(req.body);
  try {
    const { messageId, userId, to } = req.body;

    const message = await Messages.findById(messageId);
    if (!message) {
      return res.status(404).json({ status: false, msg: "Message not found" });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ status: false, msg: "You can only delete your own messages" });
    }

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (message.createdAt.getTime() < tenMinutesAgo) {
      return res.status(403).json({ status: false, msg: "You can only delete a message within 10 minutes of sending" });
    }

    await message.remove();

    const targetSocket = global.onlineUsers.get(to);
    if (targetSocket) {
      global.io.to(targetSocket).emit("msg-deleted", { messageId });
    }

    return res.status(200).json({ status: true, msg: "Message deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, msg: "Failed to delete message" });
  }
};
