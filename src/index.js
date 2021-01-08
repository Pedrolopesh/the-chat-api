const express = require('express');
const routes = require('./routes/index.js');
const port = process.env.PORT || 3333;
const bodyparser = require('body-parser');
const fileUpload = require('express-fileupload');
const keys = require('./config/keys');
const cloudinary = require('cloudinary');
const cors = require('cors');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server)

app.use(bodyparser.json())

//Upload Files
app.use(fileUpload({
    useTempFiles: true
}));

cloudinary.config({
    cloud_name:keys.cloudinary_name,
    api_key: keys.cloudinary_API_Key,
    api_secret: keys.cloudinary_API_Secret
})

io.on('connection', socket => { 
    console.log(`Socket conectado: ${socket.id}`)

    let message = []
    socket.on('sendMessage', data => {
        message.push(data)
        socket.broadcast.emit('messageRecived', data)
        console.log(data)
    })
})

app.use(cors());

server.listen(port, () => {
    console.log('Server started at port ' + port)
});

app.use('/api', routes);