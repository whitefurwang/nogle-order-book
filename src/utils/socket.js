export default function Socket(endpoint, { request, onMessage }) {
  const socket = new WebSocket(endpoint);

  socket.onopen = () => {
    if (request) {
      socket.send(JSON.stringify(request))
    }
  }
  
  socket.onmessage = (event) => {
    onMessage(JSON.parse(event.data).data);
  }

  return socket
}
