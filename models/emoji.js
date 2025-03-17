const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Emoji = sequelize.define('Emoji', {
    emoji_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    image: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    tableName: 'emoji',
    timestamps: false
});

module.exports = Emoji;
