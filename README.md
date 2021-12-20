# price-transparency-guide-validator
Validation tool to check output files required by the [price-transparency-guide](https://github.com/CMSgov/price-transparency-guide)


#### Installation  

```bash
# clone the app 
git clone https://github.com/CMSgov/price-transparency-guide-validator


# move to the reference implementation folder
cd reference-implementation

# install the app
npm install -g .
```

#### Compiling C++ Dependencies

These installation instructions assume a Mac environment.  

```bash
# check on international licensing here (Chinese multinational corp)
git clone https://github.com/Tencent/rapidjson  

mkdir build
cd build

# build using the g++ compiler
cmake -DCMAKE_CXX_COMPILER=/usr/bin/g++ ..
```


#### Usage

```bash
# most recent instructions
price-validator --help

# read a file
price-validator --validate ../data-files/allowed-amounts.json

# validate a broken file
price-validator --validate ../data-files/allowed-amounts-borked.json --schema ../schemas/allowed-amounts.json

# generate an ndjson file  
price-validator --generate ../output/allowed-amounts.ndjson --lines 100

# stream an ndjson file and validate along the way
price-validator --stream ../output/allowed-amounts.ndjson --schema ../schemas/allowed-amounts.json 

# stream an ndjson file, validate, and output the results into a separate file
price-validator --stream ../output/allowed-amounts.ndjson --schema ../schemas/allowed-amounts.json --save ../output/errors.txt  
```

### Testing  

```bash
# alias for mocha.js  
npm test

```

### Compiling Documentation  

```bash 
# install the sushi tool
git clone https://github.com/FHIR/sushi
npm install -g fsh-sushi
sushi --help

# install the Jeklyll compiler
# https://jekyllrb.com/docs/installation/macos/
cd implementation-guide
sudo gem install bundler jekyll

# compile the documentation  
cd output
./_genonce.sh

# open the documentation (assuming Mac + Chrome)
cd output
open -a "Google Chrome" index.html
```



#### References  

https://developer.okta.com/blog/2019/06/18/command-line-app-with-nodejs  

