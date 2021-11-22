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

// import add from "./sum.mjs"; //ES6 import
// import { FhirFoundryUtilities } from 'bento-box-npm/bundle.js'; // works when distributed via npm
let { FhirFoundryUtilities } = require('bento-box-npm/dist/bundle.js');

const options = yargs
 .usage("Usage: -n <name>")
 .config({"url": "http://localhost:3000/baseR4/metadata"})
 .option("name", { describe: "Your name", type: "string" })
 .option("fetch", { describe: "Fetch a URL" })
 .option("operator", { describe: "Add two numbers together (a,b)", type: "string" })
 .option("a", { describe: "First", type: "number" })
 .option("b", { describe: "Second", type: "number" })
 .option("ping", { describe: "Ping" })
 .option("readfile", { describe: "Read file" })
 .option("sequencediagram", { describe: "Generate sequence diagram text" })
 .option("generate-fhir-from-sequence", { describe: "Generate FHIR resources from sequence diagram" })
 .option("generate-settings", { describe: "Generate settings file for Node on FHIR" })
 .option("convert-to-json", { describe: "Convert file from XML to JSON" })
 .argv;


if(options.operator){
    switch (options.operator) {
        case "add":
            if(options.a && options.b){
                console.log('add!', FhirFoundryUtilities.add(options.a, options.b)) 
            }
            break;
        default:
            break;
    }
           
}

if(options.name){
    const greeting = `Hello, ${options.name}!`;

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

if(options.ping){
    console.log(FhirFoundryUtilities.ping(options.ping))
}

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

if(options.sequencediagram){
    if(typeof options.sequencediagram === "string"){
        fs.readFile(options.sequencediagram, 'utf8' , (err, data) => {
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


            // const boxenOptions = {
            //     padding: 1,
            //     margin: 1,
            //     borderStyle: "round",
            //     borderColor: "green"
            //    };
            // const msgBox = boxen(FhirFoundryUtilities.generateWebSequenceDiagramFile(parsedData), boxenOptions );
               
            // console.log(msgBox); 
            
            if(options["output"]){
                fs.writeFile(options["output"], Buffer.from(JSON.stringify(FhirFoundryUtilities.generateWebSequenceDiagramFile(parsedData), null, 2)), err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                    //file written successfully
                    })
            } else {
                console.log(FhirFoundryUtilities.generateWebSequenceDiagramFile(parsedData));
            }
          })    
    }
}


if(options["generate-fhir-from-sequence"]){
    if(typeof options["generate-fhir-from-sequence"] === "string"){
        fs.readFile(options["generate-fhir-from-sequence"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')

            let parsedData;

            const boxenOptions = {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "green"
               };

            if(typeof data === "string"){
                // apparently not, lets parse it like a sequence diagram file
                //parsedData = data;
                
                let resultsArray = [];
                //Without new Promise, this throwing will throw an actual exception
                var eachLine = Promise.promisify(lineReader.eachLine);
                eachLine(options["generate-fhir-from-sequence"], function(line) {
                    console.log('line: ' + line);
                    if(line.length > 0){
                        resultsArray.push(line);                                                
                    }
                }).then(function() {
                    if(options["output"]){
                        fs.writeFile(options["output"], Buffer.from(JSON.stringify(FhirFoundryUtilities.parseSequenceDiagramIntoBundle(resultsArray), null, 2)), err => {
                            if (err) {
                                console.error(err)
                                return
                            }
                            //file written successfully
                            })
                    } else {
                        console.log(FhirFoundryUtilities.parseSequenceDiagramIntoBundle(resultsArray));
                    }
                }).catch(function(err) {
                    console.error(err);
                });
            }
          })    
    }
}


if(options["generate-settings"]){
    if(typeof options["generate-settings"] === "string"){
        fs.readFile(options["generate-settings"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')

            let parsedData;
            let msgBox = "";

            let boxenOptions = {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "green"
               };

            
            if(typeof data === "string"){
                // apparently not, lets parse it like a sequence diagram file
                //parsedData = data;
                
                let resultsArray = [];
                //Without new Promise, this throwing will throw an actual exception
                var eachLine = Promise.promisify(lineReader.eachLine);
                eachLine(options["generate-settings"], function(line) {
                    console.log('line: ' + line);
                    if(line.length > 0){
                        resultsArray.push(line);                                                
                    }
                }).then(function() {
                    if(options["output"]){
                        fs.writeFile(options["output"], Buffer.from(JSON.stringify(FhirFoundryUtilities.parseSequenceDiagramIntoSettingsFile(resultsArray), null, 2)), err => {
                            if (err) {
                                console.error(err)
                                return
                            }
                            //file written successfully
                            })
                    } else {
                        console.log(FhirFoundryUtilities.parseSequenceDiagramIntoSettingsFile(resultsArray));
                    }
                }).catch(function(err) {
                    console.error(err);
                });
            }
          })    
    }
}


if(options["convert-to-json"]){
    if(typeof options["convert-to-json"] === "string"){
        fs.readFile(options["convert-to-json"], 'utf8' , (err, xml) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')

            let boxenOptions = {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "green"
               };

            console.log('xml', xml)
            var json = fhir.xmlToJson(xml);
            console.log('json', json)

            if(options["output"]){
                fs.writeFile(options["output"], json, err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                    //file written successfully
                    })
            } else {
                console.log('json', json)
            }
        })    
    }
}