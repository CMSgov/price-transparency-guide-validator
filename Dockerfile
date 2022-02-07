# FROM alpine
FROM ubuntu

ARG VERSION=v0.8.0
# RUN sed -i 's/https/http/' /etc/apk/repositories
# RUN apk update && apk add g++ cmake doxygen valgrind wget
RUN apt-get update
RUN apt-get install -y g++ cmake doxygen valgrind wget
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
COPY ./tclap /tclap
RUN g++ -I /tclap/include/ schemavalidator.cpp -o validator

#Maybe move this into a runtime argument? Checkout out whole repo, switch tags when passed in during runtime?
#RUN echo "checking out price transparency guide version ${VERSION}" \
#  && wget -q https://github.com/CMSgov/price-transparency-guide/archive/refs/tags/${VERSION}.tar.gz -O price-transparency.tar.gz \
#  && tar xf price-transparency.tar.gz 
ENTRYPOINT ["/validator"]
#RUN ["/bin/sh"]
