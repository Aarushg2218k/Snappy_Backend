const express = require("express");
const router = express.Router();
const {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,  // New controller method to get pending requests
} = require("../controllers/userController");

// Send a friend request
router.post("/send-request", sendFriendRequest);

// Accept a friend request
router.post("/accept-request", acceptFriendRequest);

// Decline a friend request
router.post("/decline-request", declineFriendRequest);

// Get friend list of a user
router.get("/friends/:id", getFriends);

// Get pending friend requests for a user
router.get("/:userId/pending-requests", getPendingRequests);  // New route to fetch pending requests

module.exports = router;
