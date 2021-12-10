## Schema Validation Utility
Base utility template for testing schemas.  Based on `bento-box` utility.


#### Installation  

```bash
# clone the app 
git clone https://github.com/CMSgov/price-transparency-guide-validator


# move to the reference implementation folder
cd reference-implementation

# install the app
npm install -g .
```

#### Usage

```bash
# most recent instructions
validator-tool --help

# read a file
validator-tool --validate ../data-files/allowed-amounts.json

# validate a broken file
validator-tool --validate ../data-files/allowed-amounts-borked.json --schema ../schemas/allowed-amounts.json

# generate an ndjson file  
validator-tool --generate ../output/allowed-amounts.ndjson --lines 100

# stream an ndjson file and validate along the way
validator-tool --stream ../output/allowed-amounts.ndjson --schema ../schemas/allowed-amounts.json 

# stream an ndjson file, validate, and output the results into a separate file
validator-tool --stream ../output/allowed-amounts.ndjson --schema ../schemas/allowed-amounts.json --save ../output/errors.txt  

# walk a big JSON file via streaming
validator-tool --walk ../data/in-network-rates-fee-for-service-sample.json

# walk a big JSON file and match schemas as they are read
validator-tool --walk-and-match ../data-files/in-network-rates-fee-for-service-sample.json --schema ../schemas/negotiated-rate.json

# walk a big JSON file, match schemas, and write to an output file in NDJSON format as they are read
validator-tool --walk-and-match ../data-files/in-network-rates-fee-for-service-sample.json --schema ../schemas/negotiated-rate.json --save ../output/network-rates.ndjson
```

#### References  

https://developer.okta.com/blog/2019/06/18/command-line-app-with-nodejs  
https://medium.com/nsoft/using-ajv-for-schema-validation-with-nodejs-1dfef0a372f8  
https://nodejs.org/en/knowledge/advanced/streams/how-to-use-fs-create-read-stream/  
https://nodejs.org/en/knowledge/advanced/streams/how-to-use-fs-create-write-stream/  
