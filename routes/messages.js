const { addMessage, getMessages, editMessage, deleteMessage } = require("../controllers/messageController");
const router = require("express").Router();
const multer = require("multer");

// Route to add a message
router.post("/addmsg", addMessage);

// Route to get messages for a chat
router.post("/getmsg", getMessages);

// Route to edit a message
router.put("/edit", editMessage);  // Changed to PUT, since editing is typically a PUT request

// Route to delete a message
router.delete("/delete", deleteMessage);  // Changed to DELETE, since deleting is typically a DELETE request

module.exports = router;
