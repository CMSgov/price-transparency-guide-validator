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

#### Usage

```bash
# most recent instructions
bento-box --help
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

