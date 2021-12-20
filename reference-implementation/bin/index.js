#!/usr/bin/env node


// import fs from 'fs';
// import chalk from "chalk";

let fs = require("fs");
let boxen = require("boxen");
let yargs = require("yargs/yargs");
const { hideBin } = require('yargs/helpers');

let axios = require("axios");

let Ajv = require("ajv")
const ajv = new Ajv({allErrors: true}) // options can be passed, e.g. {allErrors: true}

const ndjson = require('ndjson');
const split2 = require('split2');

const bfj = require('bfj');

var get = require('lodash/get');
var set = require('lodash/set');
var dropRight = require('lodash/dropRight');
var takeRight = require('lodash/takeRight');
var join = require('lodash/join');
var replace = require('lodash/replace');
var trimEnd = require('lodash/trimEnd');
var upperFirst = require('lodash/upperFirst');

let compress = require('compress-json').compress;
let decompress = require('compress-json').decompress;
let jsonpack = require('jsonpack/main')

let lineReader = require('line-reader');
let readline = require('readline');
let Promise = require('bluebird');

var Fhir = require('fhir').Fhir;
var fhir = new Fhir();

// Load Chance
var Chance = require('chance');

// Instantiate Chance so it can be used
var chance = new Chance();

const { DateTime } = require("luxon");
const { match } = require("assert");
const { unset } = require("lodash");

const { exec } = require("child_process");

// import boxen from "boxen";
// import yargs from "yargs";
// import axios frofm "axios";

let options = yargs(hideBin(process.argv))
 .usage("Usage: validator-tool <cmd> [args]")
 .config({
     "url": "http://localhost:3000/baseR4/metadata", 
     "launch-command": "ls -la",
     "stats": true, 
     "memory": 10000000
    })
 .command("readfile",   "Read a file", function (yargs, helpOrVersionSet) {
    return yargs.option('save', {
      alias: 's'
    })
  })
 .command("validate",       "Validate JSON file.")
 .command("generate",       "Generate sample NDJSON file.")
 .command("stream",         "Stream file and validate each line (NDJSON).")
 .command("compress",       "Compress the JSON record.")
 .command("pack",           "Pack the JSON record.")
 .command("walk",           "Walk a large JSON record via streaming.")
 .command("walk-and-match", "Walk a large JSON record and validate.")
 .command("extract",        "Extract matching schemas from a large JSON file.")
 .command("launch",         "Launch an external C++ program")

//  .command("minify",  "Minify the JSON record with a mapping file.")
//  .option("decompress", { describe: "Decompress the JSON record." })
//  .option("unpack",     { describe: "Unpack the JSON record." })
//  .option("unminify",   { describe: "Unminify the JSON record." })
 
 .option("file",           { describe: "Path to file." })
 .option("schema",         { describe: "Path to a schema file (in JsonSchema format)" })
 .option("save",           { describe: "Location to save the output to", alias: 's' })
 .option("verbose",        { describe: "Verbose mode", alias: 'v' })
 .option("debug",          { describe: "Include debugging info", alias: 'd' })
 .option("trace",          { describe: "Include trace info", alias: 't' })
 .option("memory",         { describe: "Amount of memory (RAM) to use.  Default chunk size: 10000000 (10MB)", alias: 'm', default: 10000000 })
 .option("fhir",           { describe: "Specify to output in FHIR format."  })
 .option("resource-type",  { describe: "Define a default FHIR resource type for extraction."  })
 .option("tetris",         { describe: "Remove objects from memory after theyve been matched and validated." })
 .option("dump",           { describe: "Perform a memory dump at the end of the run." })
 .option("command",        { describe: "External command to launch.  Defaults to 'ls -la'" })


 .example([
    ['$0 readfile --file ../data-files/allowed-amounts.json'],
    ['$0 validate --file ../data-files/allowed-amounts-borked.json --schema ../schemas/allowed-amounts.json'],
    ['$0 generate --save ../output/allowed-amounts.ndjson --lines 100'],
    ['$0 walk --file ../data-files/in-network-rates-fee-for-service-sample.json --debug --verbose'],
    ['$0 walk-and-match --file ../data-files/in-network-rates-fee-for-service-sample.json --schema ../schemas/negotiated-rate.json'],
    ['$0 extract --file ../data-files/in-network-rates-fee-for-service-sample.json --schema ../schemas/negotiated-rate.json --save ../output/network-rates.ndjson'],
    ['$0 extract --file ../data-files/in-network-rates-fee-for-service-sample.json --schema ../schemas/negotiated-rate.json --save ../output/network-rates.ndjson --fhir --resource-type "PricingTier"']
  ])

 .wrap(yargs.terminalWidth)
 .demandCommand()
 .recommendCommands()
 .argv;

