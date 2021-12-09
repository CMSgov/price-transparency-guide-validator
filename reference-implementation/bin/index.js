#!/usr/bin/env node


// import fs from 'fs';
// import chalk from "chalk";

let fs = require("fs");
let boxen = require("boxen");
let yargs = require("yargs");
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


let compress = require('compress-json').compress;
let decompress = require('compress-json').decompress;
let jsonpack = require('jsonpack/main')

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
 .option("echo",       { describe: "Echo", type: "string" })
 .option("fetch",      { describe: "Fetch a URL" })
 .option("readfile",   { describe: "Read file" })
 .option("validate",   { describe: "Validate JSON file" })
 .option("generate",   { describe: "Generate sample NDJSON file." })
 .option("stream",     { describe: "Stream file and validate each line (NDJSON)" })
 .option("char-stream",{ describe: "Compress the JSON record into a character stream." })
 .option("compress",   { describe: "Compress the JSON record." })
//  .option("decompress", { describe: "Decompress the JSON record." })
 .option("pack",       { describe: "Pack the JSON record." })
//  .option("unpack",     { describe: "Unpack the JSON record." })
 .option("minify",     { describe: "Minify the JSON record with a specific mapping file." })
//  .option("unminify",   { describe: "Unminify the JSON record." })
 .option("stringify",     { describe: "Stringify a JSON record." })

 .option("walk",     { describe: "Walk a large JSON record via a streaming channel." })
 .option("debug",      { describe: "Include debugging info" })
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


if(options["fetch"]){
    axios.get(options["url"], { headers: { Accept: "application/json" } })
    .then(res => {
      console.log(res.data);
    });   
}

// if(options.ping){
//     console.log(FhirFoundryUtilities.ping(options.ping))
// }

if(options["readfile"]){
    if(typeof options["readfile"] === "string"){
        fs.readFile(options["readfile"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Reading file....')
            console.log(data)
          })    
    }
}

