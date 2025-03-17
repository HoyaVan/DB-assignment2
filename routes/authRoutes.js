const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { User, RoomUser, Room, Message, Emoji, EmojiMessageUser } = require("../models");
const {Op} = require("sequelize");

async function seedDefaultEmojis() {
    const existingEmojis = await Emoji.findAll();

    if (existingEmojis.length === 0) {
        await Emoji.bulkCreate([
            { name: 'heart', image: 'heart.png' },
            { name: 'laughing', image: 'laughing.png' },
            { name: 'thumbs_up', image: 'thumbs_up.png' }
        ]);
        console.log("Default emojis seeded.");
    } else {
        console.log("Emojis already exist.");
    }
}

seedDefaultEmojis();

const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Middleware to check if the user is logged in - if not send them to main page
function requireAuth(req, res, next) {
    console.log("Session Data:", req.session); 
    console.log("Session User:", req.session.user); 

    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }
    next();
}

// Home Page
router.get("/", (req, res) => {
    if (req.session.user) {
        res.send(`
            <div>Hello, ${escapeHtml(req.session.user.username)}!</div>
            <button onclick="window.location.href='/members'">Go to Members Area</button> <br>
            <button onclick="window.location.href='/logout'">Logout</button>
        `);
    } else {
        res.send(`
            <button onclick="window.location.href='/signup'">Sign up</button> <br>
            <button onclick="window.location.href='/login'">Log in</button>
        `);
    }
});

// Sign Up Route
router.get("/signup", (req, res) => {
    const errorMessage = req.query.error;
    res.send(`
    <form action="/signup" method="POST">
        <div>create user</div>

        <input type="text" name="username" placeholder="Username"><br>
        <input type="password" name="password" placeholder="Password"><br>

        ${errorMessage ? `<p>${errorMessage}</p>` : ""}
        
        <button type="submit">Sign Up</button>
    </form>
    `);
});

// Sign Up Route - used 'Sanitize' library to sanitize User Input
router.post("/signup", [
    check("username").trim().escape().notEmpty().withMessage("Username is required"),
    check("password").trim().notEmpty().withMessage("Password is required"),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.redirect(`/signup?error=${errors.array()[0].msg}`);
    }

    const { username, password } = req.body;

    // Sanitize username to prevent NoSQL injection
    const sanitizedUsername = String(username).replace(/[$.]/g, ""); 

    // Check if the user already exists (Using sanitized username)
    const existingUser = await User.findOne({ where: { username: sanitizedUsername } });

    if (existingUser) {
        return res.redirect('/signup?error=Username+already+exists');
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ username: sanitizedUsername, password_hash: hashedPassword });

    res.redirect("/login");
});

// Login Route
router.get("/login", (req, res) => {
    const errorMessage = req.query.error;
    res.send(`
        <form action="/login" method="POST">
            <input type="text" name="username" placeholder="Username"><br>
            <input type="password" name="password" placeholder="Password"><br>
            <button type="submit">Login</button>
        </form>
        ${errorMessage ? `<p>${errorMessage}</p>` : ""}
    `);
});

// LOGIN ROUTE
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    // Validate missing fields and redirect with query parameter for error message
    if (!username) {
        return res.redirect('/login?error=Please provide a username.');
    }
    if (!password) {
        return res.redirect('/login?error=Please provide a password.');
    }

    // Sanitize username to prevent NoSQL injection
    const sanitizedUsername = String(username).replace(/[$.]/g, "");

    try {
        const user = await User.findOne({ where: { username: sanitizedUsername } });

        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.user = { username: user.username };
            
            // Explicitly save session before redirecting
            req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.redirect("/login?error=Session+not+saved");
                }
                return res.redirect("/");
            });
        } else {
            return res.redirect('/login?error=Username and password not found');
        }
    } catch (error) {
        console.error(error);
        return res.redirect('/login?error=Something went wrong. Please try again.');
    }
});

