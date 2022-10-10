FROM ubuntu as build

ARG VERSION=v1.0.0
RUN apt-get update
RUN apt-get install -y g++ cmake doxygen valgrind wget
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
COPY ./tclap /tclap
RUN g++ -I /rapidjson/include -I /tclap/include/ schemavalidator.cpp -o validator

FROM ubuntu
COPY --from=build /validator /validator
ENTRYPOINT ["/validator"]