if(options["validate"]){
    if(typeof options["validate"] === "string"){

        fs.readFile(options["validate"], 'utf8' , (err, data) => {
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

            if(typeof options.schema === "string"){
                fs.readFile(options.schema, 'utf8' , (err, schemaData) => {
                    if (err) {
                      console.error(err)
                      return
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


if(options["stream"]){
    if(typeof options["stream"] === "string"){

        console.log("Streaming file: " + options["stream"]);
        console.log('==============================================================')

        if(typeof options.schema === "string"){
            fs.readFile(options.schema, 'utf8' , (err, schemaData) => {
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
                        start: 0
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
                fs.createReadStream(options["stream"])
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

if(options["char-stream"]){
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
                start: 0
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
        fs.createReadStream(options["char-stream"])
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



if(options["walk"]){
    if(typeof options["walk"] === "string"){

        console.log("walking file: " + options["walk"]);
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
        

        let writeStream;
        if(typeof options["save"] === "string"){
            writeStream = fs.createWriteStream(options["save"], {
                flags: "w",
                encoding: "utf8",
                mode: 0o666,
                autoClose: true,
                emitClose: true,
                start: 0
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

        const emitter = bfj.walk(fs.createReadStream(options["walk"]));
         
        let rootObject;
        let stack = [];
        let lastProperty = "";
        let lastObject = null;
        let lastPropertyPath = "";
        let lastPropertyBase = "";        
        

        emitter.on(bfj.events.array, function(array){
            console.log('bfj.events.array      : ', array);

            // rootObject[lastProperty] = [];
            // lastPropertyBase = lastProperty;



            if(lastPropertyBase.length === 0){
                lastPropertyBase = lastProperty;                
                set(rootObject, lastProperty, [])

            } else {
                
                // <---

                let existingObject = get(rootObject, lastPropertyBase, [])
                console.log('existingObject        : ', existingObject)
                
                if(Array.isArray(existingObject)){
                    existingObject[existingObject.length - 1][lastProperty] = [];
                    lastPropertyBase = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
                } else {
                    lastPropertyBase = lastPropertyBase + "[" + (existingObject.length)  + "]." + lastProperty;
                    set(rootObject, lastPropertyBase, [])     
                }
            }

            // ????
            lastProperty = "";

            console.log('lastProperty          : ', lastProperty);
            console.log('lastPropertyBase      : ', lastPropertyBase);
            console.log('rootObject            : ', JSON.stringify(rootObject));
        });
        emitter.on(bfj.events.object, function(object){
            console.log('bfj.events.object     : ', object);

            console.log('lastProperty          : ', lastProperty);
            console.log('lastPropertyBase      : ', lastPropertyBase);

            let assigningPath = "";

            // tree branch
            if(typeof rootObject === "object"){
                // grab the branch path
                console.log('setting property base : ', lastPropertyBase);
                
                // no existing path, so whatever we assign 
                // will be based on the last property found
                if(lastPropertyBase.length === 0){
                    assigningPath = lastProperty;

                // we have an existing lastPropertyBase; time to parse it
                } else if(lastPropertyBase.length > 0){                  
                    
                    // let's pluck the existing branch, and see what currently exists
                    let existingObject = get(rootObject, lastPropertyBase)
                    console.log('existingObject        : ', existingObject);
                    
                    

                    // if nothing exists, we assume we can assign directly to the path
                    if(!existingObject){

                        // do we need to add the lastProperty?
                        assigningPath = lastPropertyBase;

                    // if it does exists, then lets check that it's an array
                    } else if(Array.isArray(existingObject)){
                        console.log('existingObject.length : ', existingObject.length);

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





                console.log('assigningPath         : ', assigningPath);
                
                set(rootObject, assigningPath, {});
            
            // root node
            } else if(typeof rootObject === "undefined"){
                rootObject = {};
            }
            console.log('rootObject            : ', JSON.stringify(rootObject));
        });
        emitter.on(bfj.events.property, function(name){ 
            console.log('bfj.events.property   : ', name)

            lastProperty = name;

            // lastPropertyPath = lastProperty

            // if(lastPropertyBase.length > 0){
            //     lastPropertyPath = lastPropertyBase + "." +  lastProperty
            // } else {
            //     lastPropertyPath = lastProperty
            // }
        });
        emitter.on(bfj.events.string, function(value){ 
            console.log('bfj.events.string     : ', value)
            console.log('lastPropertyBase      : ', lastPropertyBase);

            if(lastPropertyBase.length === 0){
                set(rootObject, lastProperty, value)
            } else {
                let existingObject = get(rootObject, lastPropertyBase, [])
                console.log('existingObject        : ', existingObject);
                

                let assigningPath = "";

                if(Array.isArray(existingObject)){

                    console.log('typeof existingObject[0]', typeof existingObject[0])
                    if(["string", "undefined"].includes(typeof existingObject[0])){
                        existingObject.push(value);
                    } else if (typeof existingObject[0] === "object"){
                        assigningPath = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
                        console.log('assigningPath         : ', assigningPath)    
                        set(rootObject, assigningPath, value);
                    }


                } else {
                    assigningPath = lastPropertyBase + "." + lastProperty;
                    set(rootObject, assigningPath, value);
                }

                console.log('assigningPath         : ', assigningPath);                
            }
            // console.log('rootObject', JSON.stringify(rootObject));
        });
        emitter.on(bfj.events.number, function(value){ 
            console.log('bfj.events.number     : ', value)
            console.log('lastPropertyBase      : ', lastPropertyBase);

            if(lastPropertyBase.length === 0){
                set(rootObject, lastProperty, value)
            } else {


                let existingObject = get(rootObject, lastPropertyBase)
                console.log('lastPropertyBase.isArray', Array.isArray(existingObject));


                if(Array.isArray(existingObject)){
                    console.log('typeof existingObject[0]', typeof existingObject[0])
                    if(["number", "undefined"].includes(typeof existingObject[0])){
                        existingObject.push(value);
                    } else if (typeof existingObject[0] === "object"){
                        let newPath = lastPropertyBase + "[" + (existingObject.length - 1)  + "]." + lastProperty;
                        console.log('newPath', newPath)    
                        set(rootObject, newPath, value);
                    }

                } else {
                    
                    set(rootObject, lastPropertyBase + "." + lastProperty, value);
                }
                // console.log('existingObject', existingObject)

                // let newPath = lastPropertyBase + "[" + (existingObject.length)  + "]." + lastProperty;
                // console.log('newPath', newPath);

            }
            console.log('rootObject            : ', JSON.stringify(rootObject));
        });
        emitter.on(bfj.events.literal, function(value){ 
            console.log('bfj.events.literal    : ', value);

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
            console.log('bfj.events.endArray   : ', array);

            console.log('lastPropertyBase      : ', lastPropertyBase);

            let existingObject = get(rootObject, lastPropertyBase)

            // is the current lastPropertyBase a leaf array?
            // and written without an index?
            // as in the case of an array of strings or ints?
            if(Array.isArray(existingObject)){

                // if so, we just remove the last element
                let pathComponents = lastPropertyBase.split(".");
                console.log('pathComponents        : ', pathComponents);
                
                let lastItem = takeRight(pathComponents, 1);
                console.log('lastItem              : ', lastItem);
                
                let remainingPath = join(dropRight(pathComponents, 1), ".");
                console.log('remainingPath         : ', remainingPath);

                lastPropertyBase = remainingPath;
            } else {
                // otherwise, treat the array as an array of object
                // and check to remove the index brackets in the string
                // which requires going two levels deep in the string
                let components = lastPropertyBase.split(".");
                console.log('components            : ', components);
                    
                let basePath = dropRight(components, 1);
                console.log('basePath              : ', basePath);    
            
                let lastItem = replace(takeRight(basePath, 1), /\[[^\]]*\]/, "");
                console.log('lastItem              : ', lastItem);

                let essentialPath = join(dropRight(basePath, 1), ".");
                console.log('essentialPath         : ', essentialPath);    

                let remainingPath = join([essentialPath, lastItem], "."); 
                console.log('remainingPath         : ', remainingPath);        

                lastPropertyBase = remainingPath; 
            }            

            console.log('lastPropertyBase      : ', lastPropertyBase);
            console.log('rootObject            : ', JSON.stringify(rootObject));
        });
        emitter.on(bfj.events.endObject, function(object){
            console.log('bfj.events.endObject  : ', JSON.stringify(rootObject))
            console.log('lastPropertyBase      : ', lastPropertyBase);

            let remainingPath = "";

            let existingObject = get(rootObject, lastPropertyBase);
            console.log('existingObject.isArray: ', Array.isArray(existingObject));

            let components = lastPropertyBase.split(".");
            console.log('components            : ', components);
                    
            let lastItem = takeRight(components, 1);
            console.log('lastItem              : ', lastItem);

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
                console.log('scrubbedItem          : ', scrubbedItem);

                let basePath = join(dropRight(components, 1), ".");
                console.log('basePath              : ', basePath);     

                remainingPath = join([basePath, scrubbedItem], "."); 
                console.log('remainingPath         : ', remainingPath);        

                lastPropertyBase = remainingPath;             

            } else {
                // no array reference, just removing the last item

                let basePath = dropRight(components, 1);
                console.log('basePath              : ', basePath);     

                remainingPath = join(basePath, "."); 
                console.log('remainingPath         : ', remainingPath);        

                lastPropertyBase = remainingPath;             
            }

            console.log('lastPropertyBase      : ', lastPropertyBase);
            console.log('rootObject            : ', JSON.stringify(rootObject));
        });
        emitter.on(bfj.events.error, function(error){ 
            console.log('bfj.events.error      : ', error)
        });
        emitter.on(bfj.events.dataError, function(error){ 
            console.log('bfj.events.dataError  : ', error)
        });
        emitter.on(bfj.events.end, function(end){
            console.log('bfj.events.end        : ', end)
        });

        
    }
}


if(options["compress"]){
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

if(options["pack"]){
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

if(options["stringify"]){
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


var specs = {
    'reporting_entity_name': 'a',
    'reporting_entity_type': 'b',
    'reporting_plans': 'c',
    'last_updated_on': 'd',
    'version': 'e',
    'out_of_network': 'f',
    'plan_name': 'g',
    'plan_id_type': 'h',
    'plan_id': 'i',
    'plan_market_type': 'j',
    'name': 'k',
    'billing_code_type': 'l',
    'billing_code_type_version': 'm',
    'billing_code': 'n',
    'description': 'o',
    'allowed_amounts': 'p',
    "tin": 'q',
    'type': 'r',
    'value': 's',
    'service_code': 't',
    'billing_class': 'u',
    'payments': 'v',
    'providers': 'w',
    'billed_charge': 'x',
    'npi': 'y'
  };
var minifier = require('json-minifier')(specs);


if(options["minify"]){
    if(typeof options["minify"] === "string"){

        fs.readFile(options["minify"], 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            console.log('Minifying file....')

            let parsedData;
            if(typeof data === "string"){
                parsedData = JSON.parse(data);
            } else if(typeof data === "object"){
                parsedData = data;
            }
            
            let minified = minifier.minify(parsedData)

            console.log('typeof minified', typeof minified)
            console.log('minified', minified)

            if(options["save"] && minified){
                fs.writeFile(options["save"], Buffer.from(minified), err => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })    
            }
        })    
    }
}

