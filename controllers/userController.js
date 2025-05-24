const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required", status: false });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid email", status: false });
    }

    // Compare passwords
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ msg: "Incorrect password", status: false });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Remove password from user object before sending
    const { password: _, ...userWithoutPassword } = user._doc;

    // Send response
    return res.json({ status: true, token, user: userWithoutPassword });
  } catch (ex) {
    console.error("Error in login:", ex.message);
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};



module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if the username already exists
    const usernameCheck = await User.findOne({ username });
    if (usernameCheck) {
      return res.status(400).json({ msg: "Username already used", status: false });
    }

    // Check if the email already exists
    const emailCheck = await User.findOne({ email });
    if (emailCheck) {
      return res.status(400).json({ msg: "Email already used", status: false });
    }

    // Hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, 10); // Optional: Increase salt rounds for better security

    // Create a new user with default role 'user'
    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      role: 'user',  // Default role is 'user'
    });

    // Exclude the password field from the response for security purposes
    delete user.password;

    return res.json({ status: true, user });
  } catch (ex) {
    console.error("Error in registration:", ex);  // Add error logging for debugging
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({
      _id: { $ne: req.params.id },
      role: "user"
    }).select(["email", "username", "avatarImage", "_id"]);

    return res.json(users);
  } catch (ex) {
    console.error("Error in fetching users:", ex);
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};


module.exports.setAvatar = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const avatarImage = req.body.image;
    const userData = await User.findByIdAndUpdate(
      userId,
      {
        isAvatarImageSet: true,
        avatarImage,
      },
      { new: true }
    );
    return res.json({
      isSet: userData.isAvatarImageSet,
      image: userData.avatarImage,
    });
  } catch (ex) {
    console.error("Error in setting avatar:", ex);
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};

module.exports.logOut = (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res
        .status(400)
        .json({ status: false, msg: "User id is required." });
    }
    if (global.onlineUsers) {
      global.onlineUsers.delete(userId);
    }
    return res
      .status(200)
      .json({ status: true, msg: "Logout successful." });
  } catch (ex) {
    console.error("Error in logout:", ex);
    return res
      .status(500)
      .json({ status: false, msg: "Internal server error." });
  }
};

// ========== SEND FRIEND REQUEST ==========
module.exports.sendFriendRequest = async (req, res) => {
  // console.log(req.body);
  try {
    const { senderId, receiverId } = req.body;

    if (senderId === receiverId) {
      return res.status(400).json({ msg: "You can't send a request to yourself", status: false });
    }

    const sender = await User.findOne({ email: senderId });
    const receiver = await User.findOne({ email: receiverId });

    // console.log(sender);
    // console.log(receiver);

    if (!receiver || !sender) {
      return res.status(404).json({ msg: "User not found", status: false });
    }

    // Check for duplicate friend request or existing friendship
    const alreadyRequested = receiver.friendRequests.some(
      req => req.sender && req.sender.toString() === sender._id.toString()
    );
    const alreadyFriends = receiver.friends.includes(sender._id);

    if (alreadyRequested || alreadyFriends) {
      return res.status(400).json({ msg: "Already sent or already friends", status: false });
    }

    // Push correctly structured friend request
    receiver.friendRequests.push({
      sender: sender._id,
      status: "pending"
    });

    sender.sentRequests.push({
      receiver: receiver._id
    });

    await receiver.save();
    await sender.save();

    return res.status(200).json({ status: true, msg: "Friend request sent" });
  } catch (err) {
    console.error("Send Friend Request Error:", err);
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};


// Controller to fetch pending friend requests for a specific user
module.exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId)
      .populate({
        path: 'friendRequests.sender',  // Populate the sender field
        select: 'username email avatarImage'  // Specify the fields to populate
      })
      .exec();

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const pendingRequests = user.friendRequests
      .filter(request => request.status === "pending" && request.sender)  // Ensure sender is populated
      .map(request => ({
        _id: request._id,
        senderId: request.sender._id,
        username: request.sender.username || "N/A",  // Default value
        email: request.sender.email || "N/A",  // Default value
        avatarImage: request.sender.avatarImage || "",  // Default value
      }));


    if (pendingRequests.length === 0) {
      return res.status(200).json([]);  // Return empty array if no pending requests
    }

    res.status(200).json(pendingRequests);  // Return filtered requests
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ msg: "Server error" });
  }
};


// ========== ACCEPT FRIEND REQUEST ==========

module.exports.acceptFriendRequest = async (req, res) => {
  // console.log(req.body);
  try {
    const { senderId, receiverId } = req.body;

    // Check if sender and receiver are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Invalid user ID(s)" });
    }

    // Find the sender and receiver users by their IDs
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User(s) not found" });
    }

    // Check if the friend request exists in receiver's friendRequests
    const friendRequest = receiver.friendRequests.find(req => req.sender.toString() === senderId && req.status === "pending");

    if (!friendRequest) {
      return res.status(404).json({ message: "No pending friend request found" });
    }

    // Update the friend request status to "accepted"
    friendRequest.status = "accepted";
    await receiver.save();

    // Add the sender to receiver's friends array
    receiver.friends.push(senderId);

    // Add the receiver to sender's friends array
    sender.friends.push(receiverId);

    // Remove the friend request from the sender's sentRequests
    sender.sentRequests = sender.sentRequests.filter(req => req.receiver.toString() !== receiverId);

    // Save updated sender and receiver
    await sender.save();
    await receiver.save();

    // Send success response
    res.status(200).json({ message: "Friend request accepted successfully!" });

  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({ message: "Failed to accept friend request." });
  }
};



// ========== DECLINE FRIEND REQUEST ==========
module.exports.declineFriendRequest = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ msg: "User not found", status: false });
    }

    // Remove from receiver's friendRequests
    receiver.friendRequests = receiver.friendRequests.filter(
      (request) => !request.sender.equals(mongoose.Types.ObjectId(senderId))
    );

    // Remove from sender's sentRequests
    sender.sentRequests = sender.sentRequests.filter(
      (request) => !request.receiver.equals(mongoose.Types.ObjectId(receiverId))
    );

    await receiver.save();
    await sender.save();

    return res.status(200).json({ status: true, msg: "Friend request declined" });
  } catch (err) {
    console.error("Decline Friend Request Error:", err);
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};

// ========== GET FRIEND LIST ==========
module.exports.getFriends = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).populate("friends", "username avatarImage _id");
    if (!user) {
      return res.status(404).json({ msg: "User not found", status: false });
    }

    return res.status(200).json({ status: true, friends: user.friends });
  } catch (err) {
    console.error("Get Friends Error:", err);
    return res.status(500).json({ msg: "Internal server error", status: false });
  }
};


