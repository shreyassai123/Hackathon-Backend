require('dotenv').config();
const Event = require('./models/event');

const express = require('express');
const mongoose = require('mongoose');
const Moralis = require('moralis/node');
const cors = require("cors");
const Web3 = require('web3');

const {tokenAbi, marketplaceAbi} = require('./abi');

const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.NODE_URL)
  );

const marketplaceContract = new web3.eth.Contract(marketplaceAbi, process.env.MARKETPLACE_ADDRESS);
const tokenContract = new web3.eth.Contract(tokenAbi, process.env.TOKEN_ADDRESS);
const mongoString = process.env.DATABASE_URL;

const serverUrl = process.env.MORALIS_SERVER_URL;
const appId = process.env.MORALIS_APP_ID;
const masterKey = process.env.MORALIS_MASTER_KEY;

mongoose.connect(mongoString);
const database = mongoose.connection;

database.on('error', (error) => {
    console.log(error)
})

Moralis.start({ serverUrl, appId, masterKey }).then(()=>{
    console.log("Moralis connected")
})

database.once('connected', () => {
    console.log('Database Connected');
})
const app = express();

app.use(cors());

app.use(express.json());

app.listen(6969, () => {
    console.log(`Server Started at ${6969}`)
})

app.get('/api/getEvents', async (req, res)=>{
    try {
        if(!req.query.url){
            const events = await Event.find().lean();
        const finalEvents = [];

        await Promise.all(events.map(async (event)=>{
            const available = await tokenContract.methods.balanceOf(process.env.MARKETPLACE_ADDRESS, event.tokenId).call()
            finalEvents.push( {available: available, ...event})
        }))
        res.send({"events": finalEvents});
        } else {
            const event = await Event.findOne({url: req.query.url}).lean();
            const available = await tokenContract.methods.balanceOf(process.env.MARKETPLACE_ADDRESS, event.tokenId).call()
            res.send({...event, available: available});
        }
        
    } catch {
        res.status(400);
        res.send({status: "error"});
    }
})

app.post('/api/addEvent', async (req, res)=>{
    try {
        await Event.insertMany([req.body]);
        res.send({status: "ok"});
    } catch(e) {
        console.log(e)
        res.status(400);
        res.send({status: "error"});
    }
})

app.get("/api/getNFTs", async (req, res) => {
    try {
      const options = {
        chain: "matic",
        address: req.query.account,
        token_address: process.env.TOKEN_ADDRESS,
      };
      const nfts = await Moralis.Web3API.account.getNFTsForContract(options);
      const finalNfts = await Promise.all(nfts.result.map(async (nft) => {
        const response = await fetch(nft.token_uri);
        const metadata = await response.json()
        return {...nft, metadata: metadata}
      }))
      res.send(finalNfts);
    } catch (e) {
      console.log(e)
      res.status(400);
      res.json({ status: "error" });
    }
  });