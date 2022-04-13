require('dotenv').config();
const Event = require('./models/event');
const Log = require('./models/log');

const express = require('express');
const mongoose = require('mongoose');
const Moralis = require('moralis/node');
const cors = require("cors");
const fetch = require("node-fetch");
const Web3 = require('web3');
const IPFSGatewayTools = require("@pinata/ipfs-gateway-tools/dist/node");

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


app.post('/api/checkInUser', async (req, res)=>{
    try {
        const signature = req.body.signature;
        const code = req.body.code;

        var hash = Web3.utils.sha3(code);
        var signing_address = await web3.eth.accounts.recover(hash, signature);

        const event = await Event.findById(code);

        const balance = await tokenContract.methods.balanceOf(signing_address, event.tokenId).call();
        if(balance > 0){
            const log = {
                account: signing_address,
                eventId: event._id,
                timestamp: new Date(Date.now())
            }

            await Log.insertMany([log])
            res.send({status: "ok"});
        } else {
            res.status(400);
            res.send({status: "error"})
        }

    } catch {
        res.status(400);
        res.send({status: "error"});
    }
})

app.get('/api/getLogs', async (req, res)=>{
    try {
        const logs = await Log.find({account: req.query.account}).lean();

        const finalLogs =[];
         await Promise.all(logs.map(async (log)=>{
            const event = await Event.findById(log.eventId).lean()
            return finalLogs.push({...log, event: event});
        }))
        res.send({"logs": finalLogs});

    } catch {
        res.status(400);
        res.send({status: "error"});
    }
})

app.get("/api/getNFTs", async (req, res) => {
    try {
      const options = {
        chain: "0x13881",
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