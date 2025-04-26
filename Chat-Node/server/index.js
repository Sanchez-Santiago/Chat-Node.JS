import express from "express";
import logger from "morgan";
import { Server } from "socket.io";
import { createServer } from "node:http";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config();
const port = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
});

const db = createClient({
  url: 'libsql://composed-fallen-sanchez-santiago.aws-us-east-1.turso.io',
  authToken: process.env.DB_TOKEN
});

// Eliminar y recrear tabla para forzar la estructura correcta
/*await db.execute(`DROP TABLE IF EXISTS messages`);
await db.execute(`CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  user TEXT NOT NULL
)`);*/

io.on("connection", async (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  socket.on("message", async (message) => {
    const username = socket.handshake.auth.username ?? "Anonymous";
    try {
      // Insertar con parámetros correctos (array)
      const result = await db.execute({
        sql: `INSERT INTO messages (content, user) VALUES (?, ?)`,
        args: [message, username]
      });
      io.emit("message", message, result.lastInsertRowid.toString(), username);
    } catch (error) {
      console.log(error);
    }
  });

  if (!socket.recovered) {
    try {
      const result = await db.execute({
        sql: `SELECT id, content, user FROM messages WHERE id > ?`,
        args: [socket.handshake.auth.serverOffset ?? 0]
      });

      result.rows.forEach((row) => {
        socket.emit("message", row.content, row.id.toString(), row.user);
      });
    } catch (error) {
      console.log(error);
    }
  }
});

app.use(logger("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});