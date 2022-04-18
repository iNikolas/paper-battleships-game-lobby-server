const admin = require('firebase-admin');

const ditchGame = async (uid) => {
    const db = admin.firestore()
    const batch = db.batch()
    const playersRef = [db.collection('games').doc(uid)]
    const gameDataSnapshot = await playersRef[0].get()
    const {client, host} = gameDataSnapshot.data()
    playersRef.push(db.collection('games').doc(client || host))

    playersRef.forEach(ref => batch.delete(ref))
    await batch.commit()
}

module.exports = ditchGame