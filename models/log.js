const mongoose = require("mongoose");
const { ObjectId, Timestamp } = require("mongodb");


const LogSchema = new mongoose.Schema(
  {
    account: {type: String, required: true},
    timestamp: {type: Date, required: true},
    event: {type: ObjectId, required: true}
  },
  { collection: "log" }
);


const model = mongoose.model("LogSchema", LogSchema);
module.exports = model;
