FROM ubuntu

ARG VERSION=v0.8.0
RUN apt-get update
RUN apt-get install -y g++ cmake doxygen valgrind wget
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
COPY ./tclap /tclap
RUN g++ -I /tclap/include/ schemavalidator.cpp -o validator

ENTRYPOINT ["/validator"]
