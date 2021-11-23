#!/usr/bin/env node


// import fs from 'fs';
// import chalk from "chalk";

let fs = require("fs");
let boxen = require("boxen");
let yargs = require("yargs");
let axios = require("axios");

let lineReader = require('line-reader');
let readline = require('readline');
let Promise = require('bluebird');

var Fhir = require('fhir').Fhir;
var fhir = new Fhir();

// import boxen from "boxen";
// import yargs from "yargs";
// import axios frofm "axios";

const options = yargs
 .usage("Usage: -n <name>")
 .config({"url": "http://localhost:3000/baseR4/metadata"})
 .option("echo", { describe: "Echo", type: "string" })
 .option("fetch", { describe: "Fetch a URL" })
 .option("readfile", { describe: "Read file" })
 .option("validate", { describe: "Validate JSON file" })
 .option("stream", { describe: "Stream file and validate each line (NDJSON)" })
 .option("generate", { describe: "Generate sample NDJSON file." })
 .argv;


if(options.echo){
    const greeting = `${options.echo}!`;

    const boxenOptions = {
     padding: 1,
     margin: 1,
     borderStyle: "round",
     borderColor: "green",
     backgroundColor: "#555555"
    };
    const msgBox = boxen( greeting, boxenOptions );
    
    console.log(msgBox);    
}


if(options.fetch){
    axios.get(options.url, { headers: { Accept: "application/json" } })
    .then(res => {
      console.log(res.data);
    });   
}

// if(options.ping){
//     console.log(FhirFoundryUtilities.ping(options.ping))
// }

if(options.readfile){
    if(typeof options.readfile === "string"){
        fs.readFile(options.readfile, 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')
            console.log(data)
          })    
    }
}

if(options.validate){
    if(typeof options.validate === "string"){
        fs.readFile(options.validate, 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')

            let parsedData;
            if(typeof data === "string"){
                parsedData = JSON.parse(data);
            } else if(typeof data === "object"){
                parsedData = data;
            }
            
            let jsonObject = {};
            if(options["output"]){                
                fs.writeFile(options["output"], Buffer.from(JSON.stringify(jsonObject, null, 2)), err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })
            } else {
                console.log(jsonObject);
            }
          })    
    }
}
