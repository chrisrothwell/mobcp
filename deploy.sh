#! /bin/bash

npm install - g serverless
serverless info --verbose
serverless deploy --stage dev --package /$CODEBUILD_SRC_DIR/target/dev -v
