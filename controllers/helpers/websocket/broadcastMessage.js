const broadcastMessage = (webSocketServer, msgAsObj) => {
    webSocketServer.clients.forEach(client => client.send(JSON.stringify(msgAsObj)))
}

module.exports = broadcastMessage