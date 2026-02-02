// TODO: cross check this with the actual websocket connection

fastify.get('/ws/alerts', { websocket: true }, (connection, req) => {
  const { token } = req.query as { token: string };
  // 1. Verify Token
  const user = verifyToken(token); 
  if (!user) {
    connection.socket.close();
    return;
  }

  // 2. Add to active connections map
  activeUsers.set(user.id, connection.socket);

  // 3. Handle incoming messages (optional, e.g., ping/pong)
  connection.socket.on('message', message => {
    // handle heartbeats
  });

  // 4. Handle Cleanup
  connection.socket.on('close', () => {
    activeUsers.delete(user.id);
  });
});

