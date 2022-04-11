const mongoose = require("mongoose");
const Web3 = require('web3');
const fetch = require("node-fetch");
const {tokenAbi, marketplaceAbi} = require('../abi');

const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.NODE_URL)
  );

const marketplaceContract = new web3.eth.Contract(marketplaceAbi, process.env.MARKETPLACE_ADDRESS);
const tokenContract = new web3.eth.Contract(tokenAbi, process.env.TOKEN_ADDRESS);
const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    avatarSrc: { type: String, required: true },
    coverSrc: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    item: {
      type: Number,
      required: true,
      unique: true,
      validate: [checkItem, "Enter a valid item ID"],
    },
    metadata: { type: Object, required: true },
    totalSupply: { type: Number, required: true },
    price: { type: String, required: true },
  },
  { collection: "events" }
);

async function checkItem(val) {
    try {
        if(val > 0){
        const item = await marketplaceContract.methods.getItem(val).call();
        if(val == item.itemId){
            const tokenId = item.tokenId;
            const nft = await tokenContract.methods.uri(tokenId).call();
            const response = await fetch(nft);
            const metadata = await response.json();
            this.metadata = metadata;
            const totalSupply = await tokenContract.methods.totalSupply(tokenId).call();
            this.totalSupply = totalSupply;
            this.price = item.price;
        }
        } else {
            return false
        }
    } catch(e) {
        console.log(e)
        return false;
    }
    
}

const model = mongoose.model("EventSchema", EventSchema);
module.exports = model;
