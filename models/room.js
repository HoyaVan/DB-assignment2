const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
    room_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    start_datetime: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'room',
    timestamps: false
});

module.exports = Room;
