const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Schedule = sequelize.define(
  "Schedule",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    action: {
      type: DataTypes.ENUM("OPEN", "CLOSE", "STOP"),
      allowNull: false,
    },
    cronTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
  }
);

// Set up association
Schedule.belongsTo(User, { foreignKey: "userId" });

module.exports = Schedule;