let command = options._[0];

if(options["introspect"]){
    // console.log(JSON.stringify(options));
    console.log('options', options)
    console.log('command', command)
}

if(options["echo"]){
    const greeting = `${options["echo"]}!`;

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


if(options["fetch"]){
    axios.get(options["url"], { headers: { Accept: "application/json" } })
    .then(res => {
      console.log(res.data);
    });   
}


if(command === "launch"){
    console.log("Launching command: " + get(options, 'launch-command'))

    exec(get(options, 'launch-command'), (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
}

if(command === "readfile"){
    if(typeof options["file"] === "string"){
        fs.readFile(options["file"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')
            console.log(data)
          })    
    }
}

if(command === "validate"){
    if(typeof options["file"] === "string"){

        fs.readFile(options["file"], 'utf8' , (err, data) => {
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
            
            let doesNotHaveErrors = true;

            let selectedSchema;

            if(typeof options["schema"] === "string"){
                fs.readFile(options["schema"], 'utf8' , (err, schemaData) => {
                    if (err) {
                      console.error(err)
                      return
                    }
                    if(schemaData){
                        selectedSchema = schemaData;
                    }

                    console.log('==============================================================')

                    if(options["debug"]){
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

                        doesNotHaveErrors = false;

                        console.log(ajv.errorsText(validate.errors, {
                            separator: '\n'
                        }))                        
                    }
                    if(doesNotHaveErrors){
                        console.log("Conformant!")
                    }

                    console.log('==============================================================')
                });
            }
        })    
    }
}


if(command === "generate"){            
    
    console.log('Generating a new sample record.')
    if(!options["debug"]){
        console.log("If this utility appears to hang, you may want to consider running it with --debug")
    }
    let startTimestamp = DateTime.now();
    // console.log("Timestamp Start: " + DateTime.now())

    let schemaTemplate = {
        "reporting_entity_name": "medicare",
        "reporting_entity_type": "medicare",
        "reporting_plans":[{
          "plan_name": "medicare",
          "plan_id_type": "hios",
          "plan_id": "11111111111",
          "plan_market_type": "individual"
        }],
        "last_updated_on": startTimestamp.toFormat("yyyy-mm-dd"),
        "version": "1.0.0",
        "out_of_network":[],
        "in_network": []
    };

    let lineCount = 1;
    if(options["lines"]){    
        lineCount = options["lines"];
    }

    let ndJsonString = "";

    

    // fs.writeFile(options["save"], Buffer.from(ndJsonString), err => {
    //     if (err) {
    //         console.error(err)
    //         return
    //     } else {
    //         console.log('No errors reported.  Should be finished.')
    //     }
    // })

    if(typeof options["save"] === "string"){
        writeStream = fs.createWriteStream(options["save"], {
            flags: "w",
            encoding: "utf8",
            mode: 0o666,
            autoClose: true,
            emitClose: true,
            start: 0,
            highWaterMark: options["memory"]
        });
        writeStream.on("open", () => {
            console.log("Stream opened");
        });
        writeStream.on("ready", () => {
            console.log("Stream ready");
        });
        writeStream.on("pipe", src => {
            console.log(src);
        });
        writeStream.on("unpipe", src => {
            console.log(src);
        });
        writeStream.on('finish', () => {
            console.log('All writes are now complete.');
            
            let endTimestamp = DateTime.now();
            var diffInSeconds = endTimestamp.diff(startTimestamp, 'seconds');
            diffInSeconds.toObject(); //=> { months: 1 }
            
            console.log("Duration: " + JSON.stringify(diffInSeconds.toObject()))
        });  

        writeStream.write(trimEnd(JSON.stringify(schemaTemplate), ']}'));
        for (let index = 0; index < lineCount; index++) {
            if(index !== 0){
                writeStream.write(",");
            }

            let inNetworkPriceTier = {
                "negotiation_arrangement": chance.pickone([
                    "ffs",
                    "bundle",
                    "capitation"
                  ]),
                "name": upperFirst(chance.word()) + " " + chance.word(),
                "billing_code_type": "CPT",
                "billing_code_type_version": "2020",
                "billing_code": chance.integer({ min: 0, max: 99999 }).toString(),
                "description": chance.sentence(),
                "negotiated_rates": []
            }

            let numRatesInTier = chance.integer({min: 1, max: 5});
            for (let rateIndex = 0; rateIndex < numRatesInTier; rateIndex++) {
                let newRate = {
                    "provider_groups": [],
                    "negotiated_prices": []
                }

                let numProviderGroups = chance.integer({min: 1, max: 5});
                for (let providerIndex = 0; providerIndex < numProviderGroups; providerIndex++) {
                    let newProviderGroup = {
                        "npi": [],
                        "tin":{
                          "type": chance.pickone(["ein", "npi"]),
                          "value": chance.natural({min: 0, max: 1000000000}).toString()
                        }
                    }
                    let numNpi = chance.integer({min: 1, max: 5});
                    for (let npiIndex = 0; npiIndex < numNpi; npiIndex++) {
                        newProviderGroup.npi.push(chance.natural({min: 0, max: 1000000000}));
                        
                    }
                    newRate.provider_groups.push(newProviderGroup);
                }

                let numNegotiatedPrices = chance.integer({min: 1, max: 5});
                for (let priceIndex = 0; priceIndex < numNegotiatedPrices; priceIndex++) {
                    let newNegotiatedPrice = {
                        "negotiated_type": chance.pickone([
                            "negotiated",
                            "derived",
                            "fee schedule"
                          ]),
                        "negotiated_rate": chance.integer({ min: 0, max: 1000 }),
                        "expiration_date": DateTime.now().plus({months: 12}).toISODate(),
                        "service_code": chance.pickset(["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68","69","70","71","72","73","74","75","76","77","78","79","80","81","82","83","84","85","86","87","88","89","90","91","92","93","94","95","96","97","98","99"], 3),
                        "billing_class": chance.pickone([
                            "professional",
                            "institutional"
                          ])
                    }
                    newRate.negotiated_prices.push(newNegotiatedPrice);
                }

                inNetworkPriceTier.negotiated_rates.push(newRate);                
            }

            writeStream.write(JSON.stringify(inNetworkPriceTier));
    
            if(options["debug"]){
                if(index % 1000 === 0){
                    console.log((index / 1000).toFixed(0) + " K")
                }
            }
            if(options["trace"]){
                console.log(ndJsonString)
            }    
        }

        writeStream.write(']}');
        writeStream.end();
        if(options["debug"]){
            console.log("Finished: " + lineCount);
        }
    }
} 


if(command === "stream"){
    if(typeof options["stream"] === "string"){

        console.log("Streaming file: " + options["stream"]);
        console.log('==============================================================')

        if(typeof options["schema"] === "string"){
            fs.readFile(options["schema"], 'utf8' , (err, schemaData) => {
                if (err) {
                  console.error(err)
                  return
                }

                if(options["debug"]){
                    console.log('Fetching schema....')
                    console.log(schemaData)
                    console.log('')
                    console.log('--------------------------------------------------------------')
                    console.log('')
                }

                const validate = ajv.compile(JSON.parse(schemaData));

                let writeStream;

                if(typeof options["save"] === "string"){
                    writeStream = fs.createWriteStream(options["save"], {
                        flags: "w",
                        encoding: "utf8",
                        mode: 0o666,
                        autoClose: true,
                        emitClose: true,
                        start: 0,
                        highWaterMark: options["memory"]
                    });
                    writeStream.on("open", () => {
                        console.log("Stream opened");
                    });
                    writeStream.on("ready", () => {
                        console.log("Stream ready");
                    });
                    writeStream.on("pipe", src => {
                        console.log(src);
                    });
                    writeStream.on("unpipe", src => {
                        console.log(src);
                    });
                    writeStream.on('finish', () => {
                        console.error('All writes are now complete.');
                    });  
                }

                let index = 0;
                fs.createReadStream(options["stream"], { highWaterMark: options["memory"]})
                    .pipe(ndjson.parse())
                    .on('data', function(jsonObject) {
                        index++;
                        const valid = validate(jsonObject);

                        if (!valid){
                            // const errors = await this.parseErrors(validate.errors);
                            // throw errors;


                            if(options["save"]){
                                writeStream.write('Row Index: ' + index + '\n');
                                writeStream.write(ajv.errorsText(validate.errors, {
                                    separator: '\n'
                                }));
                                writeStream.write('\n\n');
                            } else {
                                console.log('Record Index: ' + index);
                                console.log(ajv.errorsText(validate.errors, {
                                    separator: '\n'
                                }))                        
                                console.log('');    
                            }
                        }
                    })
                    .on('finish', function(){
                        console.error('All writes are now complete.');
                        // writeStream.finish();
                    })

            });
        } else {
            console.log('Please use --schema to specify a schema to match against.')
        }


       

    }
}

if(command === "char-stream"){
    if(typeof options["char-stream"] === "string"){

        console.log("Streaming file: " + options["char-stream"]);
        console.log('==============================================================')

        let writeStream;
        if(typeof options["save"] === "string"){
            writeStream = fs.createWriteStream(options["save"], {
                flags: "w",
                encoding: "utf8",
                mode: 0o666,
                autoClose: true,
                emitClose: true,
                start: 0,
                highWaterMark: options["memory"]
            });
            writeStream.on("open", () => {
                console.log("Stream opened");
            });
            writeStream.on("ready", () => {
                console.log("Stream ready");
            });
            writeStream.on("pipe", src => {
                console.log(src);
            });
            writeStream.on("unpipe", src => {
                console.log(src);
            });
            writeStream.on('finish', () => {
                console.error('All writes are now complete.');
            });  
        }

        let index = 0;
        fs.createReadStream(options["char-stream"], { highWaterMark: options["memory"]})
            .pipe(split2())
            .on('data', function(jsonObject) {
                index++;
                console.log('row: ' + index);
                console.log(jsonObject);

                
                // const valid = validate(jsonObject);

                // if (!valid){
                //     // const errors = await this.parseErrors(validate.errors);
                //     // throw errors;

                //     if(options["save"]){
                //         writeStream.write('Row Index: ' + index + '\n');
                //         writeStream.write(ajv.errorsText(validate.errors, {
                //             separator: '\n'
                //         }));
                //         writeStream.write('\n\n');
                //     } else {
                //         console.log('Record Index: ' + index);
                //         console.log(ajv.errorsText(validate.errors, {
                //             separator: '\n'
                //         }))                        
                //         console.log('');    
                //     }
                // }
            })
            .on('finish', function(){
                console.error('All writes are now complete.');
                // writeStream.finish();
            })



    }
}

if(command === "compress"){
    if(typeof options["compress"] === "string"){

        fs.readFile(options["compress"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Compressing file....')

            let parsedData;
            if(typeof data === "string"){
                parsedData = JSON.parse(data);
            } else if(typeof data === "object"){
                parsedData = data;
            }
            
            let compressed = compress(parsedData)

            console.log('typeof compressed', typeof compressed)
            console.log('compressed', compressed)

            if(options["save"] && compressed){
                fs.writeFile(options["save"], Buffer.from(compressed), err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })    
            }
        })    
    }
}

if(command === "pack"){
    if(typeof options["pack"] === "string"){

        fs.readFile(options["pack"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Packing file....')

            let parsedData;
            if(typeof data === "string"){
                parsedData = JSON.parse(data);
            } else if(typeof data === "object"){
                parsedData = data;
            }
            
            let packed = jsonpack.pack(parsedData)

            console.log('typeof packed', typeof packed)
            console.log('packed', packed)

            if(options["save"] && packed){
                fs.writeFile(options["save"], Buffer.from(packed), err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })    
            }
        })    
    }
}

if(command === "stringify"){
    if(typeof options["stringify"] === "string"){

        fs.readFile(options["stringify"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Stringifying file....')

            let parsedData;
            if(typeof data === "string"){
                parsedData = JSON.parse(data);
            } else if(typeof data === "object"){
                parsedData = data;
            }
            
            let stringified = JSON.stringify(parsedData)

            console.log('typeof stringified', typeof stringified)
            console.log('stringified', stringified)

            if(options["save"] && stringified){
                fs.writeFile(options["save"], Buffer.from(stringified), err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })    
            }
        })    
    }
}