// Members Page
router.get("/members", requireAuth, (req, res) => {
    const username =  escapeHtml(req.session.user.username);

    // Send HTML response with user's name
    res.send(`
        <div>Hello, ${escapeHtml(username)}.</div>
        <br>
        <form action="/group" method="GET">
            <button type="submit">Your chats</button>
        </form>
        <form action="/logout" method="GET">
            <button type="submit">Sign out</button>
        </form>
    `);
});

// your chats (managing page)
router.get("/group", async (req, res) => {

    const currentUsername = req.session.user.username;
    const currentUser = await User.findOne({ where: { username: currentUsername } });

    if (!currentUser) {
        return res.redirect("/login?error=User+not+found");
    }

    const userRoomLinks = await RoomUser.findAll({
        where: { user_id: currentUser.user_id }
    });

    const roomIds = userRoomLinks.map(ru => ru.room_id);

    const roomUsers = await RoomUser.findAll({
        where: { user_id: currentUser.user_id  }
    });

    const groups = await Room.findAll({
        where: { room_id: { [Op.in]: roomIds } }
    });

    const lastReadMap = {};
    for (const ru of roomUsers) {
        lastReadMap[ru.room_id] = ru.last_read_message_id || 0;
    }

    for (const group of groups) {
        // Get all room_user_ids for this group
        const roomUsersInGroup = await RoomUser.findAll({
            where: { room_id: group.room_id },
            attributes: ['room_user_id']
        });

        const roomUserIds = roomUsersInGroup.map(r => r.room_user_id);

        // Get last read message ID for current user in this group
        const userRoomLink = userRoomLinks.find(ru => ru.room_id === group.room_id);
        const lastReadId = userRoomLink?.last_read_message_id || 0;

        // Get datetime of that message (if any)
        let lastReadDate = null;
        if (lastReadId > 0) {
            const lastReadMsg = await Message.findOne({
                where: { message_id: lastReadId },
                attributes: ['sent_datetime']
            });
            lastReadDate = lastReadMsg?.sent_datetime;
        }

        // Count unread messages based on sent_datetime
        let unreadCount = 0;
        if (lastReadDate) {
            unreadCount = await Message.count({
                where: {
                    room_user_id: { [Op.in]: roomUserIds },
                    sent_datetime: { [Op.gt]: lastReadDate }
                }
            });
        }

        group.unreadCount = unreadCount;

        // Last message preview
        const lastMsg = await Message.findOne({
            where: { room_user_id: { [Op.in]: roomUserIds } },
            order: [['sent_datetime', 'DESC']]
        });

        group.text = lastMsg ? lastMsg.text : "No messages yet";
    }

    res.render("group", { groups });
});

router.get('/addGroup', requireAuth, async (req, res) => {
    const currentUsername = req.session?.user?.username;

    // Get the current user from DB
    const currentUser = await User.findOne({ where: { username: currentUsername } });

    // Get all users EXCEPT current user
    const users = await User.findAll({
        where: {
            user_id: { [Op.ne]: currentUser.user_id }
        }
    });

    const groups = await Room.findAll();

    res.render('newGroup', { users, groups });
});

router.post('/addGroup', async (req, res) => {

    const { groupName, users } = req.body;

    if (!groupName || !users) {
        // Redirect back to GET /addGroup with error
        return res.redirect('/addGroup?error=Group name and members are required');
    }

    // Ensure members is always an array
    const userArray = Array.isArray(users) ? users : users ? [users] : [];

    // Get session user
    const currentUsername = req.session.user?.username;
    const currentUser = await User.findOne({ where: { username: currentUsername } });

    // Include session user (auto-add creator)
    if (currentUser && !userArray.includes(currentUser.user_id.toString())) {
        userArray.push(currentUser.user_id);
    }

    // Create new group
    const newGroup = await Room.create({
        name: groupName,
        start_datetime: new Date()
    });

    // Create associations
    const RoomUser = require("../models/roomUser");

    // Map associations
    const roomUsers = userArray.map(userId => ({
        room_id: newGroup.room_id,
        user_id: userId
    }));

    await RoomUser.bulkCreate(roomUsers); // Better than individual `create` calls

    res.redirect('/group');
});

