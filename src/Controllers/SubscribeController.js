const User = require("../database/models/User");
const webpush = require('web-push');
const Subscribe = require("../database/models/Subscribe");
const keys = require('../config/keys')

const publicVapidKey = process.env.PUBLIC_KEY_WEBPUSH || keys.PUBLIC_KEY_WEBPUSH;
const privateVapidKey = process.env.PRIVATE_KEY || keys.PRIVATE_KEY;

webpush.setVapidDetails('mailto:test@code.co.uk', publicVapidKey || '', privateVapidKey || '' )

module.exports = {
    async subscribewebpush(req, res) {

        const { subscribeData, user_id } = req.body;
        const newSubscription = new Subscribe({
            credentials: JSON.stringify(subscribeData),
            user: user_id,
            active: true
        })
        newSubscription.save();

        const user = await User.findByIdAndUpdate(user_id, {
            subscription: newSubscription._id
        }).catch(err => { console.log(err); res.send({ success: false, error: 'error on update user', data: err }) })

        if(user) { console.log(user) }
        const payload = 'Registrado para receber notificações.'
        webpush.sendNotification(subscribeData, payload).catch((err) => console.log(err))
        res.status(200).send({ sucess: true, message: 'subscription created in user'})
    },

    async sendNotification(req, res) {
        const { user_id } = req.body

        const user = await User.findById({ _id: user_id}).populate('subscription')
        .catch(err => { console.log(err); res.send({ success: false, error: "can't find user", data: err }) })

        // const credentials = JSON.parse(user.subscribe)
        console.log(user)
        const credentials = await user.subscription.credentials
        const payload = 'TESTE DE ENVIO DE MENSAGEM'

        console.log('credentials', JSON.parse(credentials) )

        await webpush.sendNotification(JSON.parse(credentials), payload)
        .then(resp => { console.log('NOTIFICAÇÂO', resp) })
        .catch(err => { console.log('error', err) })
        res.status(200).send({ sucess: true, message: 'Notification sended...'})
    }
}