// var specs = {
//     'reporting_entity_name': 'a',
//     'reporting_entity_type': 'b',
//     'reporting_plans': 'c',
//     'last_updated_on': 'd',
//     'version': 'e',
//     'out_of_network': 'f',
//     'plan_name': 'g',
//     'plan_id_type': 'h',
//     'plan_id': 'i',
//     'plan_market_type': 'j',
//     'name': 'k',
//     'billing_code_type': 'l',
//     'billing_code_type_version': 'm',
//     'billing_code': 'n',
//     'description': 'o',
//     'allowed_amounts': 'p',
//     "tin": 'q',
//     'type': 'r',
//     'value': 's',
//     'service_code': 't',
//     'billing_class': 'u',
//     'payments': 'v',
//     'providers': 'w',
//     'billed_charge': 'x',
//     'npi': 'y'
//   };

// security vulnerability with older version of json-minify
// relies on lodash; need to upgrade to lodash@4.17.21
// https://github.com/advisories/GHSA-35jh-r3h4-6jhm

// var minifier = require('json-minifier')(specs);

// if(command === "minify"){
//     if(typeof options["minify"] === "string"){

//         fs.readFile(options["minify"], 'utf8' , (err, data) => {
//             if (err) {
//               console.error(err)
//               return
//             }
//             console.log('Minifying file....')

