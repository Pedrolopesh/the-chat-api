module.exports = {
    async subscribewebpush(req, res) {
        const subscription = req.body;
        res.status(201).send({ sucess: true, message: 'subscription created'})

        const payload = JSON.stringify({ title: 'Push test' })
        webpush.sendNotification(subscription, payload).catch((err) => console.log(err))

    }
}