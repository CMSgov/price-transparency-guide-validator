# price-transparency-guide-validator
Validation tool to check output files required by the [price-transparency-guide](https://github.com/CMSgov/price-transparency-guide)




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