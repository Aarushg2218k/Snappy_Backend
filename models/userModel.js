const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      min: 3,
      max: 20,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      max: 50,
    },
    password: {
      type: String,
      required: true,
      min: 8,
    },
    isAvatarImageSet: {
      type: Boolean,
      default: false,
    },
    avatarImage: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    // 👇 Friendship system
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }], // Array of friends
    friendRequests: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }, // Who sent the request
        status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" }
      }
    ], // Requests received by the user
    sentRequests: [
      {
        receiver: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }, // Who the request was sent to
      }
    ], // Requests the user has sent out (without status)

  },
  { timestamps: true }
);

module.exports = mongoose.model("Users", userSchema);
