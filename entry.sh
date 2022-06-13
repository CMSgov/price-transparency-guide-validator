#!/bin/bash

case "$1" in
  xml) INVOKE="java -cp .:lib/* CmsMrfValidator ";;
  json) INVOKE="./validator ";;
  *) echo "Unknown validation type"
  exit 1;;
esac
shift
${INVOKE} $@