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
price-validator --help

# read a file
price-validator --validate ../data-files/allowed-amounts.json

# validate a broken file
price-validator --validate ../data-files/allowed-amounts-borked.json --schema ../schemas/allowed-amounts.json
```

#### References  

https://developer.okta.com/blog/2019/06/18/command-line-app-with-nodejs  
https://medium.com/nsoft/using-ajv-for-schema-validation-with-nodejs-1dfef0a372f8  
