#!/usr/bin/env node


// import fs from 'fs';
// import chalk from "chalk";

let fs = require("fs");
let boxen = require("boxen");
let yargs = require("yargs");
let axios = require("axios");

let Ajv = require("ajv")
const ajv = new Ajv({allErrors: true}) // options can be passed, e.g. {allErrors: true}


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
 .option("debug", { describe: "Include debugging info" })
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
            console.log('Validate file....')

            let parsedData;
            if(typeof data === "string"){
                parsedData = JSON.parse(data);
            } else if(typeof data === "object"){
                parsedData = data;
            }
            
            let jsonObject = parsedData;

            let schema;
            if(typeof options.schema === "string"){
                fs.readFile(options.schema, 'utf8' , (err, schemaData) => {
                    if (err) {
                      console.error(err)
                      return
                    }


                    console.log('==============================================================')

                    if(options.debug){
                        console.log('Fetching schema....')
                        console.log(schemaData)
                        console.log('')
                        console.log('--------------------------------------------------------------')
                        console.log('')
                        console.log('JSON file.......')
                        console.log(jsonObject)
                        console.log('')
                        console.log('--------------------------------------------------------------')
                        console.log('')    
                    }

                    const validate = ajv.compile(JSON.parse(schemaData));
                    const valid = validate(jsonObject);

                    if (!valid){
                        // const errors = await this.parseErrors(validate.errors);
                        // throw errors;

                        console.log(ajv.errorsText(validate.errors, {
                            separator: '\n'
                        }))                        
                    }

                    console.log('==============================================================')
                });
            }
        })    
    }
}


if(options["generate"]){                
    let schemaTemplate = {
        "reporting_entity_name": "medicare",
        "reporting_entity_type": "medicare",
        "reporting_plans":[{
          "plan_name": "medicare",
          "plan_id_type": "hios",
          "plan_id": "11111111111",
          "plan_market_type": "individual"
        }],
        "last_updated_on": "2020-08-27",
        "version": "1.0.0",
        "out_of_network":[]
    };

    let lineCount = 1;
    if(options["lines"]){    
        lineCount = options["lines"];
    }

    let ndJsonString = "";

    for (let index = 0; index < lineCount; index++) {
        ndJsonString += JSON.stringify(schemaTemplate) + "\n"    

        if(options["debug"]){
            if(index % 10 === 0){
                console.log(index)
            }
        }
        if(options["trace"]){
            console.log(ndJsonString)
        }    
    }
    if(options["debug"]){
        console.log("Finished: " + lineCount);
    }


    fs.writeFile(options["generate"], Buffer.from(ndJsonString), err => {
        if (err) {
            console.error(err)
            return
        }
    })
} 