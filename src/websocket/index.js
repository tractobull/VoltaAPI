import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

let io;
const activeSupportChats = new Map();

function serializePresence(userId, presence, active = true) {
  return {
    userId,
    active,
    agent: active && presence
      ? { id: presence.agentId, name: presence.agentName, email: presence.agentEmail }
      : null,
  };
}

function releaseSupportChat(socket, requestedUserId) {
  const userId = requestedUserId || socket.data.supportUserId;
  if (!userId) return;

  const current = activeSupportChats.get(userId);
  if (current?.socketId === socket.id) {
    activeSupportChats.delete(userId);
    io.to('support:admin').emit('support_chat_presence', serializePresence(userId, null, false));
  }

  if (socket.data.supportUserId === userId) {
    delete socket.data.supportUserId;
  }
}

export function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3001', 'http://localhost:3000'],
      credentials: true,
    },
  });

  // Authentication middleware for socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      // Verify token using the same logic as HTTP middleware
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'volta-secret-key-2024');
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {

    // Join user's personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Join user's personal room for support chat
    socket.join(`support:${socket.user.id}`);

    // Admin joins admin room
    if (['ADMIN', 'SUPPORT'].includes(socket.user.role)) {
      socket.join('support:admin');

      socket.on('support:get_presence', (callback) => {
        const snapshot = Array.from(activeSupportChats.entries()).map(([userId, presence]) =>
          serializePresence(userId, presence)
        );
        callback?.(snapshot);
      });

      socket.on('support:join_chat', async ({ userId } = {}, callback) => {
        try {
          if (!userId) {
            callback?.({ ok: false, error: 'Usuario requerido' });
            return;
          }

          const existing = activeSupportChats.get(userId);
          if (existing && existing.agentId !== socket.user.id) {
            callback?.({ ok: false, occupied: true, ...serializePresence(userId, existing) });
            return;
          }

          if (socket.data.supportUserId && socket.data.supportUserId !== userId) {
            releaseSupportChat(socket, socket.data.supportUserId);
          }

          const agentResult = await pool.query(
            'SELECT id, name, email FROM users WHERE id = $1',
            [socket.user.id]
          );
          const agent = agentResult.rows[0];
          if (!agent) {
            callback?.({ ok: false, error: 'Agente no encontrado' });
            return;
          }

          const presence = {
            socketId: socket.id,
            agentId: agent.id,
            agentName: agent.name || agent.email,
            agentEmail: agent.email,
          };
          activeSupportChats.set(userId, presence);
          socket.data.supportUserId = userId;

          const payload = serializePresence(userId, presence);
          io.to('support:admin').emit('support_chat_presence', payload);
          callback?.({ ok: true, owned: true, ...payload });
        } catch (error) {
          console.error('Error joining support chat:', error);
          callback?.({ ok: false, error: 'No se pudo tomar la conversación' });
        }
      });

      socket.on('support:leave_chat', ({ userId } = {}) => {
        releaseSupportChat(socket, userId);
      });
    }

    socket.on('disconnect', () => {
      releaseSupportChat(socket);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

// Emit events for support chat
export function emitSupportMessage(userId, message) {
  if (!io) return;
  const payload = {
    ...message,
    support_attended: activeSupportChats.has(String(userId)),
  };
  
  // Emit to the specific user
  io.to(`support:${userId}`).emit('new_message', payload);
  
  // Emit to all admins
  io.to('support:admin').emit('new_message', payload);
}

export function emitSupportReply(userId, message) {
  if (!io) return;
  
  // Emit to the specific user
  io.to(`support:${userId}`).emit('new_message', message);
  
  // Emit to all admins
  io.to('support:admin').emit('new_message', message);
}

export function emitSupportStatus(enabled) {
  if (!io) return;
  io.emit('support_status_changed', { enabled });
}

export function emitSupportMessageDeleted(userId, messageId) {
  if (!io) return;
  const payload = { userId, messageId };
  io.to(`support:${userId}`).emit('support_message_deleted', payload);
  io.to('support:admin').emit('support_message_deleted', payload);
}

export function emitSupportMessagesRead(userId, messageIds, reader) {
  if (!io || messageIds.length === 0) return;
  const payload = { userId, messageIds, reader };
  io.to(`support:${userId}`).emit('support_messages_read', payload);
  io.to('support:admin').emit('support_messages_read', payload);
}

export function getSupportChatPresence(userId) {
  if (!userId) {
    return Object.fromEntries(
      Array.from(activeSupportChats.entries()).map(([activeUserId, presence]) => [
        activeUserId,
        serializePresence(activeUserId, presence).agent,
      ])
    );
  }
  const presence = activeSupportChats.get(userId);
  return presence ? serializePresence(userId, presence) : null;
}

export function canAgentManageSupportChat(userId, agentId) {
  const presence = activeSupportChats.get(userId);
  return !presence || presence.agentId === agentId;
}
