const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
    message_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    room_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sent_datetime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'message',
    timestamps: false
});

module.exports = Message;
