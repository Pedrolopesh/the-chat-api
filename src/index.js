const express = require('express');
const routes = require('./routes/index.js');
const port = process.env.PORT || 3333;
const bodyparser = require('body-parser');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary');
const cors = require('cors');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server)
const webpush = require('web-push');
require('dotenv').config()

const publicVapidKey = process.env.PUBLIC_KEY_WEBPUSH;
const privateVapidKey = process.env.PRIVATE_KEY;
webpush.setVapidDetails('mailto: pedrolopeshls99@gmail.com', publicVapidKey, privateVapidKey)

app.use(bodyparser.json())

//Upload Files
app.use(fileUpload({
    useTempFiles: true
}));

cloudinary.config({
    cloud_name:process.env.CLOUDINARY_NAME.cloudinary_name,
    api_key:process.env.CLOUDINARY_API_KEY.cloudinary_API_Key,
    api_secret:process.env.CLOUDINARY_API_SECRET.cloudinary_API_Secret
})

io.on('connection', socket => {

    let message = []
    socket.on('sendMessage', data => {
        message.push(data)
        socket.broadcast.emit('messageRecived', data)
    })
})

app.use(cors());

server.listen(port, () => {
    console.log('Server started at port ' + `http://localhost:${port}/api/`)
});

app.use('/api', routes);