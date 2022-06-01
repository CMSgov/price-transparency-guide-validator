FROM ubuntu

ARG VERSION=v1.0.0
RUN apt-get update
RUN apt-get install -y \
    g++ \
    cmake \
    doxygen \
    openjdk-17-jdk \
    valgrind \
    wget
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
COPY ./tclap /tclap
RUN g++ -I /tclap/include/ schemavalidator.cpp -o validator
COPY ./CmsMrfValidator.java /
RUN javac CmsMrfValidator.java
COPY ./entry.sh /

ENTRYPOINT ["/entry.sh"]
