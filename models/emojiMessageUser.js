const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmojiMessageUser = sequelize.define('EmojiMessageUser', {
    emoji_message_user_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    message_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    emoji_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'emoji_message_user',
    timestamps: false
});

module.exports = EmojiMessageUser;