// to view messages + reactions
router.get("/chat/:roomId", requireAuth, async (req, res) => {
    const roomId = req.params.roomId;

    // Get username from session
    const currentUsername = req.session?.user?.username;
    if (!currentUsername) {
        console.error("Session missing username.");
        return res.redirect("/login?error=Missing+session+username");
    }

    // Get user from DB using the username
    const currentUser = await User.findOne({ where: { username: currentUsername } });
    if (!currentUser || !currentUser.user_id) {
        return res.redirect("/login?error=User+not+found+in+DB");
    }

    // Get all users
    const allUsers = await User.findAll();

    // Get users already in the room
    const roomUsers = await RoomUser.findAll({
        where: { room_id: roomId },
        include: [{ model: User, Emoji }]
    });

    // Extract user_ids of users already in the room - user_ids for invitation filtering
    const roomUserIds = roomUsers.map(ru => ru.user_id);

    // Filter only users who are NOT already in the room
    const userList = allUsers.filter(user => !roomUserIds.includes(user.user_id));

    //  these are for message lookup
    const roomUserRecordIds = roomUsers.map(ru => ru.room_user_id);

    // // Find the RoomUser record for current user
    // const currentUserRoomUser = roomUsers.find(ru => ru.user_id === currentUser.user_id);
    // const lastReadId = currentUserRoomUser?.last_read_message_id || 0;

    // Get last read message ID for the current user
    const currentRoomUser = await RoomUser.findOne({
        where: { user_id: currentUser.user_id, room_id: roomId }
    });
    const lastReadMessageId = currentRoomUser?.last_read_message_id || 0;

    const message = await Message.findAll({
        where: { room_user_id: { [Op.in]: roomUserRecordIds  } },
        include: [{ model: RoomUser, include: [User] },
            {model: EmojiMessageUser, // this should be your reaction table model
                include: [User, Emoji] }], // so you can show who reacted
        order: [['sent_datetime', 'ASC']]
    });

    // Mark the first unread message
    let unreadStarted = false;
    message.forEach(msg => {
        if (!unreadStarted && msg.message_id > lastReadMessageId) {
            msg.isUnreadStart = true;
            unreadStarted = true;
        }
    });

    // Get latest message in this room
    const latestMessage = await Message.findOne({
        where: { room_user_id: { [Op.in]: roomUsers.map(r => r.room_user_id) } },
        order: [['sent_datetime', 'DESC']]
    });

    if (latestMessage) {
        await RoomUser.update(
            { last_read_message_id: latestMessage.message_id },
            { where: { user_id: currentUser.user_id, room_id: roomId } }
        );
    }

    // Load all messages in this room
    const room = await Room.findOne({ where: { room_id: roomId } });

    const emojiList = await Emoji.findAll();

    // Add emoji summary + categorize read/unread
    const readMessages = [];
    const unreadMessages = [];

    message.forEach(msg => {
        const emojiMap = {};

        if (msg.EmojiMessageUsers && msg.EmojiMessageUsers.length > 0) {
            msg.EmojiMessageUsers.forEach(reaction => {
                const emojiName = reaction.Emoji?.name;
                if (!emojiName) return;

                if (!emojiMap[emojiName]) {
                    emojiMap[emojiName] = { count: 0, reactedByUser: false };
                }
                emojiMap[emojiName].count++;

                if (reaction.User.username === currentUsername) {
                    emojiMap[emojiName].reactedByUser = true;
                }
            });
        }

        msg.reactionSummary = emojiMap;

        // Separate based on last read message ID
        if (msg.message_id <= lastReadMessageId) {
            readMessages.push(msg);
        } else {
            unreadMessages.push(msg);
        }

    });

    // pass it to ejs
    res.render("chat", { room, readMessages, unreadMessages, userList, emojiList });
});


