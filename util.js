function sleep(mseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, mseconds);
    });
}

module.exports = {
    sleep,
};
