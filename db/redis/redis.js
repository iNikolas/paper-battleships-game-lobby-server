const Redis = require("redis"),
    isProduction = process.env.NODE_ENV === "production",
    client = Redis.createClient(
        isProduction ? {url: process.env.REDIS_URL} : {}
    );

(async () => {
    client.on("connect", () => console.log("::> Redis Client Connected"));
    client.on("error", (err) => console.log("<:: Redis Client Error", err));

    await client.connect();
})();

module.exports = {
    refreshRedisSet: async (key, value) => {
        try {
            await client.DEL(key)
            await client.SADD(key, ...value);
        } catch (error) {
            console.error(error);
        }
    },
    refreshRedisHash: async (hash, dataAsArr) => {
        try {
            if (!dataAsArr.length) return

            const data = dataAsArr.map(entry => JSON.stringify(entry))

            await client.DEL(hash)
            await client.hSet(hash, data);
        } catch (error) {
            console.error(error);
        }
    },
    updateRedisHash: async (hash, dataAsArr) => {
        try {
            const data = dataAsArr.map(entry => JSON.stringify(entry))
            await client.hSet(hash, ...data)
        } catch (error) {
            console.error(error)
        }
    },
    deleteRedisHashKey: async (hash, key) => {
        try {
            await client.hDel(hash, JSON.stringify(key))
        } catch (error) {
            console.error(error)
        }
    },
    updateRedisSet: async (key, value) => {
        try {
            await client.SADD(key, value)
        } catch (error) {
            console.error(error)
        }
    },
    updateRedisList: async (key, value) => {
        try {
            await client.RPUSH(key, JSON.stringify(value))
            await client.LTRIM(key, -100, -1)
        } catch (error) {
            console.error(error)
        }
    },
    getRedisSet: async (key) => {
        try {
            return await client.SMEMBERS(key)
        } catch (error) {
            console.log(error)
            return []
        }
    },
    getRedisList: async (key) => {
        try {
            return await client.LRANGE(key, 0, 99)
        } catch (error) {
            console.log(error)
            return []
        }
    },
    getRedisHash: async (hash) => {
        try {
            return await client.HGETALL(hash)
        } catch (error) {
            console.log(error)
            return {}
        }
    }
}