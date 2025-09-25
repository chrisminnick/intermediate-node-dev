# Lab 2: Building a Real-Time Chat Application

## Objective

Build a real-time chat application using Node.js, Express, and WebSockets (Socket.IO or ws). Learn how to manage user connections, broadcast messages, and persist chat history.

## Instructions

### Part 1: Project Setup

1. Initialize a new Node.js project and install dependencies:
   - `express`
   - `socket.io` (or `ws`)
   - Optionally: `redis` for scaling and message persistence
2. Create a basic Express server and serve a static HTML file for the chat UI.

### Part 2: Implement Real-Time Messaging

1. Set up a WebSocket server using Socket.IO or ws.
2. Allow users to connect, choose a username, and join the chat.
3. Broadcast messages to all connected users in real time.
4. Display incoming messages in the chat UI.

### Part 3: Persisting Chat History (Bonus)

1. Store chat messages in Redis or a file/database.
2. When a user connects, load and display recent chat history.

### Part 4: Advanced Features (Optional)

- Support private messaging between users.
- Show online user list.
- Add message timestamps.
- Implement rate limiting or spam protection.

## Deliverables

- Node.js server code
- Static HTML/JS chat client
- Instructions for running and testing the app
- (Bonus) Redis integration for chat history

## Resources

- [Socket.IO Documentation](https://socket.io/docs/)
- [ws WebSocket Library](https://github.com/websockets/ws)
- [Express.js Documentation](https://expressjs.com/)
- [Redis npm package](https://www.npmjs.com/package/redis)

## Example UI

A simple chat box with a message input and a display area for messages.

---

**Tip:** Focus on getting real-time messaging working first, then add persistence and extra features as time allows.
