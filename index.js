const express = require("express"),
    http = require('http'),
    app = express(),
    router = express.Router(),
    cors = require('cors'),
    WebSocket = require('ws'),
    server = http.createServer(app),
    refuseSocketConnection = require("./controllers/helpers/authFunctions/refuseSocketConnection"),
    broadcastMessage = require("./controllers/helpers/websocket/broadcastMessage"),
    {refreshRedisSet, updateRedisSet, getRedisSet, deleteRedisHashKey, updateRedisHash, getRedisHash, refreshRedisHash} = require("./db/redis/redis"),
    ditchGame = require("./controllers/helpers/websocket/ditchGame"),
    parseMessage = require("./controllers/helpers/websocket/parseMassage"),
    {initializeApp, applicationDefault} = require('firebase-admin/app'),
    {getAuth} = require('firebase-admin/auth'),
    admin = require('firebase-admin'),
    isProduction = process.env.NODE_ENV === "production";

require("dotenv").config()

initializeApp({
    credential: applicationDefault(),
    databaseURL: "https://paper-battleships-default-rtdb.europe-west1.firebasedatabase.app"
});

app.use('/', router)

router.use(cors({
    origin: isProduction
        ? "https://paper-battleships-game-server.herokuapp.com"
        : "http://localhost:3000",
    credentials: true,
}))

router.get('/', (req, res) => res.send('WS Server!'))

const webSocketServer = new WebSocket.Server({server})

webSocketServer.on('connection', async (ws, req) => {
    ws.isAlive = true
    const gameRequests = []

    const online = await getRedisSet('online')
    const games = await getRedisHash('games')

    for (let key in games) {
        const uid = JSON.parse(key)
        gameRequests.push(uid, JSON.parse(games[key]))
    }

    ws.send(JSON.stringify({online, gameRequests}))

    ws.on('pong', () => ws.isAlive = true)

    ws.on('message', (message) => {
        const {errors, type, description, host, rivalName, rivalUid, token} = parseMessage(message)

        if (!token) return refuseSocketConnection(ws)

        getAuth().verifyIdToken(token).then(async (user) => {
            const {name, uid} = user

            if (errors) return ws.send(JSON.stringify({errors}))

            if (type === 'create-game') {
                await updateRedisHash('games', [uid, {name, description, time: new Date()}])
                const games = await getRedisHash('games')
                const gameRequests = []

                for (let key in games) {
                    const uid = JSON.parse(key)
                    gameRequests.push(uid, JSON.parse(games[key]))
                }

                broadcastMessage(webSocketServer, {gameRequests})
            }

            if (type === 'cancel-game') {
                await deleteRedisHashKey('games', uid)

                const games = await getRedisHash('games')
                const gameRequests = []

                for (let key in games) {
                    const uid = JSON.parse(key)
                    gameRequests.push(uid, JSON.parse(games[key]))
                }

                broadcastMessage(webSocketServer, {gameRequests})
            }

            if (type === 'join-game') {
                try {
                    const db = admin.firestore()
                    const hostRef = db.collection('games').doc(host)
                    const clientRef = db.collection('games').doc(uid)

                    const hostStatisticRef = db.collection('statistic').doc(host)
                    const clientStatisticRef = db.collection('statistic').doc(uid)

                    await db.runTransaction(async transaction => {
                        try {
                            const hostStatisticDoc = await transaction.get(hostStatisticRef)
                            const clientStatisticDoc = await transaction.get(clientStatisticRef)

                            if (!hostStatisticDoc.data()) {
                                transaction.set(hostStatisticRef, {gamesPlayed: 0, wins: 0})
                            }
                            if (!clientStatisticDoc.data()) {
                                transaction.set(clientStatisticRef, {gamesPlayed: 0, wins: 0})
                            }

                            const randomPlayer = Math.floor(Math.random() * 2)

                            transaction.set(hostRef, {
                                host: null,
                                client: uid,
                                rivalName: name,
                                isEditable: true,
                                isMoving: !!randomPlayer
                            })

                            transaction.set(clientRef, {
                                host,
                                client: null,
                                rivalName,
                                isEditable: true,
                                isMoving: !randomPlayer
                            })
                        } catch (error) {
                            console.error(error.message)
                            ws.send(JSON.stringify({errors: [error.message]}))
                        }
                    })

                    await deleteRedisHashKey('games', host)
                    const games = await getRedisHash('games')

                    const gameRequests = []

                    for (let key in games) {
                        const uid = JSON.parse(key)
                        gameRequests.push(uid, JSON.parse(games[key]))
                    }

                    broadcastMessage(webSocketServer, {gameRequests})
                } catch (error) {
                    console.error(error.message)
                    ws.send(JSON.stringify({errors: [error.message]}))
                }
            }

            if (type === 'ditch-game') {
                try {
                    await ditchGame(uid)
                } catch (error) {
                    console.error(error.message)
                    ws.send(JSON.stringify({errors: [error.message]}))
                }
            }

            if (type === 'ditch-game-request') {
                let isRivalOnline = false
                try {
                    webSocketServer.clients.forEach(ws => {
                        const user = ws._socket.user
                        if (!user) return

                        const {uid} = user

                        if (uid === rivalUid) {
                            isRivalOnline = true
                            ws.send(JSON.stringify({type: 'game'}))
                        }
                    })

                    if (!isRivalOnline) await ditchGame(uid)
                } catch (error) {
                    console.error(error.message)
                    ws.send(JSON.stringify({errors: [error.message]}))
                }
            }

        }).catch((error) => {
            ws.send(JSON.stringify({errors: [error.message]}))
        })
    });
})

server.on('upgrade', (req, socket, head) => {
    const token = (req.headers['sec-websocket-protocol']);

    if (!token) return refuseSocketConnection(socket)

    getAuth().verifyIdToken(token).then(user => {
        socket.user = user

        updateRedisSet('online', user.uid)
    }).catch((e) => {
        refuseSocketConnection(socket)
        console.log(e.message)
    })
})

setInterval(async () => {
    const onlineSet = new Set()
    const gameRequests = []

    webSocketServer.clients.forEach((ws) => {
        const user = ws._socket.user
        if (!user) return

        const {uid} = user

        if (!ws.isAlive) return ws.terminate()

        onlineSet.add(uid);

        ws.isAlive = false
        ws.ping()
    })

    const games = await getRedisHash('games')
    const online = [...onlineSet]

    for (let key in games) {
        const uid = JSON.parse(key)
        if (online.includes(uid)) gameRequests.push(uid, JSON.parse(games[key]))
    }

    await refreshRedisSet('online', online)

    await refreshRedisHash('games', gameRequests)

    broadcastMessage(webSocketServer, {online, gameRequests})
}, 30000)

server.listen(+process.env.PORT || 4000, () => {
    console.log(`Server started on port ${server.address().port}.`)
})