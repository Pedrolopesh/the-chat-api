const express = require('express');
const router = express.Router();

const UserController = require('../Controllers/UserController');
const ChatController = require('../Controllers/ChatController');

const authMiddleware = require('../middlewares/auth');

// STATUS SERVER
router.get('/', (req, res) => {
    res.send('Server is runing')
    console.log('Server ok')
});

router.route('/signup').post(UserController.create);
router.route('/login').post(UserController.login);


router.route('/list/users').get(UserController.index);
// router.use(authMiddleware).route('/list/users').get(UserController.index);
router.use(authMiddleware).route('/update/user').put(UserController.update);
router.use(authMiddleware).route('/user/:id').get(UserController.find);
router.use(authMiddleware).route('/upload/user/image').patch(UserController.upLoadUserImage);

// CREATE MESSAGE
router.use(authMiddleware).route('/create/chat').post(ChatController.create);

// SEND MESSAGE
router.use(authMiddleware).route('/send/message').put(ChatController.sendMessage);

// LIST CHATS
router.use(authMiddleware).route('/list/chats').get(ChatController.index);

// GET CHAT ID
router.use(authMiddleware).route('/chat/messages/:id').get(ChatController.listMessageChatbById);

// GET CHAT ID
router.use(authMiddleware).route('/user/chats/:id').get(ChatController.listChatConections);

module.exports = router;