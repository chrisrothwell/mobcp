#! /bin/bash

serverless info --verbose
serverless deploy --stage dev --package /$CODEBUILD_SRC_DIR/target/dev -v
