// models/index.js
const sequelize = require('../config/database');

const User = require('./user');
const Room = require('./room');
const RoomUser = require('./roomUser');
const Message = require('./message');
const Emoji = require('./emoji');
const EmojiMessageUser = require('./emojiMessageUser');

// user ↔ room_user
User.hasMany(RoomUser, { foreignKey: 'user_id' });
RoomUser.belongsTo(User, { foreignKey: 'user_id' });

User.belongsToMany(Room, {
    through: RoomUser,
    foreignKey: 'user_id',
    otherKey: 'room_id',
    as: 'rooms'
});

// room ↔ room_user
Room.hasMany(RoomUser, { foreignKey: 'room_id' });
RoomUser.belongsTo(Room, { foreignKey: 'room_id' });

Room.belongsToMany(User, {
    through: RoomUser,
    foreignKey: 'room_id',
    otherKey: 'user_id',
    as: 'members'
});

// room_user ↔ message
RoomUser.hasMany(Message, { foreignKey: 'room_user_id' });
Message.belongsTo(RoomUser, { foreignKey: 'room_user_id' });

// message ↔ emoji_message_user
Message.hasMany(EmojiMessageUser, { foreignKey: 'message_id' });
EmojiMessageUser.belongsTo(Message, { foreignKey: 'message_id' });

// emoji ↔ emoji_message_user
Emoji.hasMany(EmojiMessageUser, { foreignKey: 'emoji_id' });
EmojiMessageUser.belongsTo(Emoji, { foreignKey: 'emoji_id' });

// user ↔ emoji_message_user
User.hasMany(EmojiMessageUser, { foreignKey: 'user_id' });
EmojiMessageUser.belongsTo(User, { foreignKey: 'user_id' });

// Optional: message ↔ room_user.last_read_message_id (optional one-to-one)
Message.hasMany(RoomUser, { foreignKey: 'last_read_message_id' });

module.exports = {
    sequelize,
    User,
    Room,
    RoomUser,
    Message,
    Emoji,
    EmojiMessageUser
};