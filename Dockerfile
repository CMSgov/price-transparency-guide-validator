# BUILD:  docker build -t rapidjson-debian .
# RUN:    docker run -it -v "$PWD"/../..:/rapidjson rapidjson-debian

#FROM ubuntu:20.04
FROM alpine

RUN apk update && apk add g++ cmake doxygen valgrind
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
RUN g++ schemavalidator.cpp -o validator
ENTRYPOINT ["/validator"]
