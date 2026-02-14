const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Log = sequelize.define(
  "Log",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    action: {
      type: DataTypes.ENUM("OPEN", "CLOSE", "STOP"),
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM("APP", "SCHEDULED"),
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
  }
);

// Set up association
Log.belongsTo(User, { foreignKey: "userId" });

module.exports = Log;
