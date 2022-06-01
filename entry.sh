#!/bin/bash

case "$1" in
  xml) INVOKE="java CmsMrfValidator ";;
  json) INVOKE="./validator ";;
  *) echo "Unknown validation type"
  exit 1;;
esac
shift
${INVOKE} $@