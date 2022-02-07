FROM alpine

ARG VERSION=v0.8.0
RUN apk update && apk add g++ cmake doxygen valgrind wget
COPY ./schemavalidator.cpp /
COPY ./rapidjson /rapidjson
RUN g++ schemavalidator.cpp -o validator

#Maybe move this into a runtime argument? Checkout out whole repo, switch tags when passed in during runtime?
RUN echo "checking out price transparency guide version ${VERSION}" \
  && wget -q https://github.com/CMSgov/price-transparency-guide/archive/refs/tags/${VERSION}.tar.gz -O price-transparency.tar.gz \
  && tar xf price-transparency.tar.gz 
ENTRYPOINT ["/validator"]
#RUN ["/bin/sh"]