router.post('/inviteUsers/:roomId', requireAuth, async (req, res) => {
    const roomId = req.params.roomId;
    const selectedUserIds = req.body.users; // This is an array of user_id values from checkboxes

    // If no users selected, redirect with error
    if (!selectedUserIds || selectedUserIds.length === 0) {
        return res.redirect(`/chat/${roomId}?error=Please+select+at+least+one+user`);
    }

    // Ensure it's always an array
    const userIds = Array.isArray(selectedUserIds) ? selectedUserIds : [selectedUserIds];

    // Check existing users in room (to avoid duplicate entries)
    const existingRoomUsers = await RoomUser.findAll({
        where: { room_id: roomId, user_id: { [Op.in]: userIds },
            last_read_message_id: null // or 0 if your system expects a number
        }
    });

    const alreadyInRoomUserIds = existingRoomUsers.map(ru => ru.user_id);

    // Filter only new users to be added
    const newUserIds = userIds.filter(uid => !alreadyInRoomUserIds.includes(parseInt(uid)));

    // Add new users to the room_user table
    const newRoomUserEntries = newUserIds.map(userId => ({
        room_id: roomId,
        user_id: userId
    }));

    if (newRoomUserEntries.length > 0) {
        await RoomUser.bulkCreate(newRoomUserEntries);
    }

    res.redirect(`/chat/${roomId}`);
});

//  to send a message
router.post("/sendMessage/:roomId", requireAuth, async (req, res) => {
    const roomId = req.params.roomId;
    const { text } = req.body;

    const currentUsername = req.session.user.username;
    const user = await User.findOne({ where: { username: currentUsername } });

    // Step 1: Check if the user is part of the room
    const roomUser = await RoomUser.findOne({
        where: {
            room_id: roomId,
            user_id: user.user_id
        }
    });

    if (!roomUser) {
        return res.redirect(`/chat/${roomId}?error=You+are+not+a+member+of+this+room`);
    }

    // Step 2: Create the new message
    const newMessage = await Message.create({
        text,
        room_user_id: roomUser.room_user_id,
        sent_datetime: new Date()
    });

    // Step 3: Update user's last_read_message_id to this new message
    roomUser.last_read_message_id = newMessage.message_id;
    await roomUser.save();

    // Step 4: Redirect back to chat
    res.redirect(`/chat/${roomId}`);
});

// to react with an emoji
router.post("/react/:messageId", requireAuth, async (req, res) => {
    const messageId = req.params.messageId;
    const { emoji_name } = req.body;

    const currentUsername = req.session.user.username;
    const user = await User.findOne({ where: { username: currentUsername } });

    const emoji = await Emoji.findOne({ where: { name: emoji_name } });
    if (!emoji) return res.status(400).send("Emoji not found");

    // Check if user already reacted to this message with this emoji
    const existingReaction = await EmojiMessageUser.findOne({
        where: {
            message_id: messageId,
            user_id: user.user_id,
            emoji_id: emoji.emoji_id
        }
    });

    if (existingReaction) {
        // If already exists, remove (toggle off)
        await existingReaction.destroy();
    } else {
        // If not exists, create it
        await EmojiMessageUser.create({
            message_id: messageId,
            user_id: user.user_id,
            emoji_id: emoji.emoji_id
        });
    }

    // Redirect back to the chat
    const roomUser = await RoomUser.findOne({
        where: { user_id: user.user_id, room_id: { [Op.ne]: null } }
    });

    res.redirect(`/chat/${roomUser.room_id}`);
});


// Logout
router.get("/logout", (req, res) => {

    console.log("Before destroy - session:", req.session);

    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.redirect("/?error=Logout+failed");
        }
        res.clearCookie("connect.sid"); // Explicitly clear cookie
        res.redirect("/");
    });
});

module.exports = router;