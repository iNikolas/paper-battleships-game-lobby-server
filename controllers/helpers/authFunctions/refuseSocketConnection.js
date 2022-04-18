const refuseSocketConnection = (socket) => {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
}

module.exports = refuseSocketConnection