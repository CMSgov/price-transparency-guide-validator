## Docker Instructions

### PreReqs
[Install Docker](https://docs.docker.com/get-docker/)

### Build Docker Container
`docker build -t validator .`

### Find Docker Recent Image Hash
`docker images`

### Run Docker Cantainer
Copy docker image hash found from the `docker images` command.
`docker run -v <host directory containing files>/:/<docker directory that will mount the host> <docker image ID> <schema file> <json file>`

For Example:
`docker run -v $(pwd)/schemas/:/schemas d38ebf40991947a378094e234b4fdb7adeb715da605b704cad07e6714d4b8867 schemas/in-network-rates/in-network-rates.json schemas/in-network-rates/in-network-rates-fee-for-service-sample.json`

Example with optional output file:
`docker run -v $(pwd)/schemas/:/schemas -v $(pwd)/output/:/output abdf0d8512a8 schemas/in-network-rates/in-network-rates.json schemas/in-network-rates/in-network-rates-fee-for-service-single-plan-sample.json output/my_output.txt`

#### Commands
`docker run` Docker will run the docker image passed to it.
`-v <host file>/:/<docker directory>` The <docker directory> will attempt to mount the absolute path directory on the host machine

### Build Docker Container with a specific github tag
List of tags can be found [here](https://github.com/CMSgov/price-transparency-guide/tags)
`docker build -t shaselton/validator --build-arg VERSION=v0.2 .`
