# BUILD:  docker build -t rapidjson-debian .
# RUN:    docker run -it -v "$PWD"/../..:/rapidjson rapidjson-debian

FROM ubuntu:20.04

RUN apt-get update && apt-get install -y g++ cmake doxygen valgrind
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
RUN g++ schemavalidator.cpp -o validator
ENTRYPOINT ["/validator"]