//             let parsedData;
//             if(typeof data === "string"){
//                 parsedData = JSON.parse(data);
//             } else if(typeof data === "object"){
//                 parsedData = data;
//             }
            
//             let minified = minifier.minify(parsedData)

//             console.log('typeof minified', typeof minified)
//             console.log('minified', minified)

//             if(options["save"] && minified){
//                 fs.writeFile(options["save"], Buffer.from(minified), err => {
//                     if (err) {
//                         console.error(err)
//                         return
//                     }
//                 })    
//             }
//         })    
//     }
// }


//===========================================================================
// WALK METHODS

function walkBigFile(bigFilePath, validator, isVerbose, writeStream, startTimestamp){
    const emitter = bfj.walk(fs.createReadStream(bigFilePath, { highWaterMark: options["memory"] }));
         
    let rootObject;
    let stack = [];
    let lastProperty = "";
    let lastObject = null;
    let lastPropertyPath = "";
    let lastPropertyBase = "";       

    let matchCount = 0;

    emitter.on(bfj.events.array, function(array){
        if(isVerbose) console.log('bfj.events.array      : ', array);

        if(lastPropertyBase.length === 0){
            lastPropertyBase = lastProperty;                
            set(rootObject, lastProperty, [])

        } else {
            
            // <---

            let existingObject = get(rootObject, lastPropertyBase, [])
            if(options["trace"]) console.log('existingObject        : ', existingObject)
            
            if(Array.isArray(existingObject)){
                existingObject[existingObject.length - 1][lastProperty] = [];
                lastPropertyBase = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
            } else {
                existingObject[lastProperty] = [];
                lastPropertyBase = lastPropertyBase + "." + lastProperty;
                // set(existingObject, lastProperty, [])     
            }
        }

        // ????
        lastProperty = "";

        if(options["trace"]) console.log('lastProperty          : ', lastProperty);
        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);
        if(options["debug"]) console.log('rootObject            : ', JSON.stringify(rootObject));
    });
    emitter.on(bfj.events.object, function(object){
        if(isVerbose) console.log('bfj.events.object     : ', object);

        if(options["trace"]) console.log('lastProperty          : ', lastProperty);
        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);

        let assigningPath = "";

        // tree branch
        if(typeof rootObject === "object"){
            // grab the branch path
            if(options["trace"]) console.log('setting property base : ', lastPropertyBase);
            
            // no existing path, so whatever we assign 
            // will be based on the last property found
            if(lastPropertyBase.length === 0){
                assigningPath = lastProperty;

            // we have an existing lastPropertyBase; time to parse it
            } else if(lastPropertyBase.length > 0){                  
                
                // let's pluck the existing branch, and see what currently exists
                let existingObject = get(rootObject, lastPropertyBase)
                if(options["trace"]) console.log('existingObject        : ', existingObject);
                
                

                // if nothing exists, we assume we can assign directly to the path
                if(!existingObject){

                    // do we need to add the lastProperty?
                    assigningPath = lastPropertyBase;

                // if it does exists, then lets check that it's an array
                } else if(Array.isArray(existingObject)){
                    if(options["trace"]) console.log('existingObject.length : ', existingObject.length);

                    // how many objects are in the existing array?
                    if(existingObject.length === 0){
                        // it is an array, but  nothing assigned yet; still at first level 
                        // subobject doesnt exist yet, so assigning an index of 0
                        assigningPath = lastPropertyBase + "[0]"
                    } else if(existingObject.length > 0){                        

                        if(existingObject.length > 0){
                            // found an existing object in the array
                            assigningPath = lastPropertyBase + "[" + existingObject.length + "]"
                        } 
                    } 
                } else {
                    assigningPath = lastPropertyBase + "." + lastProperty;
                    lastPropertyBase = assigningPath;
                }                    
            } 





            if(options["trace"]) console.log('assigningPath         : ', assigningPath);
            
            set(rootObject, assigningPath, {});
        
        // root node
        } else if(typeof rootObject === "undefined"){
            rootObject = {};
        }
        if(options["debug"]) console.log('rootObject            : ', JSON.stringify(rootObject));
    });
    emitter.on(bfj.events.property, function(name){ 
        if(isVerbose) console.log('bfj.events.property   : ', name)

        lastProperty = name;

        // lastPropertyPath = lastProperty

        // if(lastPropertyBase.length > 0){
        //     lastPropertyPath = lastPropertyBase + "." +  lastProperty
        // } else {
        //     lastPropertyPath = lastProperty
        // }
    });
    emitter.on(bfj.events.string, function(value){ 
        if(isVerbose) console.log('bfj.events.string     : ', value)
        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);

        if(lastPropertyBase.length === 0){
            set(rootObject, lastProperty, value)
        } else {
            let existingObject = get(rootObject, lastPropertyBase, [])
            if(options["trace"]) console.log('existingObject        : ', existingObject);
            

            let assigningPath = "";

            if(Array.isArray(existingObject)){

                if(options["trace"]) console.log('typeof existingObject[0]', typeof existingObject[0])
                if(["string", "undefined"].includes(typeof existingObject[0])){
                    existingObject.push(value);
                } else if (typeof existingObject[0] === "object"){
                    assigningPath = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
                    if(options["trace"]) console.log('assigningPath         : ', assigningPath)    
                    set(rootObject, assigningPath, value);
                }


            } else {
                assigningPath = lastPropertyBase + "." + lastProperty;
                set(rootObject, assigningPath, value);
            }

            if(options["trace"]) console.log('assigningPath         : ', assigningPath);                
        }
        // console.log('rootObject', JSON.stringify(rootObject));
    });
    emitter.on(bfj.events.number, function(value){ 
        if(isVerbose) console.log('bfj.events.number     : ', value)
        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);

        if(lastPropertyBase.length === 0){
            set(rootObject, lastProperty, value)
        } else {


            let existingObject = get(rootObject, lastPropertyBase)
            if(options["trace"]) console.log('lastPropertyBase.isArray', Array.isArray(existingObject));


            if(Array.isArray(existingObject)){
                if(options["trace"]) console.log('typeof existingObject[0]', typeof existingObject[0])
                if(["number", "undefined"].includes(typeof existingObject[0])){
                    existingObject.push(value);
                } else if (typeof existingObject[0] === "object"){
                    let newPath = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
                    if(options["trace"]) console.log('newPath', newPath)    
                    set(rootObject, newPath, value);
                }

            } else {
                
                set(rootObject, lastPropertyBase + "." + lastProperty, value);
            }
            // console.log('existingObject', existingObject)

            // let newPath = lastPropertyBase + "[" + (existingObject.length)  + "]." + lastProperty;
            // console.log('newPath', newPath);

        }
        if(options["debug"]) console.log('rootObject            : ', JSON.stringify(rootObject));
    });
    emitter.on(bfj.events.literal, function(value){ 
        if(isVerbose) console.log('bfj.events.literal    : ', value);

        // stack[stack.length - 1][lastProperty] = value
        // rootObject[lastProperty] = value;
        // set(rootObject, lastPropertyBase + '.' + lastProperty, value)

        if(lastPropertyBase.length === 0){
            set(rootObject, lastProperty, value)
        } else {
            let existingObject = get(rootObject, lastPropertyBase, [])
            console.log('existingObject        : ', existingObject)

            let newPath = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
            console.log('newPath', newPath);

            set(rootObject, newPath, value);
        }
    });
    emitter.on(bfj.events.endArray, function(array){
        if(isVerbose) console.log('bfj.events.endArray   : ', array);

        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);

        let existingObject = get(rootObject, lastPropertyBase)

        // is the current lastPropertyBase a leaf array?
        // and written without an index?
        // as in the case of an array of strings or ints?
        if(Array.isArray(existingObject)){

            // if so, we just remove the last element
            let pathComponents = lastPropertyBase.split(".");
            if(options["trace"]) console.log('pathComponents        : ', pathComponents);
            
            let lastItem = takeRight(pathComponents, 1);
            if(options["trace"]) console.log('lastItem              : ', lastItem);
            
            let remainingPath = join(dropRight(pathComponents, 1), ".");
            if(options["trace"]) console.log('remainingPath         : ', remainingPath);

            lastPropertyBase = remainingPath;
        } else {
            // otherwise, treat the array as an array of object
            // and check to remove the index brackets in the string
            // which requires going two levels deep in the string
            let components = lastPropertyBase.split(".");
            if(options["trace"]) console.log('components            : ', components);
                
            let basePath = dropRight(components, 1);
            if(options["trace"]) console.log('basePath              : ', basePath);    
        
            let lastItem = replace(takeRight(basePath, 1), /\[[^\]]*\]/, "");
            if(options["trace"]) console.log('lastItem              : ', lastItem);

            let essentialPath = join(dropRight(basePath, 1), ".");
            if(options["trace"]) console.log('essentialPath         : ', essentialPath);    

            let remainingPath = join([essentialPath, lastItem], "."); 
            if(options["trace"]) console.log('remainingPath         : ', remainingPath);        

            lastPropertyBase = remainingPath; 
        }            

        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);
        if(options["debug"]) console.log('rootObject            : ', JSON.stringify(rootObject));
    });
    emitter.on(bfj.events.endObject, function(object){
        if(isVerbose) console.log('bfj.events.endObject')

        let remainingPath = "";

        let existingObject = get(rootObject, lastPropertyBase);
        if(options["peek"]){
            console.log(JSON.stringify(existingObject));
        }

        if(validator){
            const valid = validator(existingObject);

            let doesNotHaveErrors = true;
            if (valid){
                if(options["save"]){
                    let objectToSave = {};
                    matchCount++;
                    if(options["fhir"]){
                        if(options["resource-type"]){
                            
                            objectToSave.resourceType = options["resource-type"]
                            Object.assign(objectToSave, existingObject);
                            writeStream.write(JSON.stringify(objectToSave) + '\n');
                        } else {
                            objectToSave.resourceType = "Basic"
                            Object.assign(objectToSave, existingObject);
                            writeStream.write(JSON.stringify(objectToSave) + '\n');
                        }
                    } else {
                        Object.assign(objectToSave, existingObject);
                        writeStream.write(JSON.stringify(objectToSave) + '\n');
                    }
                    if(matchCount % 1000 === 0){
                        console.log("Matches: " + (matchCount / 1000).toFixed(0) + "K    Heap Total: " + (process.memoryUsage().heapTotal / 1048576).toFixed(0) + " MB   Heap Usage: " + (process.memoryUsage().heapUsed / 1048576).toFixed(0) + " MB    ArrayBuffers: " + process.memoryUsage().arrayBuffers);
                    }
            } else {
                    console.log("")
                    console.log("FOUND A MATCH!!!  #" + matchCount);
                    matchCount++;
                    console.log("Location: " + lastPropertyBase)
                    if(options["verbose"]){
                        console.log(JSON.stringify(existingObject));
                    }                    
                    console.log('')

                    if(options["tetris"]){
                        set(rootObject, lastPropertyBase, null)
                    }
                }
            } else {
                doesNotHaveErrors = false;

                if(options["debug"]){
                    console.log(ajv.errorsText(validator.errors, {
                        separator: '\n'
                    }))                            
                }
            }
        } else if(isVerbose){
            // console.log('Found an object:  ')
            if(Array.isArray(existingObject)){
                console.log(JSON.stringify(existingObject[existingObject.length - 1]));
            } else {
                console.log(JSON.stringify(existingObject));
            } 
            console.log('')
        }
        
        if(options["trace"]) console.log('existingObject.isArray: ', Array.isArray(existingObject));

        let components = lastPropertyBase.split(".");
        if(options["trace"]) console.log('components            : ', components);
                
        let lastItem = takeRight(components, 1);
        if(options["trace"]) console.log('lastItem              : ', lastItem);

        // is the current lastPropertyBase an object array?
        if(Array.isArray(existingObject)){
            // okay, we're in an object array
            // and we're ending the object, not the array
            // so keep the same lastPropertyBase
            lastPropertyBase = lastPropertyBase;

        } else if(lastItem[0].match(/\[[^\]]*\]/)){
            // yup, array reference
            // object end involves closing this out 
            // (but not necessary closing out the array)

            let scrubbedItem = replace(lastItem, /\[[^\]]*\]/, "");
            if(options["trace"]) console.log('scrubbedItem          : ', scrubbedItem);

            let basePath = join(dropRight(components, 1), ".");
            if(options["trace"]) console.log('basePath              : ', basePath);    
            
            if(basePath){
                remainingPath = join([basePath, scrubbedItem], "."); 
            } else {
                remainingPath = scrubbedItem; 
            }

            if(options["trace"]) console.log('remainingPath         : ', remainingPath);        

            lastPropertyBase = remainingPath;             

        } else {
            // no array reference, just removing the last item

            let basePath = dropRight(components, 1);
            if(options["trace"]) console.log('basePath              : ', basePath);     

            remainingPath = join(basePath, "."); 
            if(options["trace"]) console.log('remainingPath         : ', remainingPath);        

            lastPropertyBase = remainingPath;             
        }

        if(options["trace"]) console.log('lastPropertyBase      : ', lastPropertyBase);
        if(options["debug"]) console.log('rootObject            : ', JSON.stringify(rootObject));

    });
    emitter.on(bfj.events.error, function(error){ 
        if(isVerbose) console.log('bfj.events.error      : ', error)
    });
    emitter.on(bfj.events.dataError, function(error){ 
        if(isVerbose) console.log('bfj.events.dataError  : ', error)
    });
    emitter.on(bfj.events.end, function(end){
        if(isVerbose) console.log('bfj.events.end        : ', end)

        if(options["save"]){
            console.log('Walk complete.  Please check file.')
        } else {
            console.log('Walk complete.')
        }

        if(options["dump"]){
            console.log("")
            console.log("FINAL OBJECT")
            console.log('===================================================================================================')
            console.log(JSON.stringify(rootObject))
            console.log('===================================================================================================')    
            console.log("")
        }

        if(startTimestamp){
            let endTimestamp = DateTime.now();
            var diffInSeconds = endTimestamp.diff(startTimestamp, 'seconds');
            diffInSeconds.toObject(); //=> { months: 1 }
            
            console.log("Duration:          " + get(diffInSeconds.toObject(), "seconds") + " sec")
        }
        if(options["stats"]){
            console.log("Number of Matches: " + matchCount)
        }
    });
}

