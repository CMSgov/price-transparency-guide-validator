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

#### Commands
`docker run` Docker will run the docker image passed to it.
`-v <host file>/:/<docker directory>` The <docker directory> will attempt to mount the absolute path directory on the host machine

