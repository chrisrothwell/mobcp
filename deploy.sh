#! /bin/bash

pwd
ls
npm config set prefix /usr/local
npm install - g serverless
ls
serverless info --verbose
serverless deploy --stage dev --package /$CODEBUILD_SRC_DIR/target/dev -v