if(command === "walk"){
    if(typeof options["file"] === "string"){

        console.log("walking file: " + options["file"]);
        let startTimestamp = DateTime.now();
        
        if(options["verbose"]){
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
    
            console.log('===================================================================================================')
            console.log('===================================================================================================')
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")    
        }        

        let writeStream;
        if(typeof options["save"] === "string"){
            writeStream = fs.createWriteStream(options["save"], {
                flags: "w",
                encoding: "utf8",
                mode: 0o666,
                autoClose: true,
                emitClose: true,
                start: 0,
                highWaterMark: options["memory"]
            });
            writeStream.on("open", () => {
                console.log("Stream opened");
            });
            writeStream.on("ready", () => {
                console.log("Stream ready");
            });
            writeStream.on("pipe", src => {
                console.log(src);
            });
            writeStream.on("unpipe", src => {
                console.log(src);
            });
            writeStream.on('finish', () => {
                console.error('All writes are now complete.');
            });  
        }

        
        walkBigFile(options["file"], null, options["verbose"], null, startTimestamp) 
    }
}

if(command === "walk-and-match"){
    if(typeof options["file"] === "string"){

        console.log("walking file: " + options["file"]);
        let startTimestamp = DateTime.now();

        if(options["debug"]){
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
    
            console.log('===================================================================================================')
            console.log('===================================================================================================')
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
        }

        let writeStream;
        if(typeof options["save"] === "string"){
            writeStream = fs.createWriteStream(options["save"], {
                flags: "w",
                encoding: "utf8",
                mode: 0o666,
                autoClose: true,
                emitClose: true,
                start: 0,
                highWaterMark: options["memory"]
            });
            writeStream.on("open", () => {
                console.log("Stream opened");
            });
            writeStream.on("ready", () => {
                console.log("Stream ready");
            });
            writeStream.on("pipe", src => {
                console.log(src);
            });
            writeStream.on("unpipe", src => {
                console.log(src);
            });
            writeStream.on('finish', () => {
                console.error('All writes are now complete.');
            });  
        }

        if(typeof options["schema"] === "string"){
            fs.readFile(options["schema"], 'utf8' , (err, schemaData) => {
                if (err) {
                  console.error(err)
                  return
                }
                if(schemaData){
                    selectedSchema = schemaData;
                }

                console.log('==============================================================')

                if(options["debug"]){
                    console.log('Fetching schema....')
                    console.log(schemaData)
                    console.log('')
                    console.log('--------------------------------------------------------------')
                }

                const validator = ajv.compile(JSON.parse(schemaData));

                walkBigFile(options["file"], validator, options["verbose"], writeStream, startTimestamp)
                
                console.log('==============================================================')
            });
        }

        
    }
}

