const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const adminRoutes = require("./routes/adminRouters");
const userRouter = require("./routes/userRouter");
const socket = require("socket.io");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ====== MongoDB Connection ======
mongoose
  .connect(process.env.MONGO_URL || "mongodb+srv://aarushgoyal1011:Aarushg2218k@chat-app.xqbqgcd.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log(err.message));

// ====== API Routes ======
app.get("/ping", (_req, res) => res.json({ msg: "Ping Successful" }));

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRouter);

// ====== Start Server ======
const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on port ${process.env.PORT}`)
);

// ====== Socket.IO Setup ======
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000", // adjust if your frontend is hosted elsewhere
    credentials: true,
  },
});

// Make io and onlineUsers available globally (for controllers)
global.io = io;
global.onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 New socket connected: ${socket.id}`);

  // Track user by socket
  socket.on("add-user", (userId) => {
    if (userId) {
      global.onlineUsers.set(userId, socket.id);
      console.log(`✅ User ${userId} mapped to socket ${socket.id}`);

      // Broadcast to others that this user is online
      socket.broadcast.emit("user-online", { userId });
    }
  });

  // Send list of all currently online users to newly connected client
  socket.on("get-online-users", () => {
    const userIds = Array.from(global.onlineUsers.keys());
    socket.emit("online-users", userIds);
  });

  // Typing events
  socket.on("typing", ({ to, from }) => {
    const toSocket = global.onlineUsers.get(to);
    if (toSocket) {
      io.to(toSocket).emit("typing", { from });
    }
  });

  socket.on("stop-typing", ({ to, from }) => {
    const toSocket = global.onlineUsers.get(to);
    if (toSocket) {
      io.to(toSocket).emit("stop-typing", { from });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    for (const [userId, sockId] of global.onlineUsers.entries()) {
      if (sockId === socket.id) {
        global.onlineUsers.delete(userId);
        console.log(`❌ User ${userId} disconnected`);

        // Notify others this user went offline
        socket.broadcast.emit("user-offline", { userId });
        break;
      }
    }
  });
});

