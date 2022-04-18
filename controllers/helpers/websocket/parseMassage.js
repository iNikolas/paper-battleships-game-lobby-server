const parseMessage = (message) => {
    try {
        return JSON.parse(message)
    } catch (error) {
        return {errors: [error.message]}
    }
}

module.exports = parseMessage