if(command === "extract"){
    if(typeof options["file"] === "string"){

        console.log("walking file: " + options["file"]);
        let startTimestamp = DateTime.now();

        if(options["debug"]){
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
    
            console.log('===================================================================================================')
            console.log('===================================================================================================')
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
            console.log("")
        }

        let writeStream;
        if(typeof options["save"] === "string"){
            writeStream = fs.createWriteStream(options["save"], {
                flags: "w",
                encoding: "utf8",
                mode: 0o666,
                autoClose: true,
                emitClose: true,
                start: 0,
                highWaterMark: options["memory"]
            });
            writeStream.on("open", () => {
                console.log("Stream opened");
            });
            writeStream.on("ready", () => {
                console.log("Stream ready");
            });
            writeStream.on("pipe", src => {
                console.log(src);
            });
            writeStream.on("unpipe", src => {
                console.log(src);
            });
            writeStream.on('finish', () => {
                console.error('All writes are now complete.');
            });  
        }

        if(typeof options["schema"] === "string"){
            fs.readFile(options["schema"], 'utf8' , (err, schemaData) => {
                if (err) {
                  console.error(err)
                  return
                }
                if(schemaData){
                    selectedSchema = schemaData;
                }

                console.log('==============================================================')

                if(options["debug"]){
                    console.log('Fetching schema....')
                    console.log(schemaData)
                    console.log('')
                    console.log('--------------------------------------------------------------')
                }

                const validator = ajv.compile(JSON.parse(schemaData));

                walkBigFile(options["file"], validator, options["verbose"], writeStream, startTimestamp)
                
                console.log('==============================================================')
            });
        }

    }
}


